const MASTER_SHEET_NAME = "6年上市罕见病用药";

const REQUIRED_HEADERS = ["通用名", "厂牌", "适应症简写", "初次获批时间"];

export function buildRareDiseaseDashboard(workbook) {
  const masterSheet = findSheet(workbook, MASTER_SHEET_NAME);
  if (!masterSheet) return null;

  const table = readSheetTable(masterSheet, REQUIRED_HEADERS);
  const salesColumns = findAnnualSalesColumns(table.headers);
  const records = table.rows
    .map((row, index) => recordFromWorkbookRow(row, salesColumns, index))
    .filter((record) => record.genericName && record.approvalYear);

  if (!records.length) return null;

  return {
    ...buildRareDiseaseDashboardFromRecords(records),
    sourceSheetName: masterSheet.name
  };
}

export function buildRareDiseaseDashboardFromRecords(records) {
  const normalizedRecords = records.map(normalizeRecord).filter((record) => record.genericName && record.approvalYear);
  const approvalYears = uniqueSorted(normalizedRecords.map((record) => record.approvalYear));
  const salesYears = uniqueSorted(normalizedRecords.flatMap((record) => Object.keys(record.sales).map(Number)));
  const analysisYears = uniqueSorted([...approvalYears, ...salesYears]);
  const overviewYear = approvalYears.at(-1) || new Date().getFullYear();
  const trendYears = analysisYears;
  const trend = trendYears.map((year) => {
    const approvedRecords = normalizedRecords.filter((record) => record.approvalYear === year);
    return {
      year,
      drugCount: approvedRecords.length,
      archivedCount: approvedRecords.filter((record) => record.archived).length,
      sales: sum(normalizedRecords.map((record) => record.sales[year]))
    };
  });
  const overviewRecords = normalizedRecords.filter((record) => record.approvalYear === overviewYear);
  const overviewArchived = overviewRecords.filter((record) => record.archived).length;

  return {
    overview: {
      year: overviewYear,
      approvedCount: overviewRecords.length,
      archivedCount: overviewArchived,
      archiveRate: getPercent(overviewArchived, overviewRecords.length),
      salesTotal: sum(normalizedRecords.map((record) => record.sales[overviewYear]))
    },
    records: normalizedRecords,
    trend,
    salesYears,
    analysisYears,
    defaultAnalysisYear: [...salesYears].reverse().find((year) => sum(normalizedRecords.map((record) => record.sales[year])) > 0) || overviewYear
  };
}

export function getRareDiseaseYearAnalysis(dashboard, selectedYear) {
  const year = Number(selectedYear);
  const records = dashboard?.records || [];
  const indicationMap = new Map();
  const brandMap = new Map();

  records.forEach((record) => {
    const indicationName = record.indicationShort || "未标注适应症";
    const indicationEntry = indicationMap.get(indicationName) || {
      name: indicationName,
      sales: 0,
      records: []
    };
    indicationEntry.sales += Number(record.sales[year] || 0);
    indicationEntry.records.push(record);
    indicationMap.set(indicationName, indicationEntry);

    const brandName = record.brand || "未标注厂牌";
    const brandEntry = brandMap.get(brandName) || {
      name: brandName,
      approvalCount: 0,
      sales: 0,
      records: []
    };
    if (record.approvalYear === year) brandEntry.approvalCount += 1;
    brandEntry.sales += Number(record.sales[year] || 0);
    brandEntry.records.push(record);
    brandMap.set(brandName, brandEntry);
  });

  const indications = [...indicationMap.values()]
    .filter((entry) => entry.sales > 0)
    .sort((left, right) => right.sales - left.sales || left.name.localeCompare(right.name, "zh-CN"));
  const brands = [...brandMap.values()];

  return {
    year,
    indications,
    indicationTotal: sum(indications.map((entry) => entry.sales)),
    approvalBrands: brands
      .filter((entry) => entry.approvalCount > 0)
      .sort((left, right) => right.approvalCount - left.approvalCount || left.name.localeCompare(right.name, "zh-CN")),
    salesBrands: brands
      .filter((entry) => entry.sales > 0)
      .sort((left, right) => right.sales - left.sales || left.name.localeCompare(right.name, "zh-CN"))
  };
}

