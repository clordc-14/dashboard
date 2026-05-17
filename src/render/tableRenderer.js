export function renderTableCards(container, sections = [], onOpen) {
  container.replaceChildren();

  sections.forEach((section) => {
    const card = document.createElement("article");
    card.className = "table-card";
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

    if (!section.rows.length || !section.columns.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "暂无表格数据";
      card.append(empty);
    } else {
      card.append(createPreviewTable(section));
    }

    container.append(card);
  });
}

export function computeTableMetrics(section) {
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
  wrap.className = "mini-metrics";

  [
    ["记录数", metrics.rowCount],
    ["待协助", metrics.assistCount],
    ["重点项", metrics.focusCount]
  ].forEach(([label, value]) => {
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

function containsAny(row, keywords) {
  const text = Object.values(row.values || {}).join(" ");
  return keywords.some((keyword) => text.includes(keyword));
}
