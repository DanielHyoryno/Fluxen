/*
  WaterMeter v3 - ESP32 Firmware

  Codenya Buat apa aja:
  - Reads a YF-B6 flow sensor on GPIO 34 using interrupt pulses (FALLING edge)
  - Shows live flow, cumulative volume, and connection state on 20x4 I2C LCD (0x27)
  - Provides BLE provisioning for WiFi SSID/password, server URL, and API token
  - Stores provisioning values in NVS (Preferences) so they persist across reboots
  - Syncs time with NTP and generates UTC ISO 8601 timestamps for telemetry records
  - Buffers telemetry in RAM and sends batch records to backend with Bearer token auth
  - Sends heartbeat records every 60 seconds when there is no water flow

  Requirement sebelum Upload ke IOT nya:
  1) Select board: ESP32 Dev Module (or your ESP32 DevKit variant)
  2) Install required libraries available in ESP32 Arduino ecosystem:
     WiFi, HTTPClient, ArduinoJson, BLEDevice/BLEServer/BLEUtils/BLE2902,
     Preferences, LiquidCrystal_I2C, time
  3) Open this file and upload to your ESP32
  4) Provision WiFi/server/token via BLE device name: WaterMeter-XXXX
*/

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>
#include <esp_sleep.h>

// =========================
// Hardware Configuration
// =========================
static const int FLOW_SENSOR_PIN = 34;
static const int PULSES_PER_LITER = 352;
static const int BATTERY_ADC_PIN = 35;
static const float BATTERY_VOLTAGE_DIVIDER_RATIO = 2.0f;
// GPIO34 has no internal pull-up on ESP32, use external pull-up resistor on flow signal.
static const uint8_t LCD_ADDR = 0x27;
static const uint8_t LCD_COLS = 20;
static const uint8_t LCD_ROWS = 4;

LiquidCrystal_I2C lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);

// =========================
// BLE UUIDs
// =========================
static const char *SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
static const char *CHAR_UUID_WIFI_SSID = "12345678-1234-5678-1234-56789abcdef1";
static const char *CHAR_UUID_WIFI_PASS = "12345678-1234-5678-1234-56789abcdef2";
static const char *CHAR_UUID_SERVER_URL = "12345678-1234-5678-1234-56789abcdef3";
static const char *CHAR_UUID_API_TOKEN = "12345678-1234-5678-1234-56789abcdef4";
static const char *CHAR_UUID_DEVICE_CODE = "12345678-1234-5678-1234-56789abcdef5";

// =========================
// Timing and Limits
// =========================
static const unsigned long FLOW_SAMPLE_INTERVAL_MS = 1000UL;
static const unsigned long SEND_INTERVAL_MS = 30000UL;         // every 30s
static const unsigned long WIFI_RETRY_INTERVAL_MS = 10000UL;   // retry every 10s
static const unsigned long WIFI_RETRY_MAX_INTERVAL_MS = 300000UL;
static const unsigned long HEARTBEAT_INTERVAL_SEC = 60UL;      // at least one zero record every 60s
static const unsigned long IDLE_SLEEP_TIMEOUT_MS = 30000UL;    // sleep after 30s without pulse
static const int MAX_RECORDS = 400;
static const int SEND_CHUNK_SIZE = 60;

// =========================
// NTP Configuration
// =========================
// WIB/Jakarta offset requested. Timestamp payload is still generated as UTC (Z).
static const long GMT_OFFSET_SEC = 7 * 3600;
static const int DAYLIGHT_OFFSET_SEC = 0;

// =========================
// Persistent Config (NVS)
// =========================
Preferences prefs;
String wifiSsid;
String wifiPass;
String serverUrl;
String apiToken;
String deviceCode;
static const char *DEFAULT_DEVICE_CODE = "BV-ESP32-01"; // Ini buat nama IOT nya apa biar bisa direcognize mobile app

// =========================
// BLE Globals
// =========================
BLEServer *bleServer = nullptr;
BLEService *bleService = nullptr;
BLECharacteristic *charWifiSsid = nullptr;
BLECharacteristic *charWifiPass = nullptr;
BLECharacteristic *charServerUrl = nullptr;
BLECharacteristic *charApiToken = nullptr;
BLECharacteristic *charDeviceCode = nullptr;
bool bleAdvertisingActive = false;
volatile bool provisioningConnectRequested = false;

