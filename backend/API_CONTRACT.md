# Backend API Contract (React Native)

Base URL: `http://<server-host>:8080/api/v1`

Time policy:
- Device timestamps are sent and stored as ISO 8601 UTC instants.
- Calendar dates, daily/monthly aggregation, usage limits, and billing periods use
  `Asia/Jakarta` (WIB, UTC+7).
- CSV export contains both `measured_at_utc` and `measured_at_wib`.

All responses use:
- success: `{ success: true, message, data }`
- error: `{ success: false, error_code, message }`

## 1) Auth

### Register
- `POST /auth/register`
- body:
```json
{
  "full_name": "Your Name",
  "email": "you@mail.com",
  "password": "your-password"
}
```

### Login
- `POST /auth/login`
- body:
```json
{
  "email": "you@mail.com",
  "password": "your-password"
}
```

### Current User
- `GET /auth/me`
- header: `Authorization: Bearer <user_access_token>`

## 2) Device Management (user protected)

### Create Device
- `POST /devices`
- header: `Authorization: Bearer <user_access_token>`
- body:
```json
{
  "device_code": "BV-ESP32-01",
  "device_name": "Kitchen Meter",
  "install_location": "Kitchen",
  "firmware_version": "v3.0.0"
}
```
- response includes one-time `api_token` for IoT firmware.

### List Devices
- `GET /devices`
- header: `Authorization: Bearer <user_access_token>`

### Get Device by ID
- `GET /devices/:id`
- header: `Authorization: Bearer <user_access_token>`

### Update Device
- `PATCH /devices/:id`
- header: `Authorization: Bearer <user_access_token>`
- body (any subset):
```json
{
  "device_name": "New Name",
  "install_location": "Bathroom",
  "firmware_version": "v3.0.1"
}
```
- Note: `status` is computed automatically from `last_seen_at`
  (online if reported within the last 2 minutes, offline otherwise).
  It cannot be set manually.

### Delete Device
- `DELETE /devices/:id`
- header: `Authorization: Bearer <user_access_token>`
- Queues a `REPROVISION` command and immediately hides the device from the
  user's device list. The row and its telemetry are deleted only after the
  ESP32 acknowledges the command. An offline or sleeping device receives it
  on its next telemetry request.
- response data:
```json
{
  "id": 10,
  "pending_reset": true,
  "command": "REPROVISION",
  "requested_at": "2026-08-08T10:00:00.000Z"
}
```

## 3) Telemetry Ingest (device protected)

IoT must send device token in header:
- `Authorization: Bearer <device_api_token>`

### Single Record
- `POST /telemetry`
- body:
```json
{
  "device_code": "BV-ESP32-01",
  "measured_at": "2026-02-10T19:10:00.000Z",
  "flow_rate_lpm": 1.25,
  "volume_delta_l": 0.02,
  "cumulative_volume_l": 12.6,
  "pulse_count": 21,
  "battery_voltage": 4.9,
  "rssi_dbm": -64
}
```

### Batch Records
- `POST /telemetry/batch`
- body:
```json
{
  "device_code": "BV-ESP32-01",
  "records": [
    {
      "measured_at": "2026-02-10T19:10:00.000Z",
      "flow_rate_lpm": 1.25,
      "volume_delta_l": 0.02
    },
    {
      "measured_at": "2026-02-10T19:10:01.000Z",
      "flow_rate_lpm": 1.12,
      "volume_delta_l": 0.018
    }
  ]
}
```

Both single and batch ingest responses contain `data.command`. It is `null`
normally, or the following object when the device must clear its provisioning
configuration and return to BLE mode:
```json
{
  "type": "REPROVISION",
  "requested_at": "2026-08-08T10:00:00.000Z"
}
```

### Acknowledge Device Command
- `POST /telemetry/command-ack`
- header: `Authorization: Bearer <device_api_token>`
- body:
```json
{
  "device_code": "BV-ESP32-01",
  "command": "REPROVISION"
}
```
- The ESP32 must acknowledge before clearing NVS and restarting. A successful
  acknowledgment permanently deletes the device and its related telemetry.

## 4) Telemetry Read (user protected)

Header for both endpoints:
- `Authorization: Bearer <user_access_token>`

### Latest by Device Code
- `GET /telemetry/latest?device_code=BV-ESP32-01`

### Daily History
- `GET /telemetry/daily?device_code=BV-ESP32-01&date=2026-02-10`

### Usage History (aggregated by day)
- `GET /telemetry/history?device_code=BV-ESP32-01&from=2026-02-01&to=2026-02-10`
- Returns daily aggregates: `date`, `total_liters`, `avg_flow_rate_lpm`, `peak_flow_rate_lpm`, `reading_count`
- Useful for weekly/monthly charts and usage tracking

### Export CSV
- `GET /telemetry/export?device_code=BV-ESP32-01&from=2026-02-01&to=2026-02-10`
- Returns raw measurement data as CSV file download
- Columns: `measured_at_utc`, `measured_at_wib`, `flow_rate_lpm`, `volume_delta_l`, `cumulative_volume_l`, `pulse_count`, `battery_voltage`, `rssi_dbm`
- Content-Type: `text/csv`

## 5) Usage Limits & Alerts (user protected)

Header for all endpoints:
- `Authorization: Bearer <user_access_token>`

### Get Usage Limits
- `GET /usage/limits?device_code=BV-ESP32-01`

### Set Usage Limits
- `PUT /usage/limits`
- body:
```json
{
  "device_code": "BV-ESP32-01",
  "daily_usage_limit_l": 300,
  "monthly_usage_limit_l": 8000
}
```

### List Usage Alerts
- `GET /usage/alerts?device_code=BV-ESP32-01&status=active&limit=50`

### Dismiss Alert
- `PATCH /usage/alerts/:alert_id/dismiss`
- Marks the alert as `resolved` with current timestamp
- Returns: `{ id, status, resolved_at }`
- If already resolved, returns: `{ id, status: "resolved", already_resolved: true }`

## Notes for Mobile Team

- Save user token after login and send it for user-protected endpoints.
- Save the device `api_token` only when pairing/provisioning IoT.
- `device_code` is the stable key between mobile, backend, and IoT.
- For charts, call daily endpoint for per-reading data, or history endpoint for daily aggregates over a date range.
