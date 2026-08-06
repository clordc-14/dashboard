import { cellText, normalizeComparable } from "./parser/normalizer.js";

const SURVEY_SHEET_NAME = "网站用表调研表";
const fieldAliases = {
  sequence: ["序号", "编号"],
  genericName: ["通用名", "品种名称", "药品名称"],
  tradeName: ["商品名"],
  companyName: ["厂牌", "厂家", "生产企业"],
  approvalDate: ["获批时间", "获批日期", "上市时间"],
  purchase: ["采购", "采购负责人"],
  landedInSichuan: ["落地四川", "是否落地四川"],
  southwestArchived: ["是否建档", "国药西南建档", "建档"],
  progress: ["最新进展", "引进进展", "进展"],
  isT1: ["是否t1", "t1"],
  isExclusive: ["是否独家", "独家"],
  purchaseRemark: ["采购备注", "备注"],
  businessContact: ["商务联系人"],
  salesContact: ["销售联系人"],
  isComplete: ["是否完善", "完善状态"]
};

const EMPTY_CONTACT = { businessContact: "", salesContact: "" };

export function buildResearchSurvey(workbook) {
  const sheet = workbook?.sheets?.find(
    (candidate) => normalizeComparable(candidate.name).replaceAll("—", "") === SURVEY_SHEET_NAME
  );
  if (!sheet) return null;

  const headerIndex = findHeaderRow(sheet.rows || []);
  if (headerIndex < 0) return null;

  const columns = buildColumnMap(sheet.rows[headerIndex]);
  if (!columns.genericName) return null;

  const brandContacts = {};
  const records = sheet.rows
    .slice(headerIndex + 1)
    .map((row, index) => createRecord(row, columns, index + headerIndex + 1))
    .filter((record) => record.genericName);

  records.forEach((record) => {
    const brandKey = normalizeComparable(record.companyName);
    if (!brandKey) return;
    const existing = brandContacts[brandKey] || { ...EMPTY_CONTACT };
    brandContacts[brandKey] = {
      businessContact: record.businessContact || existing.businessContact,
      salesContact: record.salesContact || existing.salesContact
    };
  });

  return {
    source: {
      sheetName: sheet.name,
      headerRow: headerIndex + 1,
      range: sheet.range || ""
    },
    records,
    brandContacts,
    updatedAt: new Date().toISOString()
  };
}

export function getSurveyMetrics(survey, currentUserName = "") {
  const records = survey?.records || [];
  const completeCount = records.filter((record) => isAffirmative(record.isComplete)).length;
  const normalizedUser = normalizePersonName(currentUserName);
  const ownedRecords = normalizedUser
    ? records.filter((record) => normalizePersonName(record.purchase) === normalizedUser)
    : [];

  return {
    totalCount: records.length,
    completeCount,
    incompleteCount: Math.max(records.length - completeCount, 0),
    currentUserPendingCount: ownedRecords.filter((record) => !isAffirmative(record.isComplete)).length,
    currentUserRecordCount: ownedRecords.length
  };
}

export function getSurveyProductName(record) {
  const genericName = cleanDisplayValue(record?.genericName);
  const tradeName = cleanDisplayValue(record?.tradeName);

  if (!tradeName) return genericName || "未命名品种";
  return `${genericName}[${tradeName}]`;
}

export function getBrandContacts(survey, record) {
  const brandKey = normalizeComparable(record?.companyName);
  const shared = brandKey ? survey?.brandContacts?.[brandKey] : null;
  return {
    businessContact: record?.businessContact || shared?.businessContact || "",
    salesContact: record?.salesContact || shared?.salesContact || ""
  };
}

export function updateResearchSurveyRecord(survey, recordId, changes) {
  if (!survey?.records?.length) return survey;

  const records = survey.records.map((record) =>
    record.id === recordId
      ? { ...record, ...changes, updatedAt: new Date().toISOString() }
      : record
  );
  const changedRecord = records.find((record) => record.id === recordId);
  const brandKey = normalizeComparable(changedRecord?.companyName);
  const brandContacts = { ...(survey.brandContacts || {}) };

  if (brandKey && changedRecord) {
    const existing = brandContacts[brandKey] || { ...EMPTY_CONTACT };
    brandContacts[brandKey] = {
      businessContact: changedRecord.businessContact || existing.businessContact,
      salesContact: changedRecord.salesContact || existing.salesContact
    };
  }

  return {
    ...survey,
    records,
    brandContacts,
    updatedAt: new Date().toISOString()
  };
}

export function isAffirmative(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return text === "是" || text === "yes" || text === "y" || text === "true" || text === "1" || text.startsWith("是，") || text.startsWith("是,");
}

export function isPlaceholderValue(value) {
  return !cleanDisplayValue(value);
}

function findHeaderRow(rows) {
  return rows.findIndex((row) => {
    const normalized = row.map((cell) => normalizeComparable(cellText(cell)));
    return normalized.some((value) => fieldAliases.genericName.includes(value)) && normalized.some((value) => fieldAliases.companyName.includes(value));
  });
}

function buildColumnMap(headerRow) {
  const columns = {};
  headerRow.forEach((cell, index) => {
    const normalized = normalizeComparable(cellText(cell));
    const field = Object.entries(fieldAliases).find(([, aliases]) => aliases.includes(normalized))?.[0];
    if (field && columns[field] === undefined) columns[field] = index;
  });
  return columns;
}

function createRecord(row, columns, rowIndex) {
  const values = Object.fromEntries(
    Object.entries(columns).map(([field, columnIndex]) => [field, cellText(row[columnIndex])])
  );
  const sequence = values.sequence || "";
  const id = `survey-${rowIndex}-${sequence || normalizeComparable(values.genericName) || "record"}`;

  return {
    id,
    sourceRow: rowIndex + 1,
    sequence,
    genericName: values.genericName || "",
    tradeName: values.tradeName || "",
    companyName: values.companyName || "",
    approvalDate: values.approvalDate || "",
    purchase: values.purchase || "",
    landedInSichuan: values.landedInSichuan || "",
    southwestArchived: values.southwestArchived || "",
    progress: values.progress || "",
    isT1: values.isT1 || "",
    isExclusive: values.isExclusive || "",
    purchaseRemark: values.purchaseRemark || "",
    businessContact: values.businessContact || "",
    salesContact: values.salesContact || "",
    isComplete: values.isComplete || "否",
    expectedLaunchTime: "",
    updatedAt: ""
  };
}

function cleanDisplayValue(value) {
  const text = String(value ?? "").trim();
  return ["/", "-", "无", "暂无", "nan", "null", "undefined"].includes(text.toLowerCase()) ? "" : text;
}

function normalizePersonName(value) {
  return cleanDisplayValue(value).replace(/\s+/g, "").toLowerCase();
}