// =========================
// Flow and Telemetry State
// =========================
volatile uint32_t pulseCount = 0;
volatile bool pulseActivitySinceLastCheck = false;
float currentFlowRateLpm = 0.0f;
// RTC memory survives deep sleep without adding frequent NVS flash writes.
RTC_DATA_ATTR float cumulativeVolumeL = 0.0f;
unsigned long lastFlowSampleMs = 0;
unsigned long lastSendAttemptMs = 0;
unsigned long lastWifiAttemptMs = 0;
unsigned long currentWifiRetryIntervalMs = WIFI_RETRY_INTERVAL_MS;
unsigned long lastPulseActivityMs = 0;
time_t lastHeartbeatEpoch = 0;

enum ServerSendStatus {
  SERVER_UNKNOWN = 0,
  SERVER_OK = 1,
  SERVER_FAIL = 2
};

ServerSendStatus serverStatus = SERVER_UNKNOWN;
bool reprovisionCommandPending = false;

struct TelemetryRecord {
  char measured_at[25];            // YYYY-MM-DDTHH:MM:SS.000Z
  float flow_rate_lpm;
  float volume_delta_l;
  float cumulative_volume_l;
  uint32_t pulse_count;
  float battery_voltage;           // < 0 means unknown/unavailable
  int rssi_dbm;                    // 127 means unknown/unavailable
};

TelemetryRecord records[MAX_RECORDS];
int recordCount = 0;
uint32_t droppedRecordCount = 0;

// Keep telemetry JSON in global memory to avoid loop-task stack pressure.
// Local StaticJsonDocument<16384> in postRecordChunk can trigger resets.
StaticJsonDocument<16384> telemetryDoc;

// =========================
// Utility Helpers
// =========================
void printLcdLine(uint8_t row, const String &text) {
  String line = text;
  if (line.length() < LCD_COLS) {
    while (line.length() < LCD_COLS) {
      line += ' ';
    }
  } else if (line.length() > LCD_COLS) {
    line = line.substring(0, LCD_COLS);
  }
  lcd.setCursor(0, row);
  lcd.print(line);
}

bool hasProvisioningConfig() {
  return wifiSsid.length() > 0 &&
         wifiPass.length() > 0 &&
         serverUrl.length() > 0 &&
         apiToken.length() > 0;
}

String normalizeBaseUrl(const String &rawUrl) {
  String url = rawUrl;
  url.trim();
  while (url.endsWith("/")) {
    url.remove(url.length() - 1);
  }
  return url;
}

String getBatchEndpointUrl() {
  return normalizeBaseUrl(serverUrl) + "/api/v1/telemetry/batch";
}

String getCommandAckEndpointUrl() {
  return normalizeBaseUrl(serverUrl) + "/api/v1/telemetry/command-ack";
}

// =========================
// Re-Provisioning via BOOT button
// =========================
static unsigned long bootButtonHoldStart = 0;
static bool bootButtonArmed = false;

void clearProvisioningAndRestart(const String &reason) {
  Serial.println("[REPROV] " + reason);
  printLcdLine(0, "Re-provisioning...");
  printLcdLine(1, "Clearing config");
  printLcdLine(2, "Return to BLE");
  printLcdLine(3, "Restarting...");
  delay(750);

  prefs.clear();
  prefs.end();

  ESP.restart();
}

void checkReProvisionButton() {
  bool pressed = (digitalRead(2) == LOW); // GPIO0 = BOOT button, active LOW

  if (pressed) {
    if (!bootButtonArmed) {
      bootButtonArmed = true;
      bootButtonHoldStart = millis();
    } else if (millis() - bootButtonHoldStart >= 3000) {
      // Held 3 seconds — wipe config and restart into BLE provisioning
      Serial.println("[REPROV] BOOT held 3s — clearing NVS and restarting...");
      printLcdLine(0, "Re-provisioning...");
      printLcdLine(1, "Clearing config");
      printLcdLine(2, "Restarting...");
      printLcdLine(3, "Release button");
      delay(1000);

      clearProvisioningAndRestart("BOOT held 3s");
    }
  } else {
    bootButtonArmed = false;
  }
}

bool isTimeSynced() {
  time_t now = time(nullptr);
  // Guard threshold to avoid sending invalid epoch-based timestamps
  return now > 1700000000;
}

