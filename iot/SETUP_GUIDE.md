# IoT Water Meter Setup Guide

Step-by-step instructions for setting up the ESP32 water flow meter device
with the WaterMeter v3 firmware.

---

## Prerequisites

### Hardware
- ESP32 DevKit V1 (or compatible ESP32 board)
- YF-B6 water flow sensor
- I2C 20x4 LCD display (address 0x27)
- Breadboard + jumper wires
- Micro-USB cable for flashing
- WiFi network (2.4 GHz only — ESP32 does not support 5 GHz)

### Software (on your computer)
- Arduino IDE (v2.x recommended)
- ESP32 board support installed in Arduino IDE
- Required Arduino libraries (all available via Library Manager or built-in):
  - `WiFi` (built-in with ESP32 board package)
  - `HTTPClient` (built-in with ESP32 board package)
  - `ArduinoJson` (install via Library Manager, v6.x)
  - `BLEDevice` (built-in with ESP32 board package)
  - `Preferences` (built-in with ESP32 board package)
  - `LiquidCrystal_I2C` (install via Library Manager)

---

## Step 1: Wiring

Connect the components as follows:

### YF-B6 Flow Sensor
| Sensor Wire  | ESP32 Pin |
|-------------|-----------|
| Red (VCC)   | 5V (VIN)  |
| Black (GND) | GND       |
| Yellow (Signal) | GPIO 34 |

### I2C LCD (20x4)
| LCD Pin | ESP32 Pin |
|---------|-----------|
| VCC     | 5V (VIN)  |
| GND     | GND       |
| SDA     | GPIO 21   |
| SCL     | GPIO 22   |

> Note: GPIO 21 (SDA) and GPIO 22 (SCL) are the default I2C pins on most
> ESP32 DevKit boards. If your board uses different pins, adjust accordingly.

---

## Step 2: Install ESP32 Board Support in Arduino IDE

1. Open Arduino IDE
2. Go to **File > Preferences**
3. In "Additional Board Manager URLs", add:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Go to **Tools > Board > Boards Manager**
5. Search for "esp32" and install **esp32 by Espressif Systems**
6. Select your board: **Tools > Board > ESP32 Arduino > ESP32 Dev Module**

---

## Step 3: Install Required Libraries

In Arduino IDE, go to **Sketch > Include Library > Manage Libraries** and install:

1. **ArduinoJson** by Benoit Blanchon (version 6.x, NOT 7.x)
2. **LiquidCrystal I2C** by Frank de Brabander

The other libraries (`WiFi`, `HTTPClient`, `BLEDevice`, `Preferences`) are
already included with the ESP32 board package.

---

## Step 4: Flash the Firmware

1. Open `iot/firmware_v3/firmware_v3.ino` in Arduino IDE
2. Connect your ESP32 via USB
3. Select the correct COM port: **Tools > Port > COMx**
4. Board settings (under Tools):
   - Board: **ESP32 Dev Module**
   - Upload Speed: **921600**
   - Flash Frequency: **80MHz**
   - Partition Scheme: **Huge APP (3MB No OTA/1MB SPIFFS)**
5. Click **Upload** (arrow button)
6. Wait for "Done uploading" message

> The default partition only provides about 1.3 MB for the application and is
> too small for this firmware's BLE and HTTPS libraries. `Huge APP` is required.
> The equivalent Arduino CLI check is:
> ```bash
> arduino-cli compile --fqbn "esp32:esp32:esp32:PartitionScheme=huge_app" iot/firmware_v3
> ```

After flashing, the LCD should show:
```
WaterMeter v3 booting
Init sensor/LCD...
Init BLE/NVS...
Please wait...
```

Then it will switch to:
```
WaterMeter v3 WiFi ---
Flow: 0.000 L/m
Total: 0.000 L
B:ON W:-- S:--
```

This means BLE provisioning is active and waiting for configuration.

---

## Step 5: Set Up the Backend

Before provisioning the ESP32, make sure the backend is running:

1. **Start PostgreSQL** and make sure the database is created:
   ```bash
   # Run the init SQL (first time only)
   psql -U postgres -f backend/sql/init.sql
   ```

2. **Start the backend server**:
   ```bash
   cd backend
   npm run dev
   ```
   You should see: `Server running on port 8080`

3. **Find your computer's local IP address**:
   - Windows: Open CMD, run `ipconfig` — look for "IPv4 Address" under your WiFi adapter
   - Example: `192.168.1.10`

4. **Update mobile app API URL** (if needed):
   Edit `mobile/src/config/api.js` and set your computer's IP:
   ```js
   export const API_BASE_URL = "http://192.168.1.10:8080/api/v1";
   ```

---

## Step 6: Register and Create a Device in the App

