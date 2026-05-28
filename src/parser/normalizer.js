const fieldAliases = {
  sequence: ["sequence", "序号", "编号", "序"],
  title: ["title", "新闻标题", "标题", "信息标题", "重点标题", "新闻总览", "新闻内容"],
  summary: ["summary", "摘要", "内容", "重点内容", "新闻摘要", "信息内容", "说明", "新闻提炼"],
  sourceName: ["sourceName", "来源", "来源名称", "新闻来源", "媒体"],
  sourceUrl: ["sourceUrl", "链接", "原链接", "原文链接", "来源链接", "新闻源链接", "源地址", "url", "URL", "网址", "地址"],
  publishDate: ["publishDate", "发布时间", "发布日期", "日期", "时间"],
  category: ["category", "所属板块", "分类", "板块"],
  productName: ["productName", "品种名称", "品名", "品种", "药品名称", "产品名称", "通用名"],
  tradeName: ["tradeName", "商品名"],
  southwestName: ["southwestName", "西南名称", "西南名称CMS品名", "CMS品名"],
  companyName: ["companyName", "生产企业", "厂牌", "厂家", "企业", "公司", "合作方"],
  brandType: ["brandType", "厂牌类型", "企业类型"],
  approvalDate: ["approvalDate", "获批时间", "获批日期", "批准时间", "上市时间"],
  priorityReview: ["priorityReview", "是否优先审评审批", "优先审评审批"],
  indication: ["indication", "适应症", "适用症", "获批适应症"],
  researchIndication: ["researchIndication", "在研适应症"],
  mainAdvantage: ["mainAdvantage", "主要优势"],
  diseaseArea: ["diseaseArea", "疾病领域", "治疗领域"],
  registrationCategory: ["registrationCategory", "注册分类", "注册类别", "分类"],
  drugType: ["drugType", "药品类型", "药物类型"],
  therapyType: ["therapyType", "药品治疗类型", "治疗类型"],
  targetCount: ["targetCount", "靶点数目", "靶点数量"],
  target: ["target", "靶点"],
  purchase: ["purchase", "采购", "采购负责人"],
  purchaseRemark: ["purchaseRemark", "采购备注"],
  landedInSichuan: ["landedInSichuan", "是否落地四川", "落地四川", "四川落地"],
  southwestArchived: ["southwestArchived", "是否建档", "国药西南建档", "西南建档", "建档"],
  isT1: ["isT1", "是否T1", "T1"],
  isExclusive: ["isExclusive", "是否独家", "独家"],
  isSpecialtyDrug: ["isSpecialtyDrug", "是否专科用药", "专科用药"],
  isCooperation: ["isCooperation", "是否合作", "合作"],
  currentSituation: ["currentSituation", "目前情况", "当前情况"],
  rating: ["rating", "评价", "星级"],
  sales2022: ["sales2022", "2022年销售数据"],
  sales2023: ["sales2023", "2023年销售数据"],
  sales2024: ["sales2024", "2024年销售数据"],
  sales2025: ["sales2025", "2025年销售数据"],
  salesTotal2022To2025: ["salesTotal2022To2025", "22-25"],
  salesTotal: ["salesTotal", "合计累计"],
  status: ["status", "当前状态", "状态", "项目状态", "建档状态"],
  cooperationStatus: ["cooperationStatus", "合作状态", "合作情况", "协作状态"],
  owner: ["owner", "负责人", "责任人", "跟进人", "对接人"],
  progress: ["progress", "引进进展", "最新进展", "进展提炼", "进展", "跟进进展", "推进情况"],
  updatedAt: ["updatedAt", "更新时间", "更新日期", "更新"],
  remark: ["remark", "备注", "说明", "补充说明"]
};

export function normalizeNewsSection(match, sectionConfig) {
  if (!match) {
    return createEmptyNewsSection(sectionConfig);
  }

  const rows = compactRows(match.rows);
  if (!rows.length) {
    return createEmptyNewsSection(sectionConfig, match);
  }

  const headerIndex = findHeaderRow(rows, "news");
  const items =
    headerIndex >= 0
      ? normalizeNewsWithHeader(rows, headerIndex, sectionConfig)
      : normalizeNewsWithoutHeader(rows, sectionConfig);

  return {
    key: sectionConfig.key,
    title: match.displayTitle || sectionConfig.title,
    type: "news",
    source: buildSource(match),
    items: sortNewsItems(
      items.filter((item) => item.title),
      sectionConfig
    )
  };
}

