import { createIcons, icons } from "lucide";
import { demoDashboardData } from "./config/dashboardConfig.js";
import { loadDashboardState } from "./state/storage.js";
import { getDisplayValue } from "./render/tableRenderer.js";
import "./styles/base.css";
import "./styles/dashboard.css";

const app = document.querySelector("#tableApp");
let dashboardState = demoDashboardData;
const initialParams = new URLSearchParams(window.location.search);
const initialSectionKey = initialParams.get("section");
const initialSearch = initialParams.get("search") || "";
let selectedSectionKey = "";
let tableState = {
  search: initialSearch,
  filter: "all",
  sortKey: "",
  sortDir: "asc",
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
        <div class="brand">
          <div class="brand-mark">药</div>
          <div>
            <h1>表格详情</h1>
            <p>国药西南新药引进网</p>
          </div>
        </div>
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
      tableState = { ...tableState, page: 1, filter: "all", sortKey: "" };
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

  const total = document.createElement("strong");
  total.className = "detail-count";
  total.textContent = `${section.rows.length} 条记录`;
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

  const filter = document.createElement("select");
  filter.className = "control-select";
  filter.value = tableState.filter;
  filter.append(new Option("全部状态", "all"));
  getFilterOptions(section).forEach((option) => filter.append(new Option(option, option)));
  filter.addEventListener("change", (event) => {
    tableState = { ...tableState, filter: event.target.value, page: 1 };
    renderSelectedTable();
    createIcons({ icons });
  });

  const pageSize = document.createElement("select");
  pageSize.className = "control-select";
  [10, 20, 50].forEach((size) => pageSize.append(new Option(`${size} / 页`, String(size))));
  pageSize.value = String(tableState.pageSize);
  pageSize.addEventListener("change", (event) => {
    tableState = { ...tableState, pageSize: Number(event.target.value), page: 1 };
    renderSelectedTable();
    createIcons({ icons });
  });

  toolbar.append(searchWrap, filter, pageSize);
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

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  section.columns.forEach((column) => {
    const th = document.createElement("th");
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
    th.append(button);
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
        anchor.textContent = value || "查看链接";
        td.append(anchor);
      } else {
        td.textContent = value;
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

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "button button-ghost";
  prev.disabled = tableState.page <= 1;
  prev.innerHTML = '<i data-lucide="chevron-left"></i><span>上一页</span>';
  prev.addEventListener("click", () => {
    tableState = { ...tableState, page: Math.max(1, tableState.page - 1) };
    renderSelectedTable();
    createIcons({ icons });
  });

  const next = document.createElement("button");
  next.type = "button";
  next.className = "button button-ghost";
  next.disabled = tableState.page >= pageCount;
  next.innerHTML = '<span>下一页</span><i data-lucide="chevron-right"></i>';
  next.addEventListener("click", () => {
    tableState = { ...tableState, page: Math.min(pageCount, tableState.page + 1) };
    renderSelectedTable();
    createIcons({ icons });
  });

  pagination.append(info, prev, next);
  return pagination;
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
    });

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
  return dashboardState.tableSections.filter((section) => section.key !== "partnerCommunication");
}
