const ExcelJS = require("exceljs");
const { formatBusinessDateTime } = require("../utils/datetime");

const COLORS = {
    navy: "FF0F2747",
    blue: "FF2563EB",
    lightBlue: "FFEFF6FF",
    lightGreen: "FFECFDF5",
    lightAmber: "FFFFF7ED",
    slate: "FF475569",
    lightSlate: "FFF1F5F9",
    border: "FFCBD5E1",
    white: "FFFFFFFF",
};

function toExcelDate(dateKey) {
    return new Date(`${dateKey}T00:00:00.000Z`);
}

function toExcelBusinessDateTime(value) {
    const formatted = formatBusinessDateTime(value);
    const [datePart, timePart] = formatted.replace(" WIB", "").split(" ");
    return new Date(`${datePart}T${timePart}.000Z`);
}

function normalizeDailyRows(rows) {
    return (Array.isArray(rows) ? rows : [])
        .map((row) => ({
            date: String(row.date || "").slice(0, 10),
            categoryName: row.category_name || "Uncategorized",
            deviceName: row.device_name || "-",
            deviceCode: row.device_code || "-",
            totalLiters: Number(row.total_liters || 0),
            averageFlowRate: Number(row.avg_flow_rate_lpm || 0),
            peakFlowRate: Number(row.peak_flow_rate_lpm || 0),
            readingCount: Number(row.reading_count || 0),
        }))
        .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date))
        .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateDailyRows(rows) {
    const totalUsageLiters = rows.reduce((sum, row) => sum + row.totalLiters, 0);
    const readingCount = rows.reduce((sum, row) => sum + row.readingCount, 0);
    const weightedFlowTotal = rows.reduce(
        (sum, row) => sum + row.averageFlowRate * row.readingCount,
        0
    );
    const peakDay = rows.reduce(
        (max, row) => (row.totalLiters > max.totalLiters ? row : max),
        rows[0] || { date: "-", totalLiters: 0 }
    );

    return {
        totalUsageLiters,
        averagePerDay: rows.length > 0 ? totalUsageLiters / rows.length : 0,
        averageFlowRate: readingCount > 0 ? weightedFlowTotal / readingCount : 0,
        peakFlowRate: rows.reduce((max, row) => Math.max(max, row.peakFlowRate), 0),
        readingCount,
        peakDay,
        dayCount: rows.length,
    };
}

function buildOverviewRows(rows) {
    const monthKeys = new Set(rows.map((row) => row.date.slice(0, 7)));
    if (monthKeys.size <= 1) {
        return {
            label: "Daily Usage Overview",
            periodFormat: "yyyy-mm-dd",
            items: rows.map((row) => ({
                period: toExcelDate(row.date),
                totalLiters: row.totalLiters,
                averageFlowRate: row.averageFlowRate,
                peakFlowRate: row.peakFlowRate,
                readingCount: row.readingCount,
            })),
        };
    }

    const monthlyMap = new Map();
    for (const row of rows) {
        const monthKey = row.date.slice(0, 7);
        const item = monthlyMap.get(monthKey) || {
            period: new Date(`${monthKey}-01T00:00:00.000Z`),
            totalLiters: 0,
            weightedFlowTotal: 0,
            peakFlowRate: 0,
            readingCount: 0,
        };
        item.totalLiters += row.totalLiters;
        item.weightedFlowTotal += row.averageFlowRate * row.readingCount;
        item.peakFlowRate = Math.max(item.peakFlowRate, row.peakFlowRate);
        item.readingCount += row.readingCount;
        monthlyMap.set(monthKey, item);
    }

    return {
        label: "Monthly Usage Overview",
        periodFormat: "mmmm yyyy",
        items: [...monthlyMap.values()].map((item) => ({
            ...item,
            averageFlowRate: item.readingCount > 0 ? item.weightedFlowTotal / item.readingCount : 0,
        })),
    };
}

function styleSectionTitle(sheet, range, title) {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(":")[0]);
    cell.value = title;
    cell.font = { name: "Aptos Display", size: 12, bold: true, color: { argb: COLORS.navy } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.lightSlate } };
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: COLORS.border } } };
}

function addKpiCard(sheet, columns, label, value, numberFormat, fillColor) {
    const [startColumn, endColumn] = columns;
    sheet.mergeCells(`${startColumn}7:${endColumn}7`);
    sheet.mergeCells(`${startColumn}8:${endColumn}9`);
    const labelCell = sheet.getCell(`${startColumn}7`);
    const valueCell = sheet.getCell(`${startColumn}8`);

    labelCell.value = label;
    labelCell.font = { name: "Aptos", size: 10, bold: true, color: { argb: COLORS.slate } };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    valueCell.value = value;
    valueCell.numFmt = numberFormat;
    valueCell.font = { name: "Aptos Display", size: 18, bold: true, color: { argb: COLORS.navy } };
    valueCell.alignment = { horizontal: "center", vertical: "middle" };

    for (const row of [7, 8, 9]) {
        const startNumber = sheet.getColumn(startColumn).number;
        const endNumber = sheet.getColumn(endColumn).number;
        for (let column = startNumber; column <= endNumber; column += 1) {
            sheet.getCell(row, column).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: fillColor },
            };
        }
    }
}

