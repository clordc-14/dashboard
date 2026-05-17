const fieldAliases = {
  title: ["title", "新闻标题", "标题", "信息标题", "重点标题"],
  summary: ["summary", "摘要", "内容", "重点内容", "新闻摘要", "信息内容", "说明"],
  sourceName: ["sourceName", "来源", "来源名称", "新闻来源", "媒体"],
  sourceUrl: ["sourceUrl", "链接", "新闻源链接", "源地址", "url", "URL", "网址", "地址"],
  publishDate: ["publishDate", "发布时间", "发布日期", "日期", "时间"],
  category: ["category", "所属板块", "分类", "板块"],
  productName: ["productName", "品种名称", "品种", "药品名称", "产品名称", "通用名"],
  companyName: ["companyName", "生产企业", "厂牌", "厂家", "企业", "公司", "合作方"],
  status: ["status", "当前状态", "状态", "项目状态", "建档状态"],
  cooperationStatus: ["cooperationStatus", "合作状态", "合作情况", "协作状态"],
  owner: ["owner", "负责人", "责任人", "跟进人", "对接人"],
  progress: ["progress", "引进进展", "进展", "跟进进展", "推进情况"],
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
    items: items
      .filter((item) => item.title)
      .sort((left, right) => getTimeValue(right.publishDate) - getTimeValue(left.publishDate))
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
      title: "",
      summary: "",
      sourceName: "",
      sourceUrl: "",
      publishDate: "",
      category: sectionConfig.title
    };

    row.forEach((cell, index) => {
      const field = headers[index];
      if (!field) return;
      const value = cellText(cell);
      if (field === "sourceUrl") {
        item.sourceUrl = pickValidUrl(value, linkText(cell));
      } else if (field in item) {
        item[field] = value;
      }

      if (!item.sourceUrl) {
        item.sourceUrl = pickValidUrl(linkText(cell));
      }
    });

    if (!item.title) item.title = firstNonEmpty(row);
    return item;
  });
}

function normalizeNewsWithoutHeader(rows, sectionConfig) {
  return rows.map((row) => {
    const values = row.map(cellText).filter(Boolean);
    const link = row.map(linkText).find(isValidHttpUrl) || values.find(isValidHttpUrl) || "";

    return {
      title: values[0] || "",
      summary: values.slice(1, 3).filter((value) => !isValidHttpUrl(value)).join("；"),
      sourceName: "",
      sourceUrl: pickValidUrl(link),
      publishDate: values.find(looksLikeDate) || "",
      category: sectionConfig.title
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
  return row.map(cellText).find(Boolean) || "";
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
  return /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(value) || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(value);
}

function getTimeValue(value) {
  if (!value) return 0;
  const time = Date.parse(String(value).replace(/\./g, "-"));
  return Number.isNaN(time) ? 0 : time;
}