function recordFromWorkbookRow(row, salesColumns, index) {
  const sales = Object.fromEntries(salesColumns.map((column) => [column.year, toNumber(getCellByColumn(row, column))]));
  const approvalDate = getCell(row, "初次获批时间");
  return {
    id: getCell(row, "序号") || `rare-disease-${index + 1}`,
    genericName: getCell(row, "通用名"),
    productName: getCell(row, "商品名"),
    southwestName: getCell(row, "西南名称"),
    brand: getCell(row, "厂牌"),
    indicationShort: getCell(row, "适应症简写"),
    indication: getCell(row, "适应症"),
    target: getCell(row, "靶点"),
    approvalDate,
    approvalYear: getApprovalYear(approvalDate),
    archived: isExactYes(getCell(row, "是否建档")),
    sales
  };
}

function normalizeRecord(record) {
  const sales = Object.fromEntries(
    Object.entries(record.sales || {})
      .filter(([year]) => /^20\d{2}$/.test(year))
      .map(([year, value]) => [Number(year), toNumber(value)])
  );
  const approvalDate = String(record.approvalDate ?? "").trim();
  return {
    id: String(record.id ?? record.genericName ?? "").trim(),
    genericName: String(record.genericName ?? "").trim(),
    productName: String(record.productName ?? "").trim(),
    southwestName: String(record.southwestName ?? "").trim(),
    brand: String(record.brand ?? "").trim(),
    indicationShort: String(record.indicationShort ?? "").trim(),
    indication: String(record.indication ?? "").trim(),
    target: String(record.target ?? "").trim(),
    approvalDate,
    approvalYear: getApprovalYear(approvalDate),
    archived: Boolean(record.archived) || isExactYes(record.archived),
    sales
  };
}

function findSheet(workbook, targetName) {
  if (!workbook?.sheets?.length) return null;
  const normalizedTarget = normalizeHeader(targetName);
  return workbook.sheets.find((sheet) => normalizeHeader(sheet.name) === normalizedTarget) || null;
}

function readSheetTable(sheet, requiredHeaders) {
  if (!sheet?.rows?.length) return { headers: [], rows: [] };
  const headerIndex = sheet.rows.findIndex((row) =>
    requiredHeaders.every((header) => row.some((cell) => normalizeHeader(cell?.value) === normalizeHeader(header)))
  );
  if (headerIndex < 0) return { headers: [], rows: [] };

  const headers = sheet.rows[headerIndex].map((cell, index) => ({ key: normalizeHeader(cell?.value), index }));
  return {
    headers,
    rows: sheet.rows.slice(headerIndex + 1).map((cells) => ({ cells, headers }))
  };
}

function findAnnualSalesColumns(headers) {
  return headers
    .map((header) => {
      const match = header.key.match(/^(20\d{2})销售$/);
      return match ? { ...header, year: Number(match[1]) } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.year - right.year);
}

function getCell(row, label) {
  const key = normalizeHeader(label);
  const column = row?.headers?.find((header) => header.key === key);
  return String(column ? row.cells[column.index]?.value ?? "" : "").trim();
}

function getCellByColumn(row, column) {
  const cell = row?.cells?.[column?.index];
  return cell?.rawValue ?? cell?.value ?? "";
}

function getApprovalYear(value) {
  const match = String(value ?? "").match(/(20\d{2})/);
  return match ? Number(match[1]) : 0;
}

function getPercent(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 100) : 0;
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => Number.isFinite(Number(value))).map(Number))].sort((left, right) => left - right);
}

function sum(values) {
  return values.reduce((total, value) => total + toNumber(value), 0);
}

function toNumber(value) {
  const normalized = String(value ?? "").replace(/[,，\s]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function isExactYes(value) {
  return ["是", "yes", "y", "true", "1", "√"].includes(String(value ?? "").trim().toLowerCase());
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\s—_()（）]/g, "")
    .toLowerCase();
}