void toIso8601Utc(time_t epoch, char *out, size_t outLen) {
  struct tm timeInfo;
  gmtime_r(&epoch, &timeInfo);
  strftime(out, outLen, "%Y-%m-%dT%H:%M:%S.000Z", &timeInfo);
}

void updateLcdStatus() {
  String line0 = "WaterMeter v3 ";
  line0 += (WiFi.status() == WL_CONNECTED) ? "WiFi OK" : "WiFi ---";

  String line1 = "Flow: " + String(currentFlowRateLpm, 3) + " L/m";
  String line2 = "Total: " + String(cumulativeVolumeL, 3) + " L";

  String line3 = "B:";
  line3 += bleAdvertisingActive ? "ON " : "OFF";
  line3 += " W:";
  line3 += (WiFi.status() == WL_CONNECTED) ? "OK " : "-- ";
  line3 += "S:";
  if (serverStatus == SERVER_OK) {
    line3 += "OK";
  } else if (serverStatus == SERVER_FAIL) {
    line3 += "ER";
  } else {
    line3 += "--";
  }

  printLcdLine(0, line0);
  printLcdLine(1, line1);
  printLcdLine(2, line2);
  printLcdLine(3, line3);
}

void saveStringToNvs(const char *key, const String &value) {
  prefs.putString(key, value);
}

void loadConfigFromNvs() {
  prefs.begin("wmeter", false);

  wifiSsid = prefs.getString("wifi_ssid", "");
  wifiPass = prefs.getString("wifi_pass", "");
  serverUrl = prefs.getString("server_url", "");
  apiToken = prefs.getString("api_token", "");
  deviceCode = prefs.getString("device_code", "");
  reprovisionCommandPending = prefs.getBool("reset_pending", false);

  if (deviceCode.length() == 0) {
    deviceCode = DEFAULT_DEVICE_CODE;
    saveStringToNvs("device_code", deviceCode);
  }
}

void updateBleCharacteristicValues() {
  if (charWifiSsid != nullptr) {
    charWifiSsid->setValue(wifiSsid.c_str());
  }
  if (charWifiPass != nullptr) {
    charWifiPass->setValue(wifiPass.c_str());
  }
  if (charServerUrl != nullptr) {
    charServerUrl->setValue(serverUrl.c_str());
  }
  if (charApiToken != nullptr) {
    charApiToken->setValue(apiToken.c_str());
  }
  if (charDeviceCode != nullptr) {
    charDeviceCode->setValue(deviceCode.c_str());
  }
}

bool ensureWiFiConnected(bool forceAttempt = false) {
  if (WiFi.status() == WL_CONNECTED) {
    currentWifiRetryIntervalMs = WIFI_RETRY_INTERVAL_MS;
    return true;
  }

  if (!hasProvisioningConfig()) {
    return false;
  }

  if (!forceAttempt && (millis() - lastWifiAttemptMs < currentWifiRetryIntervalMs)) {
    return false;
  }

  lastWifiAttemptMs = millis();
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());

  unsigned long startMs = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startMs < 15000UL) {
    delay(200);
  }

  if (WiFi.status() == WL_CONNECTED) {
    currentWifiRetryIntervalMs = WIFI_RETRY_INTERVAL_MS;
    return true;
  }

  currentWifiRetryIntervalMs = min(
      currentWifiRetryIntervalMs * 2UL,
      WIFI_RETRY_MAX_INTERVAL_MS);
  Serial.println("[WIFI] Connect failed; next retry in " +
                 String(currentWifiRetryIntervalMs / 1000UL) + "s");
  return false;
}

void startNtpSync() {
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, "pool.ntp.org", "time.nist.gov", "time.google.com");
}

float readBatteryVoltage() {
  uint16_t rawMv = analogReadMilliVolts(BATTERY_ADC_PIN);
  if (rawMv == 0) {
    return -1.0f;
  }

  float measuredV = static_cast<float>(rawMv) / 1000.0f;
  float batteryV = measuredV * BATTERY_VOLTAGE_DIVIDER_RATIO;

  if (batteryV < 2.0f || batteryV > 6.0f) {
    return -1.0f;
  }

  return batteryV;
}

int readRssiDbm() {
  if (WiFi.status() != WL_CONNECTED) {
    return 127;
  }

  return WiFi.RSSI();
}

