import { createIcons, icons } from "lucide";
import { demoWorkbookState as demoDashboardData } from "./config/demoWorkbookState.js";
import { loadDashboardState } from "./state/storage.js";
import { getDisplayValue, shouldShowTableSection, sortTableSectionsByDisplayOrder } from "./render/tableRenderer.js";
import "./styles/base.css";
import "./styles/dashboard.css";

const app = document.querySelector("#tableApp");
const sinopharmLogoUrl = new URL("./assets/sinopharm-logo.png", import.meta.url).href;
let dashboardState = demoDashboardData;
const initialParams = new URLSearchParams(window.location.search);
const initialSectionKey = initialParams.get("section");
const initialSearch = initialParams.get("search") || "";
const initialMetricFilters = parseMetricFilters(initialParams.get("filters"));
const initialTimeRange = initialParams.get("range") || "";
let selectedSectionKey = "";
let tableState = {
  search: initialSearch,
  filter: "all",
  companyFilter: "",
  indicationFilter: "",
  approvalYearFilter: "",
  sortKey: "",
  sortDir: "asc",
  metricFilters: initialMetricFilters,
  timeRange: initialTimeRange,
  page: 1,
  pageSize: 10
};

initializeTablePage();

async function initializeTablePage() {
  dashboardState = (await loadDashboardState()) || demoDashboardData;
  selectedSectionKey = pickInitialSectionKey(initialSectionKey);
  renderPage();
}

function renderPage() {
  app.innerHTML = `
    <div class="app-shell detail-shell">
      <header class="topbar">
        <a class="brand" href="/" aria-label="国药西南新药引进网首页">
          <img class="brand-logo" src="${sinopharmLogoUrl}" alt="国药集团" />
          <div>
            <h1>表格详情</h1>
            <p>国药西南新药引进网</p>
          </div>
        </a>
        <div class="topbar-actions">
          <a class="button button-ghost" href="/"><i data-lucide="arrow-left"></i><span>返回首页</span></a>
        </div>
      </header>
      <main class="detail-layout">
        <aside class="section-nav" aria-label="表格板块"></aside>
        <section class="detail-panel" aria-live="polite"></section>
      </main>
    </div>
  `;

  renderSectionNav();
  renderSelectedTable();
  createIcons({ icons });
}

function renderSectionNav() {
  const nav = document.querySelector(".section-nav");
  nav.replaceChildren();

  getVisibleTableSections().forEach((section) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = section.key === selectedSectionKey ? "section-tab is-active" : "section-tab";
    button.dataset.key = section.key;

    const title = document.createElement("span");
    title.textContent = section.title;
    const count = document.createElement("small");
    count.textContent = `${section.rows.length} 条`;
    button.append(title, count);

    button.addEventListener("click", () => {
      selectedSectionKey = section.key;
      tableState = {
        ...tableState,
        page: 1,
        filter: "all",
        companyFilter: "",
        indicationFilter: "",
        approvalYearFilter: "",
        sortKey: "",
        metricFilters: [],
        timeRange: ""
      };
      renderPage();
      history.replaceState(null, "", `/table.html?section=${encodeURIComponent(section.key)}`);
    });

    nav.append(button);
  });
}

function renderSelectedTable() {
  const panel = document.querySelector(".detail-panel");
  panel.replaceChildren();

  const section = getSelectedSection();
  const header = document.createElement("div");
  header.className = "detail-heading";

  const titleWrap = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = section.source?.sheetName || "未识别来源";
  const title = document.createElement("h2");
  title.textContent = section.title;
  titleWrap.append(eyebrow, title);

  const visibleCount = getVisibleRows(section).length;
  const metricSummary = getMetricFilterSummary(section);
  const total = document.createElement("strong");
  total.className = "detail-count";
  total.textContent = metricSummary ? `筛选后 ${visibleCount} / ${section.rows.length} 条` : `${section.rows.length} 条记录`;
  header.append(titleWrap, total);
  panel.append(header);

  if (!section.rows.length || !section.columns.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state empty-state-large";
    empty.textContent = "暂无完整表格数据";
    panel.append(empty);
    return;
  }

  panel.append(createToolbar(section));
  panel.append(createTableArea(section));
}

