const { createTelemetrySchema, createTelemetryBatchSchema } = require("../validations/telemetry.validation");
const ExcelJS = require("exceljs");
const {
  createTelemetry,
  createTelemetryBatch,
  getLatestTelemetry,
  getDailyTelemetry,
  getUsageHistory,
  getExportData,
} = require("../services/telemetry.service");
const { ok, fail } = require("../utils/response");
const { formatBusinessDateTime, toBusinessDateKey } = require("../utils/datetime");

async function postTelemetry(req, res) {
  try {
    const parsed = createTelemetrySchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.issues[0]?.message || "Invalid payload", 422, "VALIDATION_ERROR");
    }

    const result = await createTelemetry(parsed.data);
    return ok(res, result, "Telemetry ingested", 201);
  } catch (err) {
    if (err.message === "DEVICE_NOT_FOUND") {
      return fail(res, "Device not found", 404, "DEVICE_NOT_FOUND");
    }
    if (err.code === "23505") {
      return fail(res, "Duplicate measurement timestamp for this device", 409, "DUPLICATE_TELEMETRY");
    }
    console.error("postTelemetry error:", err);
    return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
  }
}

async function postTelemetryBatch(req, res) {
  try {
    const parsed = createTelemetryBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.issues[0]?.message || "Invalid payload", 422, "VALIDATION_ERROR");
    }

    const result = await createTelemetryBatch(parsed.data);
    return ok(res, result, "Telemetry batch ingested", 201);
  } catch (err) {
    if (err.message === "DEVICE_NOT_FOUND") {
      return fail(res, "Device not found", 404, "DEVICE_NOT_FOUND");
    }
    console.error("postTelemetryBatch error:", err);
    return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
  }
}

async function latestTelemetry(req, res) {
  try {
    const { device_code } = req.query;
    if (!device_code) return fail(res, "device_code is required", 422, "VALIDATION_ERROR");

    const data = await getLatestTelemetry(req.user.id, device_code);
    if (!data) return fail(res, "No telemetry found", 404, "NOT_FOUND");

    return ok(res, data, "Latest telemetry");
  } catch (err) {
    if (err.message === "DEVICE_NOT_FOUND") {
      return fail(res, "Device not found", 404, "DEVICE_NOT_FOUND");
    }
    console.error("latestTelemetry error:", err);
    return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
  }
}

async function dailyTelemetry(req, res) {
  try {
    const { device_code, date } = req.query;
    if (!device_code || !date) {
      return fail(res, "device_code and date are required", 422, "VALIDATION_ERROR");
    }

    const data = await getDailyTelemetry(req.user.id, device_code, date);
    return ok(res, { device_code, date, items: data }, "Daily telemetry");
  } catch (err) {
    if (err.message === "DEVICE_NOT_FOUND") {
      return fail(res, "Device not found", 404, "DEVICE_NOT_FOUND");
    }
    console.error("dailyTelemetry error:", err);
    return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
  }
}

async function usageHistory(req, res) {
  try {
    const { device_code, from, to } = req.query;
    if (!device_code || !from || !to) {
      return fail(res, "device_code, from, and to are required", 422, "VALIDATION_ERROR");
    }

    const data = await getUsageHistory(req.user.id, device_code, from, to);
    return ok(res, { device_code, from, to, items: data }, "Usage history");
  } catch (err) {
    if (err.message === "DEVICE_NOT_FOUND") {
      return fail(res, "Device not found", 404, "DEVICE_NOT_FOUND");
    }
    console.error("usageHistory error:", err);
    return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
  }
}

async function exportCsv(req, res) {
  try {
    const { device_code, from, to } = req.query;
    if (!device_code || !from || !to) {
      return fail(res, "device_code, from, and to are required", 422, "VALIDATION_ERROR");
    }

    const rows = await getExportData(req.user.id, device_code, from, to);

    const header = "measured_at_utc,measured_at_wib,flow_rate_lpm,volume_delta_l,cumulative_volume_l,pulse_count,battery_voltage,rssi_dbm";
    const csvLines = rows.map((r) =>
      [
        r.measured_at ? new Date(r.measured_at).toISOString() : "",
        r.measured_at ? formatBusinessDateTime(r.measured_at) : "",
        r.flow_rate_lpm ?? "",
        r.volume_delta_l ?? "",
        r.cumulative_volume_l ?? "",
        r.pulse_count ?? "",
        r.battery_voltage ?? "",
        r.rssi_dbm ?? "",
      ].join(",")
    );

    const csv = [header, ...csvLines].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${device_code}_${from}_${to}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    if (err.message === "DEVICE_NOT_FOUND") {
      return fail(res, "Device not found", 404, "DEVICE_NOT_FOUND");
    }
    console.error("exportCsv error:", err);
    return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
  }
}