function addDashboardSheet(workbook, report, rows, metrics) {
    const sheet = workbook.addWorksheet("Dashboard", {
        views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
        properties: { defaultRowHeight: 20 },
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
    });
    [15, 20, 24, 16, 18, 16, 12, 12].forEach((width, index) => {
        sheet.getColumn(index + 1).width = width;
    });

    sheet.mergeCells("A1:H2");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "FLUXEN DAILY WATER RECORDS";
    titleCell.font = { name: "Aptos Display", size: 22, bold: true, color: { argb: COLORS.white } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
    titleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    sheet.getRow(1).height = 28;
    sheet.getRow(2).height = 14;

    sheet.getCell("A4").value = "Device Code";
    sheet.getCell("B4").value = report.deviceCode;
    sheet.getCell("D4").value = "Period";
    sheet.mergeCells("E4:F4");
    sheet.getCell("E4").value = `${report.from} to ${report.to}`;
    sheet.getCell("G4").value = "Timezone";
    sheet.getCell("H4").value = "WIB (UTC+7)";
    sheet.getCell("A5").value = "Category";
    sheet.getCell("B5").value = rows[0]?.categoryName || "-";
    sheet.getCell("D5").value = "Generated";
    sheet.getCell("E5").value = toExcelBusinessDateTime(report.generatedAt);
    sheet.getCell("E5").numFmt = "yyyy-mm-dd hh:mm:ss";
    sheet.mergeCells("G5:H5");
    sheet.getCell("G5").value = { text: "Open Daily Records", hyperlink: "#'Daily Records'!A1" };
    ["A4", "D4", "G4", "A5", "D5"].forEach((address) => {
        sheet.getCell(address).font = { bold: true, color: { argb: COLORS.slate } };
    });
    sheet.getCell("G5").font = { color: { argb: COLORS.blue }, underline: true };

    const dailyLastRow = Math.max(2, rows.length + 1);
    addKpiCard(
        sheet,
        ["A", "B"],
        "TOTAL USAGE",
        {
            formula: `SUM('Daily Records'!$E$2:$E$${dailyLastRow})`,
            result: metrics.totalUsageLiters,
        },
        '0.000 "L"',
        COLORS.lightBlue
    );
    addKpiCard(
        sheet,
        ["D", "E"],
        "DAILY AVERAGE",
        {
            formula: `IFERROR(AVERAGE('Daily Records'!$E$2:$E$${dailyLastRow}),0)`,
            result: metrics.averagePerDay,
        },
        '0.000 "L/day"',
        COLORS.lightGreen
    );
    addKpiCard(
        sheet,
        ["G", "H"],
        "PEAK DAY USAGE",
        {
            formula: `IFERROR(MAX('Daily Records'!$E$2:$E$${dailyLastRow}),0)`,
            result: metrics.peakDay.totalLiters,
        },
        '0.000 "L"',
        COLORS.lightAmber
    );

    styleSectionTitle(sheet, "A11:H11", "Flow and Recording Summary");
    sheet.getCell("A12").value = "Peak Day";
    sheet.getCell("B12").value = metrics.peakDay.date === "-" ? "-" : toExcelDate(metrics.peakDay.date);
    sheet.getCell("B12").numFmt = "yyyy-mm-dd";
    sheet.getCell("D12").value = "Average Flow";
    sheet.getCell("E12").value = {
        formula: `IFERROR(SUMPRODUCT('Daily Records'!$F$2:$F$${dailyLastRow},'Daily Records'!$H$2:$H$${dailyLastRow})/SUM('Daily Records'!$H$2:$H$${dailyLastRow}),0)`,
        result: metrics.averageFlowRate,
    };
    sheet.getCell("E12").numFmt = '0.000 "L/min"';
    sheet.getCell("G12").value = "Peak Flow";
    sheet.getCell("H12").value = {
        formula: `IFERROR(MAX('Daily Records'!$G$2:$G$${dailyLastRow}),0)`,
        result: metrics.peakFlowRate,
    };
    sheet.getCell("H12").numFmt = '0.000 "L/min"';
    sheet.getCell("A13").value = "Readings";
    sheet.getCell("B13").value = {
        formula: `SUM('Daily Records'!$H$2:$H$${dailyLastRow})`,
        result: metrics.readingCount,
    };
    sheet.getCell("B13").numFmt = "#,##0";
    sheet.getCell("D13").value = "Days with Data";
    sheet.getCell("E13").value = metrics.dayCount;
    sheet.getCell("E13").numFmt = "#,##0";
    ["A12", "D12", "G12", "A13", "D13"].forEach((address) => {
        sheet.getCell(address).font = { bold: true, color: { argb: COLORS.slate } };
    });

    const overview = buildOverviewRows(rows);
    styleSectionTitle(sheet, "A15:H15", overview.label);
    ["Period", "Usage (L)", "Average Flow", "Peak Flow", "Readings"].forEach((value, index) => {
        const cell = sheet.getCell(16, index + 1);
        cell.value = value;
        cell.font = { bold: true, color: { argb: COLORS.white } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.blue } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    sheet.getRow(16).height = 32;

    overview.items.forEach((item, index) => {
        const rowNumber = 17 + index;
        sheet.getCell(`A${rowNumber}`).value = item.period;
        sheet.getCell(`A${rowNumber}`).numFmt = overview.periodFormat;
        sheet.getCell(`B${rowNumber}`).value = item.totalLiters;
        sheet.getCell(`C${rowNumber}`).value = item.averageFlowRate;
        sheet.getCell(`D${rowNumber}`).value = item.peakFlowRate;
        sheet.getCell(`E${rowNumber}`).value = item.readingCount;
        ["B", "C", "D"].forEach((column) => {
            sheet.getCell(`${column}${rowNumber}`).numFmt = "0.000";
        });
        sheet.getCell(`E${rowNumber}`).numFmt = "#,##0";
    });

    if (overview.items.length > 0) {
        const lastOverviewRow = 16 + overview.items.length;
        sheet.addConditionalFormatting({
            ref: `B17:B${lastOverviewRow}`,
            rules: [
                {
                    type: "colorScale",
                    cfvo: [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }],
                    color: [{ argb: COLORS.lightBlue }, { argb: "FF93C5FD" }, { argb: COLORS.blue }],
                },
            ],
        });
        sheet.autoFilter = { from: "A16", to: `E${lastOverviewRow}` };
    } else {
        sheet.mergeCells("A17:E17");
        sheet.getCell("A17").value = "No measurements were recorded in the selected period.";
        sheet.getCell("A17").font = { italic: true, color: { argb: COLORS.slate } };
    }

    sheet.getCell("A48").value =
        "Tip: use the filters in Daily Records to narrow the report by date, category, or device.";
    sheet.mergeCells("A48:H48");
    sheet.getCell("A48").font = { italic: true, color: { argb: COLORS.slate } };
    sheet.getCell("A48").alignment = { wrapText: true };
    sheet.getRow(48).height = 30;
    sheet.headerFooter.oddFooter = "&LFluxen&CPage &P of &N&RGenerated in WIB";
    sheet.pageSetup.printArea = "A1:H48";
}

function addDailyRecordsSheet(workbook, rows) {
    const sheet = workbook.addWorksheet("Daily Records", {
        views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    [15, 20, 24, 20, 19, 23, 21, 15].forEach((width, index) => {
        sheet.getColumn(index + 1).width = width;
    });

    sheet.addTable({
        name: "DailyUsageTable",
        ref: "A1",
        headerRow: true,
        totalsRow: false,
        style: { theme: "TableStyleMedium2", showRowStripes: true },
        columns: [
            { name: "Date" },
            { name: "Category" },
            { name: "Device Name" },
            { name: "Device Code" },
            { name: "Total Usage (L)" },
            { name: "Average Flow (L/min)" },
            { name: "Peak Flow (L/min)" },
            { name: "Reading Count" },
        ],
        rows: rows.map((row) => [
            toExcelDate(row.date),
            row.categoryName,
            row.deviceName,
            row.deviceCode,
            row.totalLiters,
            row.averageFlowRate,
            row.peakFlowRate,
            row.readingCount,
        ]),
    });
    sheet.getRow(1).height = 34;
    sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getColumn(1).numFmt = "yyyy-mm-dd";
    [5, 6, 7].forEach((column) => {
        sheet.getColumn(column).numFmt = "0.000";
    });
    sheet.getColumn(8).numFmt = "#,##0";

    if (rows.length > 0) {
        sheet.addConditionalFormatting({
            ref: `E2:E${rows.length + 1}`,
            rules: [
                {
                    type: "colorScale",
                    cfvo: [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }],
                    color: [{ argb: COLORS.lightBlue }, { argb: "FF93C5FD" }, { argb: COLORS.blue }],
                },
            ],
        });
    }
    sheet.headerFooter.oddHeader = "&LFluxen&CDaily Water Records&RWIB (UTC+7)";
    sheet.headerFooter.oddFooter = "&LDevice usage report&CPage &P of &N";
}

function buildTelemetryWorkbook({ deviceCode, from, to, rows, generatedAt = new Date() }) {
    const normalizedRows = normalizeDailyRows(rows);
    const metrics = aggregateDailyRows(normalizedRows);
    const report = { deviceCode, from, to, generatedAt };
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Fluxen";
    workbook.title = `Daily water records for ${deviceCode}`;
    workbook.subject = `Daily records from ${from} to ${to} in WIB`;
    workbook.created = generatedAt;
    workbook.modified = generatedAt;
    workbook.calcProperties.fullCalcOnLoad = true;
    workbook.calcProperties.forceFullCalc = true;

    addDashboardSheet(workbook, report, normalizedRows, metrics);
    addDailyRecordsSheet(workbook, normalizedRows);
    return workbook;
}

module.exports = {
    aggregateDailyRows,
    buildOverviewRows,
    buildTelemetryWorkbook,
    normalizeDailyRows,
};