function createToolbar(section) {
  const toolbar = document.createElement("div");
  toolbar.className = "table-toolbar";

  const searchWrap = document.createElement("label");
  searchWrap.className = "control control-search";
  searchWrap.innerHTML = '<i data-lucide="search"></i>';
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "搜索品种、厂牌、负责人";
  search.value = tableState.search;
  search.addEventListener("input", (event) => {
    tableState = { ...tableState, search: event.target.value, page: 1 };
    syncTableUrl();
    renderSelectedTable();
    createIcons({ icons });
  });
  searchWrap.append(search);

  const pageSize = document.createElement("select");
  pageSize.className = "control-select";
  [10, 20, 50].forEach((size) => pageSize.append(new Option(`${size} / 页`, String(size))));
  pageSize.value = String(tableState.pageSize);
  pageSize.addEventListener("change", (event) => {
    tableState = { ...tableState, pageSize: Number(event.target.value), page: 1 };
    renderSelectedTable();
    createIcons({ icons });
  });

  const metricSummary = getMetricFilterSummary(section);
  if (metricSummary) {
    const metricFilter = document.createElement("span");
    metricFilter.className = "metric-filter-note";
    metricFilter.innerHTML = `<i data-lucide="filter"></i><span>${metricSummary}</span>`;
    const clear = document.createElement("button");
    clear.type = "button";
    clear.title = "清除指标筛选";
    clear.setAttribute("aria-label", "清除指标筛选");
    clear.innerHTML = '<i data-lucide="x"></i>';
    clear.addEventListener("click", () => {
      tableState = { ...tableState, metricFilters: [], timeRange: "", page: 1 };
      syncTableUrl();
      renderSelectedTable();
      createIcons({ icons });
    });
    metricFilter.append(clear);
    toolbar.append(metricFilter);
  }

  toolbar.append(searchWrap, pageSize);
  return toolbar;
}

