#!/usr/bin/env node

/**
 * IoT Simulator — pretends to be an ESP32 + YF-B6 sensor
 *
 * Posts realistic telemetry batches to the backend every SEND_INTERVAL seconds.
 * Useful for testing the full app flow without the physical device.
 *
 * Usage:
 *   node tools/iot-simulator.js
 *
 * Environment / Configuration (edit below or use env vars):
 *   SERVER_URL   – backend base URL        (default http://localhost:8080)
 *   DEVICE_CODE  – device code in the DB   (default BV-ESP32-01)
 *   DEVICE_TOKEN – plain-text API token you received when creating the device
 *
 * The simulator generates 1 record/second.  Every SEND_INTERVAL seconds it
 * bundles them into a batch and POSTs to /api/v1/telemetry/batch.
 */

const SERVER_URL = process.env.SERVER_URL || "http://localhost:8080";
const DEVICE_CODE = process.env.DEVICE_CODE || "BV-ESP32-01";
const DEVICE_TOKEN = process.env.DEVICE_TOKEN || "";

const SEND_INTERVAL_SEC = 30; // send a batch every 30 seconds
const SAMPLE_INTERVAL_SEC = 1; // one reading per second

// ─── Flow simulation parameters ────────────────────────────────────────
// Simulates typical household water usage patterns:
//   - idle periods (no flow)
//   - taps / short bursts (1-5 L/min for 10-30 sec)
//   - showers (6-12 L/min for 120-300 sec)

const STATES = {
    IDLE: "idle",
    TAP: "tap",
    SHOWER: "shower",
};

let currentState = STATES.IDLE;
let stateRemainingSeconds = 0;
let cumulativeVolumeL = 0;
let baseFlowLpm = 0;

function pickNextState() {
    const roll = Math.random();
    if (roll < 0.55) {
        // 55 % chance → idle for 5-60 seconds
        currentState = STATES.IDLE;
        stateRemainingSeconds = randomInt(5, 60);
        baseFlowLpm = 0;
    } else if (roll < 0.88) {
        // 33 % chance → tap burst for 10-30 seconds
        currentState = STATES.TAP;
        stateRemainingSeconds = randomInt(10, 30);
        baseFlowLpm = randomFloat(1.0, 5.0);
    } else {
        // 12 % chance → shower for 120-300 seconds
        currentState = STATES.SHOWER;
        stateRemainingSeconds = randomInt(120, 300);
        baseFlowLpm = randomFloat(6.0, 12.0);
    }
}

function sampleFlow() {
    if (stateRemainingSeconds <= 0) {
        pickNextState();
    }

    stateRemainingSeconds -= SAMPLE_INTERVAL_SEC;

    let flowLpm = baseFlowLpm;
    if (flowLpm > 0) {
        // Add small random noise ±5 %
        flowLpm *= 1 + (Math.random() - 0.5) * 0.1;
    }

    const volumeDeltaL = (flowLpm / 60) * SAMPLE_INTERVAL_SEC;
    cumulativeVolumeL += volumeDeltaL;

    return {
        flow_rate_lpm: round(flowLpm, 3),
        volume_delta_l: round(volumeDeltaL, 4),
        cumulative_volume_l: round(cumulativeVolumeL, 4),
    };
}

// ─── Buffer & send ─────────────────────────────────────────────────────

const buffer = [];

function collectSample() {
    const now = new Date();
    const sample = sampleFlow();

    buffer.push({
        measured_at: now.toISOString(),
        flow_rate_lpm: sample.flow_rate_lpm,
        volume_delta_l: sample.volume_delta_l,
        cumulative_volume_l: sample.cumulative_volume_l,
    });
}

async function sendBatch() {
    if (buffer.length === 0) {
        log("No samples in buffer, skipping send");
        return;
    }

    const records = buffer.splice(0, buffer.length);
    const payload = {
        device_code: DEVICE_CODE,
        records,
    };

    log(
        `Sending batch: ${records.length} records  ` +
            `(state=${currentState}, cumulative=${round(cumulativeVolumeL, 2)} L)`
    );

    try {
        const resp = await fetch(`${SERVER_URL}/api/v1/telemetry/batch`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${DEVICE_TOKEN}`,
            },
            body: JSON.stringify(payload),
        });

        const body = await resp.json().catch(() => ({}));

        if (resp.ok) {
            log(
                `  ✅ inserted=${body.data?.inserted_count || 0}  ` +
                    `duplicates=${body.data?.duplicate_count || 0}  ` +
                    `alerts=${JSON.stringify(body.data?.alerts_triggered || [])}`
            );
        } else {
            log(`  ❌ ${resp.status} ${body.message || JSON.stringify(body)}`);
            // Put records back so they're retried next cycle
            buffer.unshift(...records);
        }
    } catch (err) {
        log(`  ❌ Network error: ${err.message}`);
        buffer.unshift(...records);
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

function round(value, decimals) {
    return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

function log(msg) {
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] ${msg}`);
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
    if (!DEVICE_TOKEN) {
        console.error(
            "ERROR: DEVICE_TOKEN is required.\n\n" +
                "You get this token when you create a device in the app or via API:\n" +
                "  curl -X POST http://localhost:8080/api/v1/devices \\\n" +
                '    -H "Authorization: Bearer <YOUR_JWT>" \\\n' +
                '    -H "Content-Type: application/json" \\\n' +
                '    -d \'{"device_code":"BV-ESP32-01","device_name":"Simulator Device"}\'\n\n' +
                "Then run:\n" +
                "  DEVICE_TOKEN=<the_api_token_from_response> node tools/iot-simulator.js\n"
        );
        process.exit(1);
    }

    log("╔═══════════════════════════════════════════════════╗");
    log("║       IoT Water Flow Simulator  🌊               ║");
    log("╠═══════════════════════════════════════════════════╣");
    log(`║  Server    : ${SERVER_URL}`);
    log(`║  Device    : ${DEVICE_CODE}`);
    log(`║  Interval  : sample ${SAMPLE_INTERVAL_SEC}s, send ${SEND_INTERVAL_SEC}s`);
    log("╚═══════════════════════════════════════════════════╝");
    log("");

    pickNextState();

    // Collect a sample every second
    setInterval(collectSample, SAMPLE_INTERVAL_SEC * 1000);

    // Send batch at configured interval
    setInterval(sendBatch, SEND_INTERVAL_SEC * 1000);

    // Also send the first batch sooner (after 5 seconds)
    setTimeout(sendBatch, 5000);

    log("Simulator running. Press Ctrl+C to stop.\n");
}

main();
