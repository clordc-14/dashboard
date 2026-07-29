const CATEGORY_DEFINITIONS = [
  { key: "narcotic", title: "麻醉药品", color: "#4776d0" },
  { key: "psychotropic-one", title: "第一类精神药品", color: "#55b947" },
  { key: "psychotropic-two", title: "第二类精神药品", color: "#31bdb5" }
];

const MASTER_SHEET_NAME = "网站用表麻精";
const SALES_SHEET_NAME = "麻精销售表按类别分";
const UNARCHIVED_SHEET_NAME = "未建档管理";

export function buildControlledDrugDashboard(workbook) {
  const masterSheet = findSheet(workbook, MASTER_SHEET_NAME);
  if (!masterSheet) return null;

  const masterTable = readSheetTable(masterSheet, ["序号", "中文名", "分类"]);
  const masterRows = masterTable.rows.filter((row) => {
    return getCell(row, "序号") && getCategoryDefinition(getCell(row, "分类"));
  });

  if (!masterRows.length) return null;

  const unarchivedTable = readSheetTable(findSheet(workbook, UNARCHIVED_SHEET_NAME), ["中文名", "分类"]);
  const unarchivedByName = buildUnarchivedMap(unarchivedTable.rows);
  const salesTable = readSheetTable(findSheet(workbook, SALES_SHEET_NAME), ["品名", "分类"]);
  const annualSales = findAnnualSalesColumns(masterTable.headers, "西南销售");
  const salesPeriods = buildSalesPeriods(masterRows, annualSales);
  const overviewSales = salesPeriods.find((period) => period.year === 2025) || salesPeriods.at(-1) || null;
  const latestSalesColumn = getLatestPopulatedSalesColumn(salesTable.headers, salesTable.rows);

  const categories = CATEGORY_DEFINITIONS.map((definition) => {
    const categoryRows = masterRows.filter((row) => getCell(row, "分类") === definition.title);
    const domesticRows = categoryRows.filter((row) => isExactYes(getCell(row, "是否有上市药品")));
    const archivedRows = categoryRows.filter((row) => isExactYes(getCell(row, "是否建档")));
    const unarchived = domesticRows
      .filter((row) => isExactNo(getCell(row, "是否建档")))
      .map((row) => {
        const name = getCell(row, "中文名");
        return {
          name,
          management: unarchivedByName.get(normalizeName(name)) || []
        };
      });
    const topProducts = getTopProducts(salesTable.rows, definition.title, latestSalesColumn);
    const archivedCount = archivedRows.length;
    const domesticCount = domesticRows.length;

    return {
      ...definition,
      catalogCount: categoryRows.length,
      domesticCount,
      archivedCount,
      archiveRate: getPercent(archivedCount, domesticCount),
      unarchived,
      topProducts,
      topSalesYear: latestSalesColumn?.year || null
    };
  });

  const archivedCount = masterRows.filter((row) => isExactYes(getCell(row, "是否建档"))).length;
  const marketedCount = masterRows.filter((row) => isExactYes(getCell(row, "是否有上市药品"))).length;

  return {
    overview: {
      catalogCount: masterRows.length,
      marketedCount,
      archivedCount,
      archiveRate: getPercent(archivedCount, marketedCount),
      salesYear: overviewSales?.year || 2025,
      salesTotal: overviewSales?.total || 0
    },
    categories,
    salesPeriods
  };
}

function findSheet(workbook, targetName) {
  if (!workbook?.sheets?.length) return null;
  return workbook.sheets.find((sheet) => normalizeHeader(sheet.name) === targetName) || null;
}

function readSheetTable(sheet, requiredHeaders) {
  if (!sheet?.rows?.length) return { headers: [], rows: [] };

  const headerIndex = sheet.rows.findIndex((row) =>
    requiredHeaders.every((header) => row.some((cell) => normalizeHeader(cell?.value) === normalizeHeader(header)))
  );
  if (headerIndex < 0) return { headers: [], rows: [] };

  const headers = sheet.rows[headerIndex].map((cell, index) => ({
    key: normalizeHeader(cell?.value),
    index
  }));

  const rows = sheet.rows.slice(headerIndex + 1).map((cells) => ({ cells, headers }));
  return { headers, rows };
}

function getCell(row, label) {
  const key = normalizeHeader(label);
  const column = row?.headers?.find((header) => header.key === key);
  return String(column ? row.cells[column.index]?.value ?? "" : "").trim();
}

function findAnnualSalesColumns(headers, prefix = "") {
  return headers
    .map((header) => {
      const match = header.key.match(new RegExp(`^${prefix}(20\\d{2})$`));
      return match ? { ...header, year: Number(match[1]) } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.year - right.year);
}

function buildSalesPeriods(rows, columns) {
  return columns
    .map((column) => {
      const hasValues = rows.some((row) => getCellByColumn(row, column) !== "");
      if (!hasValues) return null;

      const values = Object.fromEntries(
        CATEGORY_DEFINITIONS.map((category) => [
          category.key,
          sumRows(rows.filter((row) => getCell(row, "分类") === category.title), column)
        ])
      );
      return {
        year: column.year,
        values,
        total: Object.values(values).reduce((sum, value) => sum + value, 0)
      };
    })
    .filter(Boolean);
}

function getLatestPopulatedSalesColumn(headers, rows) {
  const columns = headers
    .map((header) => {
      const match = header.key.match(/^(20\d{2})销售$/);
      return match ? { ...header, year: Number(match[1]) } : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.year - left.year);

  return columns.find((column) => rows.some((row) => getCellByColumn(row, column) !== "")) || null;
}

function getTopProducts(rows, category, salesColumn) {
  if (!salesColumn) return [];

  return rows
    .filter((row) => getCell(row, "分类") === category && getCell(row, "品名"))
    .map((row) => ({
      name: getCell(row, "品名"),
      indication: getCell(row, "适应症"),
      sales: toNumber(getCellByColumn(row, salesColumn))
    }))
    .sort((left, right) => right.sales - left.sales)
    .slice(0, 5);
}

function buildUnarchivedMap(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const name = getCell(row, "中文名");
    const category = getCategoryDefinition(getCell(row, "分类"));
    if (!name || !category) return;

    const details = map.get(normalizeName(name)) || [];
    details.push({
      product: getCell(row, "品种"),
      status: getCell(row, "品种说明")
    });
    map.set(normalizeName(name), details);
  });
  return map;
}

function getCellByColumn(row, column) {
  const cell = row?.cells?.[column?.index];
  return String(cell?.rawValue ?? cell?.value ?? "").trim();
}

function sumRows(rows, column) {
  return rows.reduce((sum, row) => sum + toNumber(getCellByColumn(row, column)), 0);
}

function getCategoryDefinition(title) {
  return CATEGORY_DEFINITIONS.find((category) => category.title === title) || null;
}

function getPercent(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 100) : 0;
}

function isExactYes(value) {
  return ["是", "yes", "y", "true", "1", "√"].includes(String(value ?? "").trim().toLowerCase());
}

function isExactNo(value) {
  return ["否", "no", "n", "false", "0"].includes(String(value ?? "").trim().toLowerCase());
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\s——_()（）]/g, "")
    .toLowerCase();
}

function normalizeName(value) {
  return normalizeHeader(value).replace(/[＊*]/g, "");
}

function toNumber(value) {
  const normalized = String(value ?? "").replace(/[,，\s]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}