function createTableArea(section) {
  const area = document.createElement("div");
  const rows = getVisibleRows(section);
  const pageCount = Math.max(1, Math.ceil(rows.length / tableState.pageSize));
  tableState.page = Math.min(tableState.page, pageCount);
  const pageRows = rows.slice((tableState.page - 1) * tableState.pageSize, tableState.page * tableState.pageSize);

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap full-table";
  const table = document.createElement("table");
  table.style.minWidth = `${Math.max(960, section.columns.length * 132)}px`;

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  section.columns.forEach((column) => {
    const th = document.createElement("th");
    const header = document.createElement("div");
    header.className = "table-header-content";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sort-button";
    button.dataset.key = column.key;

    const label = document.createElement("span");
    label.textContent = column.label;
    const icon = document.createElement("i");
    icon.dataset.lucide = tableState.sortKey === column.key ? (tableState.sortDir === "asc" ? "arrow-up" : "arrow-down") : "arrow-up-down";
    button.append(label, icon);
    button.addEventListener("click", () => toggleSort(column.key));
    header.append(button);
    const filter = createTableHeaderFilter(section, column);
    if (filter) header.append(filter);
    th.append(header);
    headRow.append(th);
  });
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  pageRows.forEach((row) => {
    const tr = document.createElement("tr");
    section.columns.forEach((column) => {
      const td = document.createElement("td");
      const value = getDisplayValue(row, column);
      const link = row.links?.[column.key];

      if (link) {
        const anchor = document.createElement("a");
        anchor.href = link;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        appendHighlightedText(anchor, value || "查看链接", tableState.search);
        td.append(anchor);
      } else {
        appendHighlightedText(td, value, tableState.search);
      }

      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);
  tableWrap.append(table);

  area.append(tableWrap, createPagination(rows.length, pageCount));
  return area;
}

function createPagination(rowCount, pageCount) {
  const pagination = document.createElement("div");
  pagination.className = "pagination";

  const info = document.createElement("span");
  info.textContent = `共 ${rowCount} 条，第 ${tableState.page} / ${pageCount} 页`;

  const controls = document.createElement("div");
  controls.className = "table-pagination-controls";
  controls.append(
    createTablePageButton(1, "首页", tableState.page <= 1),
    createTablePageButton(tableState.page - 1, "上一页", tableState.page <= 1, "chevron-left")
  );
  getTablePaginationItems(tableState.page, pageCount).forEach((item) => {
    if (item === "…") {
      const ellipsis = document.createElement("span");
      ellipsis.className = "table-page-ellipsis";
      ellipsis.textContent = item;
      controls.append(ellipsis);
      return;
    }
    const button = createTablePageButton(item, String(item), false);
    button.classList.add("table-page-number");
    if (item === tableState.page) {
      button.classList.add("is-active");
      button.setAttribute("aria-current", "page");
    }
    controls.append(button);
  });
  controls.append(
    createTablePageButton(tableState.page + 1, "下一页", tableState.page >= pageCount, "chevron-right"),
    createTablePageButton(pageCount, "末页", tableState.page >= pageCount)
  );

  const jump = document.createElement("form");
  jump.className = "table-page-jump";
  jump.innerHTML = `<label>跳至 <input name="page" type="number" min="1" max="${pageCount}" value="${tableState.page}" inputmode="numeric" aria-label="跳转页码" /> 页</label><button class="button button-ghost" type="submit">确定</button>`;
  jump.addEventListener("submit", (event) => {
    event.preventDefault();
    const requested = Number(new FormData(jump).get("page"));
    goToTablePage(requested, pageCount);
  });

  pagination.append(info, controls, jump);
  return pagination;
}

function createTablePageButton(page, label, disabled, icon) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-ghost table-page-button";
  button.disabled = disabled;
  button.setAttribute("aria-label", label);
  button.innerHTML = icon ? `<i data-lucide="${icon}"></i>` : label;
  button.addEventListener("click", () => goToTablePage(page));
  return button;
}

function goToTablePage(page, maximumPage = Number.POSITIVE_INFINITY) {
  const nextPage = Math.min(maximumPage, Math.max(1, Number.isFinite(Number(page)) ? Math.trunc(Number(page)) : 1));
  tableState = { ...tableState, page: nextPage };
  renderSelectedTable();
  createIcons({ icons });
}

function getVisibleRows(section) {
  const query = tableState.search.trim().toLowerCase();
  const rows = section.rows
    .filter((row) => {
      if (!query) return true;
      return Object.values(row.values || {}).join(" ").toLowerCase().includes(query);
    })
    .filter((row) => {
      if (tableState.filter === "all") return true;
      return getRowStatus(row) === tableState.filter;
    })
    .filter((row) => {
      if (!tableState.companyFilter) return true;
      return getTableColumnValue(section, row, "companyName") === tableState.companyFilter;
    })
    .filter((row) => {
      if (!tableState.indicationFilter) return true;
      return getTableColumnValue(section, row, "indication") === tableState.indicationFilter;
    })
    .filter((row) => {
      if (!tableState.approvalYearFilter) return true;
      return getTableApprovalYear(section, row) === tableState.approvalYearFilter;
    })
    .filter((row) => matchesMetricTimeRange(section, row, tableState.timeRange))
    .filter((row) => tableState.metricFilters.every((filter) => matchesMetricFilter(section, row, filter)));

  if (!tableState.sortKey) return rows;

  return [...rows].sort((left, right) => {
    const leftValue = String(left.values?.[tableState.sortKey] || "");
    const rightValue = String(right.values?.[tableState.sortKey] || "");
    const result = leftValue.localeCompare(rightValue, "zh-CN", { numeric: true });
    return tableState.sortDir === "asc" ? result : -result;
  });
}

function getFilterOptions(section) {
  return [...new Set(section.rows.map(getRowStatus).filter(Boolean))];
}

function createTableHeaderFilter(section, column) {
  const definition = getTableHeaderFilterDefinition(section, column);
  if (!definition) return null;

  const control = document.createElement("span");
  control.className = tableState[definition.stateKey] !== definition.allValue ? "header-filter-control is-active" : "header-filter-control";
  const icon = document.createElement("i");
  icon.dataset.lucide = "filter";
  const select = document.createElement("select");
  select.setAttribute("aria-label", `按${column.label}筛选`);
  select.append(new Option(definition.allLabel, definition.allValue));
  definition.values.forEach((value) => select.append(new Option(value, value)));
  select.value = tableState[definition.stateKey];
  select.addEventListener("change", (event) => {
    tableState = { ...tableState, [definition.stateKey]: event.target.value, page: 1 };
    renderSelectedTable();
    createIcons({ icons });
  });
  control.append(icon, select);
  return control;
}

function getTableHeaderFilterDefinition(section, column) {
  const field = column.field || column.key;
  if (field === "companyName") {
    return { stateKey: "companyFilter", allLabel: "全部厂牌", allValue: "", values: getTableColumnOptions(section, "companyName") };
  }
  if (field === "indication") {
    return { stateKey: "indicationFilter", allLabel: "全部适应症", allValue: "", values: getTableColumnOptions(section, "indication") };
  }
  if (field === "approvalDate") {
    return {
      stateKey: "approvalYearFilter",
      allLabel: "全部年份",
      allValue: "",
      values: [...new Set(section.rows.map((row) => getTableApprovalYear(section, row)).filter(Boolean))].sort((left, right) => Number(right) - Number(left))
    };
  }
  if (["status", "cooperationStatus", "progress"].includes(field)) {
    return { stateKey: "filter", allLabel: "全部状态", allValue: "all", values: getFilterOptions(section) };
  }
  return null;
}

function getTableColumnOptions(section, field) {
  return [...new Set(section.rows.map((row) => getTableColumnValue(section, row, field)).filter(Boolean))].sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function getTableColumnValue(section, row, field) {
  const column = section.columns.find((candidate) => candidate.field === field || candidate.key === field);
  return column ? String(getDisplayValue(row, column) || "").trim() : "";
}

function getTableApprovalYear(section, row) {
  return getTableColumnValue(section, row, "approvalDate").match(/\d{4}/)?.[0] || "";
}

function parseMetricFilters(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.field === "string" && typeof item.value === "string")
      : [];
  } catch {
    return [];
  }
}

function matchesMetricTimeRange(section, row, range) {
  if (!range || range === "all") return true;
  const matched = range.match(/^range:(\d{4}-\d{2}):(\d{4}-\d{2})$/);
  if (!matched) return true;
  const date = getTableColumnValue(section, row, "approvalDate");
  const dateMatch = date.match(/(\d{4})\D+(\d{1,2})/);
  if (!dateMatch) return false;
  const month = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}`;
  return month >= matched[1] && month <= matched[2];
}

function matchesMetricFilter(section, row, filter) {
  const value = getTableColumnValue(section, row, filter.field);
  if (filter.mode === "ratingAtLeast") {
    const stars = (value.match(/⭐/g) || []).length || Number(value.match(/\d+/)?.[0] || 0);
    return stars >= Number(filter.value);
  }
  if (filter.mode === "includes") return value.includes(filter.value);
  return value === filter.value;
}

function getMetricFilterSummary(section) {
  const labels = tableState.metricFilters.map((filter) => {
    const column = section.columns.find((item) => item.key === filter.field || item.field === filter.field);
    if (filter.mode === "ratingAtLeast") return `${column?.label || "评价"} ≥ ${filter.value} 星`;
    return `${column?.label || filter.field}：${filter.value}`;
  });
  if (tableState.timeRange.startsWith("range:")) {
    const [, start, end] = tableState.timeRange.split(":");
    labels.unshift(`${start} 至 ${end}`);
  }
  return labels.join("；");
}

function getTablePaginationItems(currentPage, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  if (currentPage <= 3) [2, 3, 4].forEach((page) => pages.add(page));
  if (currentPage >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((page) => pages.add(page));
  const sorted = [...pages].filter((page) => page >= 1 && page <= pageCount).sort((left, right) => left - right);
  return sorted.reduce((items, page, index) => {
    if (index && page - sorted[index - 1] > 1) items.push("…");
    items.push(page);
    return items;
  }, []);
}

function getRowStatus(row) {
  return row.fields?.status || row.fields?.cooperationStatus || row.fields?.progress || "";
}

function toggleSort(columnKey) {
  if (tableState.sortKey === columnKey) {
    tableState = { ...tableState, sortDir: tableState.sortDir === "asc" ? "desc" : "asc" };
  } else {
    tableState = { ...tableState, sortKey: columnKey, sortDir: "asc" };
  }
  renderSelectedTable();
  createIcons({ icons });
}

function syncTableUrl() {
  const params = new URLSearchParams({ section: selectedSectionKey });
  const search = tableState.search.trim();
  if (search) params.set("search", search);
  if (tableState.timeRange && tableState.timeRange !== "all") params.set("range", tableState.timeRange);
  if (tableState.metricFilters.length) params.set("filters", JSON.stringify(tableState.metricFilters));
  history.replaceState(null, "", `/table.html?${params.toString()}`);
}

function getSelectedSection() {
  const sections = getVisibleTableSections();
  return sections.find((section) => section.key === selectedSectionKey) || sections[0];
}

function pickInitialSectionKey(key) {
  const sections = getVisibleTableSections();
  const exists = sections.some((section) => section.key === key);
  return exists ? key : sections[0]?.key;
}

function getVisibleTableSections() {
  return sortTableSectionsByDisplayOrder(dashboardState.tableSections).filter(shouldShowTableSection);
}

function appendHighlightedText(node, value, query) {
  const text = String(value ?? "");
  const needle = query.trim();
  if (!needle) {
    node.textContent = text;
    return;
  }

  const fragment = document.createDocumentFragment();
  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let cursor = 0;
  let index = lowerText.indexOf(lowerNeedle);

  if (index === -1) {
    node.textContent = text;
    return;
  }

  while (index !== -1) {
    if (index > cursor) fragment.append(document.createTextNode(text.slice(cursor, index)));
    const mark = document.createElement("mark");
    mark.className = "search-highlight";
    mark.textContent = text.slice(index, index + needle.length);
    fragment.append(mark);
    cursor = index + needle.length;
    index = lowerText.indexOf(lowerNeedle, cursor);
  }

  if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
  node.replaceChildren(fragment);
}