void addRecord(const char *measuredAt,
               float flowRateLpm,
               float volumeDeltaL,
               float cumulativeL,
               uint32_t pulseCountValue,
               float batteryVoltage,
               int rssiDbm) {
  if (recordCount >= MAX_RECORDS) {
    // Drop oldest record when full to keep latest data
    for (int i = 1; i < MAX_RECORDS; ++i) {
      records[i - 1] = records[i];
    }
    recordCount = MAX_RECORDS - 1;
    droppedRecordCount++;
    if (droppedRecordCount == 1 || droppedRecordCount % 50 == 0) {
      Serial.println("[BUFFER] RAM buffer full; dropped oldest records: " + String(droppedRecordCount));
    }
  }

  strncpy(records[recordCount].measured_at, measuredAt, sizeof(records[recordCount].measured_at) - 1);
  records[recordCount].measured_at[sizeof(records[recordCount].measured_at) - 1] = '\0';
  records[recordCount].flow_rate_lpm = flowRateLpm;
  records[recordCount].volume_delta_l = volumeDeltaL;
  records[recordCount].cumulative_volume_l = cumulativeL;
  records[recordCount].pulse_count = pulseCountValue;
  records[recordCount].battery_voltage = batteryVoltage;
  records[recordCount].rssi_dbm = rssiDbm;
  recordCount++;
}

void removeSentPrefix(int sentCount) {
  if (sentCount <= 0 || sentCount > recordCount) {
    return;
  }

  int remaining = recordCount - sentCount;
  for (int i = 0; i < remaining; ++i) {
    records[i] = records[i + sentCount];
  }
  recordCount = remaining;
}

bool postRecordChunk(int chunkCount) {
  if (chunkCount <= 0 || chunkCount > recordCount) {
    return true;
  }

  HTTPClient http;
  String endpoint = getBatchEndpointUrl();
  const bool isHttps = endpoint.startsWith("https://");
  WiFiClient wifiClient;
  WiFiClientSecure secureClient;

  if (isHttps) {
    secureClient.setInsecure();
    http.begin(secureClient, endpoint);
  } else {
    http.begin(wifiClient, endpoint);
  }
  http.setConnectTimeout(15000);
  http.setTimeout(15000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + apiToken);

  telemetryDoc.clear();
  telemetryDoc["device_code"] = deviceCode;
  JsonArray arr = telemetryDoc.createNestedArray("records");

  for (int i = 0; i < chunkCount; ++i) {
    JsonObject obj = arr.createNestedObject();
    obj["measured_at"] = records[i].measured_at;
    obj["flow_rate_lpm"] = records[i].flow_rate_lpm;
    obj["volume_delta_l"] = records[i].volume_delta_l;
    obj["cumulative_volume_l"] = records[i].cumulative_volume_l;
    obj["pulse_count"] = records[i].pulse_count;
    if (records[i].battery_voltage >= 0.0f) {
      obj["battery_voltage"] = records[i].battery_voltage;
    }
    if (records[i].rssi_dbm != 127) {
      obj["rssi_dbm"] = records[i].rssi_dbm;
    }
  }

  String payload;
  serializeJson(telemetryDoc, payload);

  Serial.println("[MEM] Free heap before POST: " + String(ESP.getFreeHeap()));
  Serial.println("[POST] Sending telemetry batch...");
  Serial.println("[POST] Endpoint: " + endpoint);
  Serial.println("[POST] Device code: " + deviceCode);
  Serial.println("[POST] Records: " + String(chunkCount));

  int httpCode = http.POST(payload);
  Serial.println("[POST] HTTP code: " + String(httpCode));
  if (httpCode > 0) {
    // Read response body to finish transaction cleanly.
    String responseBody = http.getString();
    Serial.println("[POST] Response: " + responseBody);

    if (httpCode >= 200 && httpCode < 300) {
      telemetryDoc.clear();
      DeserializationError jsonError = deserializeJson(telemetryDoc, responseBody);
      if (!jsonError) {
        const char *commandType = telemetryDoc["data"]["command"]["type"] | "";
        if (strcmp(commandType, "REPROVISION") == 0) {
          reprovisionCommandPending = true;
          prefs.putBool("reset_pending", true);
          Serial.println("[COMMAND] REPROVISION received");
        }
      } else {
        Serial.println("[POST] Response JSON parse failed: " + String(jsonError.c_str()));
      }
    }
  } else {
    Serial.println("[POST] Error: " + http.errorToString(httpCode));
  }
  http.end();

  return httpCode >= 200 && httpCode < 300;
}

