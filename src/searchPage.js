import { createIcons, icons } from "lucide";
import { demoWorkbookState as demoDashboardData } from "./config/demoWorkbookState.js";
import { isValidHttpUrl } from "./parser/normalizer.js";
import { getDisplayValue, shouldShowTableSection, sortTableSectionsByDisplayOrder } from "./render/tableRenderer.js";
import { loadDashboardState } from "./state/storage.js";
import "./styles/base.css";
import "./styles/dashboard.css";

const app = document.querySelector("#searchApp");
const sinopharmLogoUrl = new URL("./assets/sinopharm-logo.png", import.meta.url).href;
const params = new URLSearchParams(window.location.search);
const query = (params.get("q") || "").trim();
let dashboardState = demoDashboardData;

initializeSearchPage();

async function initializeSearchPage() {
  dashboardState = (await loadDashboardState()) || demoDashboardData;
  renderPage();
}

function renderPage() {
  app.innerHTML = `
    <div class="app-shell search-shell">
      <header class="topbar">
        <a class="brand" href="/" aria-label="国药西南新药引进网首页">
          <img class="brand-logo" src="${sinopharmLogoUrl}" alt="国药集团" />
          <div>
            <h1>关键词检索</h1>
            <p>国药西南新药引进网</p>
          </div>
        </a>
        <div class="topbar-actions">
          <a class="button button-ghost" href="/"><i data-lucide="arrow-left"></i><span>返回首页</span></a>
        </div>
      </header>
      <main>
        <section class="search-panel">
          <form class="keyword-search search-page-form" action="/search.html" method="get">
            <label class="keyword-search-field">
              <i data-lucide="search"></i>
              <input name="q" type="search" value="${escapeAttribute(query)}" placeholder="输入关键词" aria-label="关键词检索" required />
            </label>
            <button class="button button-primary" type="submit"><i data-lucide="search"></i><span>检索</span></button>
          </form>
          <p class="search-summary"></p>
        </section>
        <div class="search-results"></div>
      </main>
    </div>
  `;

  renderResults();
  createIcons({ icons });
}

function renderResults() {
  const summary = document.querySelector(".search-summary");
  const host = document.querySelector(".search-results");
  host.replaceChildren();

  if (!query) {
    summary.textContent = "请输入关键词后查看新闻和表格命中结果。";
    host.append(createEmptyState("暂无检索词"));
    return;
  }

  const newsMatches = getNewsMatches(query);
  const tableMatches = getTableMatches(query);
  const tableRowCount = tableMatches.reduce((total, group) => total + group.rows.length, 0);
  summary.textContent = `检索“${query}”：动态新闻 ${newsMatches.length} 条，表格记录 ${tableRowCount} 条。`;

  if (!newsMatches.length && !tableMatches.length) {
    host.append(createEmptyState("未找到相关信息"));
    return;
  }

  if (newsMatches.length) host.append(createNewsResultSection(newsMatches));
  if (tableMatches.length) host.append(createTableResultSection(tableMatches));
}

function createNewsResultSection(matches) {
  const section = document.createElement("section");
  section.className = "content-band search-result-section";
  section.append(createSearchHeading("动态新闻", matches.length));

  const list = document.createElement("div");
  list.className = "search-news-list";
  matches.forEach((match) => list.append(createNewsResultItem(match)));
  section.append(list);
  return section;
}

function createNewsResultItem(match) {
  const item = document.createElement("article");
  item.className = "search-news-item";

  const top = document.createElement("div");
  top.className = "search-result-top";
  const title = isValidHttpUrl(match.item.sourceUrl) ? document.createElement("a") : document.createElement("h3");
  title.className = "search-result-title";
  if (title.tagName === "A") {
    title.href = match.item.sourceUrl;
    title.target = "_blank";
    title.rel = "noopener noreferrer";
    title.title = "打开原链接";
  }
  appendHighlightedText(title, match.item.title || match.item.productName || "未命名新闻", query);

  const badge = document.createElement("span");
  badge.className = "search-result-badge";
  badge.textContent = match.section.title;
  top.append(title, badge);
  item.append(top);

  const meta = document.createElement("p");
  meta.className = "search-result-meta";
  appendHighlightedText(meta, [match.item.publishDate, match.item.category].filter(Boolean).join(" · "), query);
  item.append(meta);

  const summary = [match.item.summary, match.item.indication, match.item.progress].filter(Boolean).join("；");
  if (summary) {
    const text = document.createElement("p");
    text.className = "search-result-snippet";
    appendHighlightedText(text, summary, query);
    item.append(text);
  }

  return item;
}

