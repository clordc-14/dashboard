export function renderTableCards(container, sections = [], onOpen) {
  container.replaceChildren();

  sections.forEach((section) => {
    const card = document.createElement("article");
    card.className = isArchivedProducts(section) ? "table-card is-archived-products" : "table-card";
    card.id = `card-${section.key}`;

    const heading = document.createElement("div");
    heading.className = "panel-heading";

    const titleWrap = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = section.title;
    const source = document.createElement("p");
    source.className = "source-note";
    source.textContent = section.source?.sheetName ? `来源：${section.source.sheetName}` : "未识别到对应板块";
    titleWrap.append(title, source);

    const button = document.createElement("button");
    button.className = "icon-button";
    button.type = "button";
    button.title = "查看完整表格";
    button.setAttribute("aria-label", `查看${section.title}`);
    button.innerHTML = '<i data-lucide="arrow-right"></i>';
    button.addEventListener("click", () => onOpen(section.key));

    heading.append(titleWrap, button);
    card.append(heading);

    const metrics = createMetrics(section);
    card.append(metrics);

    if (!hasPreviewRows(section) || !section.columns.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = isArchivedProducts(section) ? "暂无符合条件的四/五星品种" : "暂无表格数据";
      card.append(empty);
    } else {
      card.append(createPreviewTable(section));
    }

    container.append(card);
  });
}

export function computeTableMetrics(section) {
  if (isArchivedProducts(section)) {
    const recentArchivedCount = section.rows.filter(isRecentArchivedProduct).length;
    const highRatingCount = section.rows.filter(isFeaturedArchivedProduct).length;

    return {
      rowCount: section.rows.length,
      assistCount: 0,
      focusCount: highRatingCount,
      recentArchivedCount,
      highRatingCount
    };
  }

  const rowCount = section.rows.length;
  const assistCount = section.rows.filter((row) => containsAny(row, ["协助", "待", "未合作"])).length;
  const focusCount = section.rows.filter((row) => containsAny(row, ["重点", "创新", "优先"])).length;

  return {
    rowCount,
    assistCount,
    focusCount
  };
}

export function getDisplayValue(row, column) {
  return row.values?.[column.key] ?? "";
}

function createMetrics(section) {
  const metrics = computeTableMetrics(section);
  const wrap = document.createElement("div");
  wrap.className = isArchivedProducts(section) ? "mini-metrics archived-metrics" : "mini-metrics";

  const items = isArchivedProducts(section)
    ? [
        ["2025至2026年已建档品种数目", metrics.recentArchivedCount],
        ["四/五星品种", metrics.highRatingCount]
      ]
    : [
        ["记录数", metrics.rowCount],
        ["待协助", metrics.assistCount],
        ["重点项", metrics.focusCount]
      ];

  items.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "mini-metric";
    const strong = document.createElement("strong");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    item.append(strong, span);
    wrap.append(item);
  });

  return wrap;
}

function createPreviewTable(section) {
  if (isArchivedProducts(section)) {
    return createArchivedProductsTable(section);
  }

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap preview-table";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const columns = section.columns.slice(0, 4);

  columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column.label;
    headRow.append(th);
  });

  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  section.rows.slice(0, 5).forEach((row) => {
    const tr = document.createElement("tr");
    columns.forEach((column) => {
      const td = document.createElement("td");
      td.textContent = getDisplayValue(row, column);
      tr.append(td);
    });
    tbody.append(tr);
  });

  table.append(tbody);
  tableWrap.append(table);
  return tableWrap;
}

function createArchivedProductsTable(section) {
  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap preview-table archived-preview-table";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const columns = getArchivedPreviewColumns();

  columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column.label;
    headRow.append(th);
  });

  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  getArchivedPreviewRows(section).forEach((row, index) => {
    const tr = document.createElement("tr");
    columns.forEach((column) => {
      const td = document.createElement("td");

      if (column.key === "sequence") {
        const badge = document.createElement("span");
        badge.className = "preview-index";
        badge.textContent = String(index + 1);
        td.append(badge);
      } else if (column.key === "productName") {
        const anchor = document.createElement("a");
        anchor.className = "product-detail-link";
        anchor.href = buildSearchUrl(section.key, getRowField(row, "productName"));
        anchor.textContent = getRowField(row, "productName") || "查看品种";
        anchor.title = "查看完整信息";
        td.append(anchor);
      } else {
        td.textContent = formatArchivedValue(row, column.key);
        if (column.key === "rating") td.className = "rating-cell";
      }

      tr.append(td);
    });
    tbody.append(tr);
  });

  table.append(tbody);
  tableWrap.append(table);
  return tableWrap;
}

function hasPreviewRows(section) {
  if (!section.rows.length) return false;
  if (!isArchivedProducts(section)) return true;
  return getArchivedPreviewRows(section).length > 0;
}

function getArchivedPreviewColumns() {
  return [
    { key: "sequence", label: "序号" },
    { key: "productName", label: "品种名称" },
    { key: "companyName", label: "厂牌" },
    { key: "approvalDate", label: "获批时间" },
    { key: "indication", label: "获批适应症" },
    { key: "target", label: "靶点" },
    { key: "purchase", label: "采购" },
    { key: "rating", label: "评价" }
  ];
}

function getArchivedPreviewRows(section) {
  return section.rows
    .filter(isFeaturedArchivedProduct)
    .sort(compareArchivedRows)
    .slice(0, 6);
}

function compareArchivedRows(left, right) {
  const groupDiff = getFeaturedGroup(left) - getFeaturedGroup(right);
  if (groupDiff !== 0) return groupDiff;
  return getApprovalTime(right) - getApprovalTime(left);
}

function getFeaturedGroup(row) {
  const year = getApprovalYear(row);
  const stars = getStarCount(row);
  if (year === 2026 && stars >= 5) return 0;
  if (year === 2026 && stars === 4) return 1;
  if (year === 2025 && stars >= 5) return 2;
  return 3;
}

function isArchivedProducts(section) {
  return section.key === "archivedProducts";
}

function isRecentArchivedProduct(row) {
  return [2025, 2026].includes(getApprovalYear(row));
}

function isFeaturedArchivedProduct(row) {
  return isRecentArchivedProduct(row) && getStarCount(row) >= 4;
}

function getRowField(row, field) {
  return row.fields?.[field] || row.values?.[field] || "";
}

function formatArchivedValue(row, field) {
  const value = getRowField(row, field);
  if (field === "approvalDate") return formatApprovalDate(value);
  return value;
}

function buildSearchUrl(sectionKey, query) {
  const params = new URLSearchParams({
    section: sectionKey,
    search: query
  });
  return `/table.html?${params.toString()}`;
}

function getStarCount(row) {
  const rating = getRowField(row, "rating");
  return (String(rating).match(/[⭐★]/g) || []).length;
}

function getApprovalYear(row) {
  return getDateParts(getRowField(row, "approvalDate"))?.year || 0;
}

function getApprovalTime(row) {
  const parts = getDateParts(getRowField(row, "approvalDate"));
  if (!parts) return 0;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function formatApprovalDate(value) {
  const parts = getDateParts(value);
  if (!parts) return String(value || "");
  return `${parts.year}年${parts.month}月${parts.day}日`;
}

function getDateParts(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const serial = Number(text);
  if (Number.isFinite(serial) && serial >= 20000 && serial <= 80000) {
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

function containsAny(row, keywords) {
  const text = Object.values(row.values || {}).join(" ");
  return keywords.some((keyword) => text.includes(keyword));
}