int acknowledgeReprovisionCommand() {
  HTTPClient http;
  String endpoint = getCommandAckEndpointUrl();
  const bool isHttps = endpoint.startsWith("https://");
  WiFiClient wifiClient;
  WiFiClientSecure secureClient;

  if (isHttps) {
    secureClient.setInsecure();
    http.begin(secureClient, endpoint);
  } else {
    http.begin(wifiClient, endpoint);
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + apiToken);
  http.setConnectTimeout(15000);
  http.setTimeout(15000);

  telemetryDoc.clear();
  telemetryDoc["device_code"] = deviceCode;
  telemetryDoc["command"] = "REPROVISION";

  String payload;
  serializeJson(telemetryDoc, payload);

  Serial.println("[COMMAND] Acknowledging REPROVISION...");
  int httpCode = http.POST(payload);
  if (httpCode > 0) {
    String responseBody = http.getString();
    Serial.println("[COMMAND] ACK response: " + responseBody);
  } else {
    Serial.println("[COMMAND] ACK error: " + http.errorToString(httpCode));
  }
  http.end();

  return httpCode;
}

bool commandAckAllowsReset(int httpCode) {
  // A 401/404 after a previously authenticated command usually means the
  // first ACK succeeded but its response was lost and the device row is gone.
  return (httpCode >= 200 && httpCode < 300) || httpCode == 401 || httpCode == 404;
}

void processPendingReprovisionCommand() {
  if (!reprovisionCommandPending || WiFi.status() != WL_CONNECTED) {
    return;
  }

  int ackCode = acknowledgeReprovisionCommand();
  if (commandAckAllowsReset(ackCode)) {
    clearProvisioningAndRestart("Remote reset acknowledged");
  }
}

void sendTelemetryBatches() {
  if (reprovisionCommandPending) {
    processPendingReprovisionCommand();
    return;
  }

  if (recordCount == 0) {
    return;
  }

  if (!hasProvisioningConfig()) {
    serverStatus = SERVER_FAIL;
    return;
  }

  if (bleAdvertisingActive || provisioningConnectRequested) {
    return;
  }

  if (!ensureWiFiConnected()) {
    serverStatus = SERVER_FAIL;
    return;
  }

  if (!isTimeSynced()) {
    // Do not send data until NTP time is valid.
    return;
  }

  while (recordCount > 0) {
    int chunkCount = (recordCount > SEND_CHUNK_SIZE) ? SEND_CHUNK_SIZE : recordCount;
    bool ok = postRecordChunk(chunkCount);
    if (!ok) {
      serverStatus = SERVER_FAIL;
      return;
    }
    removeSentPrefix(chunkCount);
    serverStatus = SERVER_OK;

    if (reprovisionCommandPending) {
      break;
    }
    delay(40);
  }

  processPendingReprovisionCommand();
}

void enterDeepSleepFromIdle() {
  // Keep BLE provisioning available when config is not complete.
  if (
      !hasProvisioningConfig() ||
      bleAdvertisingActive ||
      provisioningConnectRequested ||
      reprovisionCommandPending) {
    return;
  }

  // Device just had pulse activity.
  if (millis() - lastPulseActivityMs < IDLE_SLEEP_TIMEOUT_MS) {
    return;
  }

  // Flush pending telemetry first so data is not lost across deep sleep reset.
  if (recordCount > 0) {
    sendTelemetryBatches();
    if (recordCount > 0) {
      return;
    }
  }

  // Wake source uses FLOW_SENSOR_PIN low level. If line is already low,
  // entering sleep can wake immediately.
  if (digitalRead(FLOW_SENSOR_PIN) == LOW) {
    return;
  }

  printLcdLine(0, "WaterMeter v3 Sleep");
  printLcdLine(1, "Idle >30s");
  printLcdLine(2, "Wake: flow pulse");
  printLcdLine(3, "Preparing...");
  delay(120);

  uint64_t wakeMask = (1ULL << FLOW_SENSOR_PIN);
  esp_sleep_enable_ext1_wakeup(wakeMask, ESP_EXT1_WAKEUP_ALL_LOW);
  esp_deep_sleep_start();
}