function createTableResultSection(matches) {
  const rowCount = matches.reduce((total, group) => total + group.rows.length, 0);
  const section = document.createElement("section");
  section.className = "content-band search-result-section";
  section.append(createSearchHeading("表格展示", rowCount));

  const list = document.createElement("div");
  list.className = "search-table-groups";
  matches.forEach((match) => list.append(createTableResultGroup(match)));
  section.append(list);
  return section;
}

function createTableResultGroup({ section, rows }) {
  const card = document.createElement("article");
  card.className = "search-table-card";

  const heading = document.createElement("div");
  heading.className = "panel-heading";
  const titleWrap = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = section.title;
  const source = document.createElement("p");
  source.className = "source-note";
  source.textContent = `命中 ${rows.length} 条${section.source?.sheetName ? ` · 来源：${section.source.sheetName}` : ""}`;
  titleWrap.append(title, source);

  const link = document.createElement("a");
  link.className = "button button-ghost";
  link.href = `/table.html?section=${encodeURIComponent(section.key)}&search=${encodeURIComponent(query)}`;
  link.innerHTML = '<i data-lucide="table-2"></i><span>查看完整表格</span>';
  heading.append(titleWrap, link);
  card.append(heading);

  card.append(createResultTable(section, rows.slice(0, 8)));

  if (rows.length > 8) {
    const note = document.createElement("p");
    note.className = "search-more-note";
    note.textContent = `已显示前 8 条，完整结果可进入表格详情继续查看。`;
    card.append(note);
  }

  return card;
}

function createResultTable(section, rows) {
  const columns = getSearchColumns(section);
  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap preview-table search-preview-table";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column.label;
    headRow.append(th);
  });
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    columns.forEach((column) => {
      const td = document.createElement("td");
      appendHighlightedText(td, getDisplayValue(row, column), query);
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);
  tableWrap.append(table);
  return tableWrap;
}

function createSearchHeading(title, count) {
  const heading = document.createElement("div");
  heading.className = "section-heading";
  const wrap = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "检索结果";
  const h2 = document.createElement("h2");
  h2.textContent = title;
  wrap.append(eyebrow, h2);
  const pill = document.createElement("span");
  pill.className = "count-pill";
  pill.textContent = `${count} 条`;
  heading.append(wrap, pill);
  return heading;
}

function getNewsMatches(keyword) {
  return dashboardState.newsSections.flatMap((section) =>
    section.items
      .filter((item) =>
        textIncludes(
          [item.title, item.summary, item.category, item.productName, item.companyName, item.indication, item.progress].join(" "),
          keyword
        )
      )
      .map((item) => ({ section, item }))
  );
}

function getTableMatches(keyword) {
  return sortTableSectionsByDisplayOrder(dashboardState.tableSections)
    .filter(shouldShowTableSection)
    .map((section) => ({
      section,
      rows: section.rows.filter((row) => textIncludes(Object.values(row.values || {}).join(" "), keyword))
    }))
    .filter((group) => group.rows.length);
}

function getSearchColumns(section) {
  const preferredFields = [
    "productName",
    "tradeName",
    "companyName",
    "approvalDate",
    "indication",
    "target",
    "currentSituation",
    "progress",
    "rating"
  ];
  const columns = preferredFields.map((field) => section.columns.find((column) => column.field === field)).filter(Boolean);
  const fallback = section.columns.filter((column) => !columns.includes(column)).slice(0, Math.max(0, 6 - columns.length));
  return [...columns, ...fallback].slice(0, 6);
}

function textIncludes(value, keyword) {
  return String(value ?? "").toLowerCase().includes(keyword.toLowerCase());
}

function appendHighlightedText(node, value, keyword) {
  const text = String(value ?? "");
  const needle = keyword.trim();
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

function createEmptyState(message) {
  const node = document.createElement("div");
  node.className = "empty-state empty-state-large";
  node.textContent = message;
  return node;
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