async function exportXlsx(req, res) {
  try {
    const { device_code, from, to } = req.query;
    if (!device_code || !from || !to) {
      return fail(res, "device_code, from, and to are required", 422, "VALIDATION_ERROR");
    }

    const rows = await getExportData(req.user.id, device_code, from, to);

    const totalUsageLiters = rows.reduce((sum, row) => sum + Number(row.volume_delta_l || 0), 0);
    const readingCount = rows.length;
    const uniqueDayKeys = [...new Set(rows.map((row) => (row.measured_at ? toBusinessDateKey(row.measured_at) : "")).filter(Boolean))];
    const dayCount = uniqueDayKeys.length || 1;
    const averagePerDay = totalUsageLiters / dayCount;

    const dailyUsageMap = rows.reduce((acc, row) => {
      if (!row.measured_at) return acc;
      const dayKey = toBusinessDateKey(row.measured_at);
      acc[dayKey] = Number(acc[dayKey] || 0) + Number(row.volume_delta_l || 0);
      return acc;
    }, {});

    const dailyUsageItems = Object.entries(dailyUsageMap)
      .map(([date, totalLiters]) => ({ date, totalLiters: Number(totalLiters) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const peakDay = dailyUsageItems.reduce(
      (max, item) => (item.totalLiters > max.totalLiters ? item : max),
      dailyUsageItems[0] || { date: "-", totalLiters: 0 }
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Fluxen";
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet("Summary", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    summarySheet.columns = [
      { header: "Field", key: "field", width: 24 },
      { header: "Value", key: "value", width: 28 },
    ];
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.addRows([
      { field: "Device Code", value: device_code },
      { field: "From", value: from },
      { field: "To", value: to },
      { field: "Total Usage (L)", value: totalUsageLiters },
      { field: "Average / Day (L)", value: averagePerDay },
      { field: "Peak Day", value: peakDay.date },
      { field: "Peak Day Usage (L)", value: peakDay.totalLiters },
      { field: "Record Count", value: readingCount },
    ]);
    [4, 5, 7].forEach((rowNumber) => {
      summarySheet.getCell(`B${rowNumber}`).numFmt = "0.000";
    });

    const dailyUsageSheet = workbook.addWorksheet("Daily Usage", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    dailyUsageSheet.columns = [
      { header: "Date", key: "date", width: 16 },
      { header: "Total Usage (L)", key: "total_usage_l", width: 18 },
    ];
    dailyUsageSheet.getRow(1).font = { bold: true };
    dailyUsageItems.forEach((item) => {
      dailyUsageSheet.addRow({
        date: item.date,
        total_usage_l: item.totalLiters,
      });
    });
    dailyUsageSheet.getColumn("total_usage_l").numFmt = "0.000";

    const worksheet = workbook.addWorksheet("Raw Measurements", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    worksheet.columns = [
      { header: "Measured At (WIB)", key: "measured_at", width: 26 },
      { header: "Flow Rate (L/min)", key: "flow_rate_lpm", width: 18 },
      { header: "Volume Delta (L)", key: "volume_delta_l", width: 18 },
      { header: "Cumulative Volume (L)", key: "cumulative_volume_l", width: 20 },
      { header: "Pulse Count", key: "pulse_count", width: 14 },
      { header: "Battery Voltage", key: "battery_voltage", width: 16 },
      { header: "RSSI (dBm)", key: "rssi_dbm", width: 12 },
    ];

    worksheet.getRow(1).font = { bold: true };

    rows.forEach((row) => {
      worksheet.addRow({
        measured_at: row.measured_at ? formatBusinessDateTime(row.measured_at) : null,
        flow_rate_lpm: row.flow_rate_lpm === null ? null : Number(row.flow_rate_lpm),
        volume_delta_l: row.volume_delta_l === null ? null : Number(row.volume_delta_l),
        cumulative_volume_l: row.cumulative_volume_l === null ? null : Number(row.cumulative_volume_l),
        pulse_count: row.pulse_count ?? null,
        battery_voltage: row.battery_voltage === null ? null : Number(row.battery_voltage),
        rssi_dbm: row.rssi_dbm ?? null,
      });
    });

    ["flow_rate_lpm", "volume_delta_l", "cumulative_volume_l", "battery_voltage"].forEach((key) => {
      worksheet.getColumn(key).numFmt = "0.000";
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${device_code}_${from}_${to}.xlsx"`);

    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    if (err.message === "DEVICE_NOT_FOUND") {
      return fail(res, "Device not found", 404, "DEVICE_NOT_FOUND");
    }
    console.error("exportXlsx error:", err);
    return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
  }
}

module.exports = {
  postTelemetry,
  postTelemetryBatch,
  latestTelemetry,
  dailyTelemetry,
  usageHistory,
  exportCsv,
  exportXlsx,
};