// =========================
// BLE Provisioning Callbacks
// =========================
class ProvisioningCallbacks : public BLECharacteristicCallbacks {
 public:
  void onWrite(BLECharacteristic *characteristic) override {
    std::string incoming = characteristic->getValue();
    String value = String(incoming.c_str());
    value.trim();

    String uuid = String(characteristic->getUUID().toString().c_str());

    if (uuid.equalsIgnoreCase(CHAR_UUID_WIFI_SSID)) {
      wifiSsid = value;
      saveStringToNvs("wifi_ssid", wifiSsid);
    } else if (uuid.equalsIgnoreCase(CHAR_UUID_WIFI_PASS)) {
      wifiPass = value;
      saveStringToNvs("wifi_pass", wifiPass);
    } else if (uuid.equalsIgnoreCase(CHAR_UUID_SERVER_URL)) {
      serverUrl = value;
      saveStringToNvs("server_url", serverUrl);
    } else if (uuid.equalsIgnoreCase(CHAR_UUID_API_TOKEN)) {
      apiToken = value;
      saveStringToNvs("api_token", apiToken);
    }

    updateBleCharacteristicValues();

    // Let the main loop stop BLE before starting WiFi. Connecting from this
    // callback keeps both radios active and can cause a supply-current spike.
    if (hasProvisioningConfig()) {
      provisioningConnectRequested = true;
    }

    updateLcdStatus();
  }
};

void setupBleProvisioning() {
  if (bleAdvertisingActive) {
    return;
  }

  uint64_t chipMac = ESP.getEfuseMac();
  uint16_t macTail = static_cast<uint16_t>(chipMac & 0xFFFF);
  char suffix[5];
  snprintf(suffix, sizeof(suffix), "%04X", macTail);
  String deviceName = "WaterMeter-" + String(suffix);

  BLEDevice::init(deviceName.c_str());
  bleServer = BLEDevice::createServer();
  bleService = bleServer->createService(SERVICE_UUID);

  charWifiSsid = bleService->createCharacteristic(
      CHAR_UUID_WIFI_SSID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE);
  charWifiPass = bleService->createCharacteristic(
      CHAR_UUID_WIFI_PASS,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE);
  charServerUrl = bleService->createCharacteristic(
      CHAR_UUID_SERVER_URL,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE);
  charApiToken = bleService->createCharacteristic(
      CHAR_UUID_API_TOKEN,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE);
  charDeviceCode = bleService->createCharacteristic(
      CHAR_UUID_DEVICE_CODE,
      BLECharacteristic::PROPERTY_READ);

  // Descriptors improve compatibility with some mobile BLE clients.
  charWifiSsid->addDescriptor(new BLE2902());
  charWifiPass->addDescriptor(new BLE2902());
  charServerUrl->addDescriptor(new BLE2902());
  charApiToken->addDescriptor(new BLE2902());
  charDeviceCode->addDescriptor(new BLE2902());

  static ProvisioningCallbacks provisioningCallbacks;
  charWifiSsid->setCallbacks(&provisioningCallbacks);
  charWifiPass->setCallbacks(&provisioningCallbacks);
  charServerUrl->setCallbacks(&provisioningCallbacks);
  charApiToken->setCallbacks(&provisioningCallbacks);

  updateBleCharacteristicValues();

  bleService->start();
  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  bleAdvertisingActive = true;
}

void stopBleProvisioning() {
  if (!bleAdvertisingActive) {
    return;
  }

  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  if (advertising != nullptr) {
    advertising->stop();
  }

  BLEDevice::deinit(true);
  bleAdvertisingActive = false;
  bleServer = nullptr;
  bleService = nullptr;
  charWifiSsid = nullptr;
  charWifiPass = nullptr;
  charServerUrl = nullptr;
  charApiToken = nullptr;
  charDeviceCode = nullptr;
}

void handleProvisioningWifiHandoff() {
  if (!provisioningConnectRequested) {
    return;
  }

  provisioningConnectRequested = false;
  printLcdLine(2, "Switch BLE -> WiFi");

  // Give the BLE write response time to complete, then release the BLE stack
  // before WiFi association starts.
  delay(250);
  stopBleProvisioning();
  delay(100);

  if (ensureWiFiConnected(true)) {
    startNtpSync();
    printLcdLine(2, "WiFi connected");
    return;
  }

  Serial.println("[WIFI] Provisioning connection failed; returning to BLE");
  WiFi.disconnect();
  WiFi.mode(WIFI_OFF);
  delay(100);
  setupBleProvisioning();
  printLcdLine(2, "WiFi fail - BLE ON");
}