export function normalizeTableSection(match, sectionConfig) {
  if (!match) {
    return createEmptyTableSection(sectionConfig);
  }

  const rows = compactRows(match.rows);
  if (!rows.length) {
    return createEmptyTableSection(sectionConfig, match);
  }

  const headerIndex = findHeaderRow(rows, "table");
  if (headerIndex < 0) {
    return createEmptyTableSection(sectionConfig, match);
  }

  const headerRow = rows[headerIndex];
  const columns = ensureUniqueColumnKeys(headerRow
    .map((cell, columnIndex) => createColumn(cellText(cell), columnIndex))
    .filter((column) => column.label));

  const dataRows = rows.slice(headerIndex + 1);
  const normalizedRows = dataRows
    .map((row, rowIndex) => normalizeTableRow(row, columns, sectionConfig.key, rowIndex))
    .filter((row) => hasAnyValue(row.values));

  return {
    key: sectionConfig.key,
    title: match.displayTitle || sectionConfig.title,
    type: "table",
    source: buildSource(match),
    columns,
    rows: normalizedRows
  };
}

export function compactRows(rows = []) {
  return rows
    .map((row) => row.map((cell) => ({ ...cell, value: cellText(cell), link: linkText(cell) })))
    .filter((row) => row.some((cell) => cell.value || cell.link));
}

export function cellText(cell) {
  if (cell === undefined || cell === null) return "";
  if (typeof cell === "object" && "value" in cell) return String(cell.value ?? "").trim();
  return String(cell).trim();
}