1. Open the mobile app (Expo Go or dev build)
2. **Register** a new account (or login if you already have one)
3. Go to **My Devices** screen
4. Fill in the "Add device" form:
   - **Device code**: `BV-ESP32-01` (this must match the ESP32's device code)
   - **Device name**: Any name you want (e.g., "Kitchen Water Meter")
   - **Location**: Optional (e.g., "Kitchen sink")
5. Tap **Create Device**
6. **IMPORTANT: Save the API token** that appears in the yellow box!
   This token is shown only once and is needed to configure the ESP32.

---

## Step 7: Provision the ESP32 via BLE

### Option A: Using the Mobile App (BLE Scan Screen)

1. In the mobile app, tap the **Scan BLE** button on the Devices screen
2. Tap **Scan for Devices** — the app will search for nearby WaterMeter devices
3. You should see your device listed as **WaterMeter-XXXX**
4. Tap on it to connect
5. After connecting, fill in the provisioning form:
   - **WiFi SSID**: Your WiFi network name (2.4 GHz only!)
   - **WiFi Password**: Your WiFi password
   - **Server URL**: `http://<YOUR_COMPUTER_IP>:8080`
     (e.g., `http://192.168.1.10:8080`)
   - **API Token**: Paste the token from Step 6
6. Tap **Send Configuration**
7. The ESP32 closes BLE before connecting to WiFi. If the connection fails,
   WiFi is turned off and BLE provisioning becomes available again.

### Option B: Using a Generic BLE App (nRF Connect)

If the mobile app BLE screen is not working, you can use any BLE app:

1. Install **nRF Connect** from Play Store / App Store
2. Open nRF Connect and scan for devices
3. Find **WaterMeter-XXXX** and tap Connect
4. Find the service with UUID: `12345678-1234-5678-1234-56789abcdef0`
5. Write to each characteristic (as UTF-8 string):

   | Characteristic UUID (ending) | Value to Write |
   |------------------------------|----------------|
   | `...def1` (WiFi SSID)       | Your WiFi network name |
   | `...def2` (WiFi Password)   | Your WiFi password |
   | `...def3` (Server URL)      | `http://192.168.1.10:8080` |
   | `...def4` (API Token)       | The token from Step 6 |

6. After writing the API token (last one), the ESP32 auto-connects

---

## Step 8: Verify Everything Works

After provisioning, the LCD should update to:
```
WaterMeter v3 WiFi OK
Flow: 0.000 L/m
Total: 0.000 L
B:OFF W:OK S:OK
```

Status indicators on line 4:
- **B:ON** = BLE provisioning is active; it normally changes to **B:OFF**
  while the device operates over WiFi
- **W:OK** = WiFi connected
- **S:OK** = Last server request succeeded

In the mobile app:
1. Go to **My Devices** — the device should show as **ONLINE**
2. Tap on the device to see the **Dashboard**
3. You should see the latest telemetry (flow rate, volume)
4. Run water through the sensor to see data flow in real-time

---

## Troubleshooting

### ESP32 won't connect to WiFi
- Make sure you're using a **2.4 GHz** WiFi network (ESP32 does not support 5 GHz)
- Double-check the SSID and password (case-sensitive)
- Make sure the ESP32 and your backend computer are on the **same network**
- The LCD will show `W:--` if WiFi is not connected
- After a failed provisioning attempt, scan BLE again and resend the
  configuration. Operational WiFi retries use increasing delays up to 5 minutes
  to avoid continuous high-current connection attempts.

### ESP32 connects to WiFi but server status shows `S:ER`
- Check that the backend is running (`npm run dev` in the backend folder)
- Verify the server URL you wrote via BLE is correct
- Make sure the IP address is your computer's **local** IP (not `localhost`)
- Check that the API token matches what the backend gave you
- Try the IoT simulator first to verify backend is working:
  ```bash
  cd backend
  SERVER_URL=http://localhost:8080 DEVICE_CODE=BV-ESP32-01 DEVICE_TOKEN=<your-token> node tools/iot-simulator.js
  ```

### Device shows OFFLINE in the app
- The device must send data at least once every 2 minutes to stay online
- Check WiFi and server status on the LCD
- If the sensor is idle, the ESP32 sends heartbeat records every 60 seconds

### No flow data showing
- Make sure water is actually flowing through the YF-B6 sensor
- Check the wiring: signal wire on GPIO 34, VCC on 5V, GND on GND
- The sensor needs water pressure to spin the turbine
- Flow rate should appear on the LCD when water flows

### LCD shows nothing
- Check wiring: SDA on GPIO 21, SCL on GPIO 22, VCC on 5V
- The I2C address should be 0x27 — if your LCD uses a different address,
  update `LCD_ADDR` in the firmware
- Try adjusting the contrast potentiometer on the back of the LCD module

### BLE device not found during scan
- Make sure you're within Bluetooth range (< 10 meters)
- The device advertises as "WaterMeter-XXXX" where XXXX is derived from the MAC
- BLE advertising is active only during provisioning or after a provisioning
  WiFi connection fails (`B:ON` on the LCD)
- On Android, make sure Location and Bluetooth permissions are granted

### Reset a deleted device for provisioning
- Deleting a device in the app queues a reset command on the backend.
- The ESP32 receives it on its next telemetry request, clears its saved
  configuration, restarts, and advertises through BLE again.
- If the device cannot contact the server, hold the ESP32 **BOOT** button for
  3 seconds to clear the configuration locally.

### RAM telemetry buffer becomes full
- The firmware retains the newest 400 readings and drops the oldest reading.
- Serial Monitor reports the cumulative number of dropped readings.
- The cumulative LCD value survives deep sleep through ESP32 RTC memory, but
  it resets after complete power loss or reflashing.

---

## Upgrading from Firmware v1

If your ESP32 currently has v1 firmware (the monitor-only version):

1. No hardware changes needed — same wiring (GPIO 34, I2C LCD)
2. Just flash `firmware_v3.ino` over the existing firmware
3. The v3 firmware adds: WiFi, BLE provisioning, server telemetry, heartbeat
4. After flashing, the device code defaults to `BV-ESP32-01`
5. Follow Steps 6-8 above to complete setup

---

## Quick Reference

| Item | Value |
|------|-------|
| Flow sensor pin | GPIO 34 |
| LCD I2C address | 0x27 |
| LCD size | 20x4 |
| Pulses per liter | 352 |
| Backend port | 8080 |
| Default device code | BV-ESP32-01 |
| Telemetry batch interval | 30 seconds |
| Heartbeat interval | 60 seconds |
| Online timeout | 2 minutes |
| BLE device name | WaterMeter-XXXX |
| BLE service UUID | 12345678-1234-5678-1234-56789abcdef0 |
