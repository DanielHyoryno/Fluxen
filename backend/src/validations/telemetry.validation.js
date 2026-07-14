const { z } = require("zod");

const createTelemetrySchema = z.object({
    device_code: z.string().min(3).max(50),
    measured_at: z.string().datetime(), // ISO
    flow_rate_lpm: z.number().nonnegative(),
    volume_delta_l: z.number().nonnegative(),
    cumulative_volume_l: z.number().nonnegative().optional(),
    pulse_count: z.number().int().nonnegative().optional(),
    battery_voltage: z.number().nonnegative().optional(),
    rssi_dbm: z.number().int().optional(),
});

const telemetryRecordSchema = z.object({
    measured_at: z.string().datetime(),
    flow_rate_lpm: z.number().nonnegative(),
    volume_delta_l: z.number().nonnegative(),
    cumulative_volume_l: z.number().nonnegative().optional(),
    pulse_count: z.number().int().nonnegative().optional(),
    battery_voltage: z.number().nonnegative().optional(),
    rssi_dbm: z.number().int().optional(),
});

const createTelemetryBatchSchema = z.object({
    device_code: z.string().min(3).max(50),
    records: z.array(telemetryRecordSchema).min(1).max(600),
});

module.exports = { createTelemetrySchema, createTelemetryBatchSchema };