export function isValidHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(String(value).trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeComparable(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[（）()【】\[\]《》<>:：,，.。;；'"“”‘’_-]/g, "");
}

function normalizeNewsWithHeader(rows, headerIndex, sectionConfig) {
  const headers = rows[headerIndex].map((cell) => identifyField(cellText(cell)));
  return rows.slice(headerIndex + 1).map((row) => {
    const item = {
      sequence: "",
      title: "",
      summary: "",
      sourceName: "",
      sourceUrl: "",
      publishDate: "",
      category: sectionConfig.title,
      productName: "",
      companyName: "",
      indication: "",
      registrationCategory: "",
      progress: "",
      updatedAt: ""
    };

    row.forEach((cell, index) => {
      const field = headers[index];
      if (!field) return;
      const value = cellText(cell);
      if (field === "sourceUrl") {
        item.sourceUrl = pickValidUrl(value, linkText(cell));
      } else if (field === "publishDate" || field === "updatedAt") {
        item[field] = formatDisplayDate(value);
      } else if (field in item) {
        item[field] = value;
      }

      if (!item.sourceUrl) {
        item.sourceUrl = pickValidUrl(linkText(cell));
      }
    });

    if (!item.title && sectionConfig.key === "lastWeekInnovativeDrugs") {
      item.title = item.productName;
    }
    if (!item.publishDate && item.updatedAt) item.publishDate = item.updatedAt;
    if (!item.title) item.title = firstNonEmpty(row);
    return item;
  });
}

function normalizeNewsWithoutHeader(rows, sectionConfig) {
  return rows.map((row) => {
    const values = row.map(cellText).filter(Boolean);
    const link = row.map(linkText).find(isValidHttpUrl) || values.find(isValidHttpUrl) || "";

    return {
      sequence: values[0] && /^\d+$/.test(values[0]) ? values[0] : "",
      title: values[0] || "",
      summary: values.slice(1, 3).filter((value) => !isValidHttpUrl(value)).join("；"),
      sourceName: "",
      sourceUrl: pickValidUrl(link),
      publishDate: formatDisplayDate(values.find(looksLikeDate) || ""),
      category: sectionConfig.title,
      productName: "",
      companyName: "",
      indication: "",
      registrationCategory: "",
      progress: "",
      updatedAt: ""
    };
  });
}

function normalizeTableRow(row, columns, sectionKey, rowIndex) {
  const values = {};
  const fields = {};
  const links = {};

  columns.forEach((column, index) => {
    const cell = row[index];
    const value = cellText(cell);
    values[column.key] = value;

    if (column.field) {
      fields[column.field] = value;
    }

    const link = pickValidUrl(linkText(cell), value);
    if (link) {
      links[column.key] = link;
    }
  });

  return {
    id: `${sectionKey}-${rowIndex + 1}`,
    values,
    fields,
    links
  };
}

function findHeaderRow(rows, type) {
  let bestIndex = -1;
  let bestScore = -1;
  const maxScan = Math.min(rows.length, 12);

  for (let index = 0; index < maxScan; index += 1) {
    const row = rows[index];
    const values = row.map(cellText).filter(Boolean);
    if (values.length < 2 && type === "table") continue;
    if (values.length < 1 && type === "news") continue;

    const aliasScore = row.reduce((score, cell) => {
      const field = identifyField(cellText(cell));
      if (!field) return score;
      if (type === "news" && ["title", "summary", "sourceName", "sourceUrl", "publishDate", "category"].includes(field)) {
        return score + 2;
      }
      if (type === "table" && !["title", "summary", "sourceName", "sourceUrl", "publishDate", "category"].includes(field)) {
        return score + 2;
      }
      return score + 1;
    }, 0);
    const score = aliasScore + Math.min(values.length, 6);

    if (score > bestScore && (aliasScore > 0 || type === "table")) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function createColumn(label, index) {
  const cleanLabel = label || `列${index + 1}`;
  return {
    key: createUniqueKey(cleanLabel, index),
    label: cleanLabel,
    field: identifyField(cleanLabel)
  };
}

function createUniqueKey(label, index) {
  const field = identifyField(label);
  if (field) return field;
  const ascii = label
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\u4e00-\u9fa5]/g, "");
  return ascii || `column_${index + 1}`;
}

function ensureUniqueColumnKeys(columns) {
  const seen = new Map();

  return columns.map((column) => {
    const count = seen.get(column.key) || 0;
    seen.set(column.key, count + 1);
    if (count === 0) return column;
    return {
      ...column,
      key: `${column.key}_${count + 1}`
    };
  });
}

function identifyField(label) {
  const normalizedLabel = normalizeComparable(label);
  if (!normalizedLabel) return "";

  return (
    Object.entries(fieldAliases).find(([, aliases]) =>
      aliases.some((alias) => normalizeComparable(alias) === normalizedLabel)
    )?.[0] || ""
  );
}

function pickValidUrl(...candidates) {
  return candidates.find((candidate) => isValidHttpUrl(candidate)) || "";
}

function linkText(cell) {
  if (cell === undefined || cell === null) return "";
  if (typeof cell === "object" && "link" in cell) return String(cell.link ?? "").trim();
  return "";
}

function firstNonEmpty(row) {
  return row
    .map(cellText)
    .find((value) => value && !isValidHttpUrl(value) && !/^\d+$/.test(value)) || "";
}

function hasAnyValue(values) {
  return Object.values(values).some(Boolean);
}

function createEmptyNewsSection(sectionConfig, match = null) {
  return {
    key: sectionConfig.key,
    title: match?.displayTitle || sectionConfig.title,
    type: "news",
    source: match ? buildSource(match) : null,
    items: []
  };
}

function createEmptyTableSection(sectionConfig, match = null) {
  return {
    key: sectionConfig.key,
    title: match?.displayTitle || sectionConfig.title,
    type: "table",
    source: match ? buildSource(match) : null,
    columns: [],
    rows: []
  };
}

function buildSource(match) {
  return {
    sheetName: match.sheetName,
    startRow: match.startRow + 1,
    endRow: match.endRow + 1,
    matchType: match.matchType
  };
}

function looksLikeDate(value) {
  const text = String(value ?? "").trim();
  return (
    /^\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}/.test(text) ||
    /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(text) ||
    isExcelSerialDate(text)
  );
}

function getTimeValue(value) {
  if (!value) return 0;
  const dateParts = parseDateParts(value);
  if (dateParts) {
    return Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day);
  }

  const time = Date.parse(String(value).replace(/[年月.]/g, "-").replace("日", ""));
  return Number.isNaN(time) ? 0 : time;
}

function sortNewsItems(items, sectionConfig) {
  if (items.some((item) => item.sequence)) {
    return [...items].sort((left, right) => {
      const leftSequence = Number.parseFloat(left.sequence);
      const rightSequence = Number.parseFloat(right.sequence);
      if (Number.isFinite(leftSequence) && Number.isFinite(rightSequence)) {
        return leftSequence - rightSequence;
      }
      return 0;
    });
  }

  if (sectionConfig?.sortByDate === false) return items;

  return [...items].sort((left, right) => getTimeValue(right.publishDate) - getTimeValue(left.publishDate));
}

function formatDisplayDate(value) {
  const parts = parseDateParts(value);
  if (!parts) return String(value ?? "").trim();
  return `${parts.year}年${parts.month}月${parts.day}日`;
}

function parseDateParts(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  if (isExcelSerialDate(text)) {
    const serial = Number.parseFloat(text);
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate()
    };
  }

  const isoMatch = text.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3])
    };
  }

  const slashMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (slashMatch) {
    const year = Number(slashMatch[3]);
    return {
      year: year < 100 ? 2000 + year : year,
      month: Number(slashMatch[1]),
      day: Number(slashMatch[2])
    };
  }

  return null;
}

function isExcelSerialDate(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 20000 && number <= 80000;
}