// =========================
// Sensor ISR and Sampling
// =========================
void IRAM_ATTR pulseCounter() {
  pulseCount++;
  pulseActivitySinceLastCheck = true;
}

void sampleFlowAndBuildRecords() {
  unsigned long nowMs = millis();
  if (nowMs - lastFlowSampleMs < FLOW_SAMPLE_INTERVAL_MS) {
    return;
  }
  lastFlowSampleMs = nowMs;

  uint32_t pulses;
  bool hadPulseActivity;
  noInterrupts();
  pulses = pulseCount;
  pulseCount = 0;
  hadPulseActivity = pulseActivitySinceLastCheck;
  pulseActivitySinceLastCheck = false;
  interrupts();

  if (hadPulseActivity || pulses > 0) {
    lastPulseActivityMs = nowMs;
  }

  float volumeDeltaL = static_cast<float>(pulses) / static_cast<float>(PULSES_PER_LITER);
  currentFlowRateLpm = volumeDeltaL * 60.0f;
  cumulativeVolumeL += volumeDeltaL;
  float batteryVoltage = readBatteryVoltage();
  int rssiDbm = readRssiDbm();

  if (isTimeSynced()) {
    time_t nowEpoch = time(nullptr);
    char measuredAt[25];
    toIso8601Utc(nowEpoch, measuredAt, sizeof(measuredAt));

    if (pulses > 0) {
      addRecord(measuredAt, currentFlowRateLpm, volumeDeltaL, cumulativeVolumeL, pulses, batteryVoltage, rssiDbm);
      lastHeartbeatEpoch = nowEpoch;
    } else {
      if (lastHeartbeatEpoch == 0 || static_cast<unsigned long>(nowEpoch - lastHeartbeatEpoch) >= HEARTBEAT_INTERVAL_SEC) {
        addRecord(measuredAt, 0.0f, 0.0f, cumulativeVolumeL, 0, batteryVoltage, rssiDbm);
        lastHeartbeatEpoch = nowEpoch;
      }
    }
  }

  updateLcdStatus();
}

void setup() {
  Serial.begin(115200);

  lcd.init();
  lcd.backlight();
  printLcdLine(0, "WaterMeter v3 booting");
  printLcdLine(1, "Init sensor/LCD...");
  printLcdLine(2, "Init BLE/NVS...");
  printLcdLine(3, "Please wait...");

  pinMode(FLOW_SENSOR_PIN, INPUT);
  pinMode(BATTERY_ADC_PIN, INPUT);
  pinMode(2, INPUT_PULLUP); // BOOT button
  attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), pulseCounter, FALLING);

  loadConfigFromNvs();
  if (!isfinite(cumulativeVolumeL) || cumulativeVolumeL < 0.0f) {
    cumulativeVolumeL = 0.0f;
  }
  if (hasProvisioningConfig()) {
    printLcdLine(2, "WiFi connect attempt");
    WiFi.mode(WIFI_STA);
    if (ensureWiFiConnected(true)) {
      startNtpSync();
    } else {
      WiFi.disconnect();
      WiFi.mode(WIFI_OFF);
      setupBleProvisioning();
      printLcdLine(2, "WiFi fail - BLE ON");
    }
  } else {
    WiFi.mode(WIFI_OFF);
    setupBleProvisioning();
    printLcdLine(2, "BLE provisioning...");
  }

  lastFlowSampleMs = millis();
  lastSendAttemptMs = millis();
  lastWifiAttemptMs = 0;
  lastPulseActivityMs = millis();

  updateLcdStatus();
}

void loop() {

  checkReProvisionButton();
  handleProvisioningWifiHandoff();

  // Keep WiFi alive in operational mode. While BLE provisioning is active,
  // wait for a new write instead of repeatedly powering both radios.
  if (hasProvisioningConfig() && !bleAdvertisingActive && !provisioningConnectRequested) {
    bool wasConnected = (WiFi.status() == WL_CONNECTED);
    bool nowConnected = ensureWiFiConnected();
    if (!wasConnected && nowConnected) {
      startNtpSync();
    }
  }

  sampleFlowAndBuildRecords();

  // Send buffered telemetry every 30 seconds in chunks.
  if (millis() - lastSendAttemptMs >= SEND_INTERVAL_MS) {
    lastSendAttemptMs = millis();
    sendTelemetryBatches();
    updateLcdStatus();
  }

  enterDeepSleepFromIdle();

  // Keep loop responsive.
  delay(20);
}
