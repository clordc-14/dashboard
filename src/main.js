import { createIcons, icons } from "lucide";
import { dashboardConfig, demoDashboardData } from "./config/dashboardConfig.js";
import { readExcelFile } from "./parser/excelParser.js";
import { matchWorkbookSections } from "./parser/sectionMatcher.js";
import { normalizeNewsSection, normalizeTableSection } from "./parser/normalizer.js";
import { renderNewsSections } from "./render/newsRenderer.js";
import { computeTableMetrics, renderTableCards } from "./render/tableRenderer.js";
import { loadDashboardState, saveDashboardState } from "./state/storage.js";
import "./styles/base.css";
import "./styles/dashboard.css";

const app = document.querySelector("#app");
let dashboardState = demoDashboardData;
let notice = null;

initializeDashboard();

async function initializeDashboard() {
  dashboardState = (await loadDashboardState()) || demoDashboardData;
  renderDashboard();
}

function renderDashboard() {
  const summary = getDashboardSummary(dashboardState);
  const meta = dashboardState.meta || {};

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">药</div>
          <div>
            <h1>国药西南新药引进网</h1>
            <p>新药引进经营看板</p>
          </div>
        </div>
        <div class="topbar-actions">
          <span class="last-update"><i data-lucide="clock-3"></i><span>${formatDateTime(meta.updatedAt)}</span></span>
          <label class="button button-primary" for="excelInput"><i data-lucide="upload"></i><span>上传 Excel</span></label>
          <input id="excelInput" type="file" accept=".xlsx,.xls" hidden />
        </div>
      </header>

      <main>
        <section class="status-band" id="uploadZone">
          <div>
            <span class="eyebrow">${meta.mode === "demo" ? "示例数据" : "已解析数据"}</span>
            <h2>经营信息总览</h2>
          </div>
          <div class="status-meta">
            <span><i data-lucide="file-spreadsheet"></i>${meta.sheetCount || 0} 个工作表</span>
            <span><i data-lucide="shield-check"></i>不展示原始文件路径</span>
          </div>
        </section>

        <section class="summary-grid" aria-label="数据摘要">
          <article class="summary-card"><span>新闻条目</span><strong>${summary.newsCount}</strong></article>
          <article class="summary-card"><span>表格板块</span><strong>${summary.tableCount}</strong></article>
          <article class="summary-card"><span>明细记录</span><strong>${summary.rowCount}</strong></article>
          <article class="summary-card"><span>待协助项</span><strong>${summary.assistCount}</strong></article>
        </section>

        <div id="noticeHost"></div>

        <section class="content-band">
          <div class="section-heading">
            <div>
              <span class="eyebrow">News</span>
              <h2>动态新闻板块</h2>
            </div>
          </div>
          <div id="newsSections" class="news-grid"></div>
        </section>

        <section class="content-band">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Tables</span>
              <h2>表格展示板块</h2>
            </div>
            <a class="button button-ghost" href="/table.html"><i data-lucide="table-2"></i><span>完整表格</span></a>
          </div>
          <div id="tableCards" class="table-card-grid"></div>
        </section>
      </main>
    </div>
  `;

  bindUpload();
  renderNotice();
  renderNewsSections(document.querySelector("#newsSections"), dashboardState.newsSections);
  renderTableCards(document.querySelector("#tableCards"), dashboardState.tableSections, openTableSection);
  createIcons({ icons });
}

function bindUpload() {
  const input = document.querySelector("#excelInput");
  const uploadZone = document.querySelector("#uploadZone");

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    input.value = "";
    if (file) handleFile(file);
  });

  uploadZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadZone.classList.add("is-dragging");
  });

  uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("is-dragging");
  });

  uploadZone.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadZone.classList.remove("is-dragging");
    const file = event.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });
}

async function handleFile(file) {
  notice = { type: "loading", text: "正在解析 Excel 数据..." };
  renderNotice();

  try {
    const workbook = await readExcelFile(file);
    const nextState = buildDashboardState(workbook);
    dashboardState = nextState;
    await saveDashboardState(nextState);

    notice = {
      type: "success",
      text: `解析成功：识别 ${nextState.meta.recognizedNewsSections} 个新闻板块、${nextState.meta.recognizedTableSections} 个表格板块。`
    };
    renderDashboard();
  } catch (error) {
    notice = {
      type: "error",
      text: error instanceof Error ? error.message : "Excel 解析失败。"
    };
    renderNotice();
  }
}

function buildDashboardState(workbook) {
  const matches = matchWorkbookSections(workbook, dashboardConfig);
  const newsSections = matches.newsMatches.map(({ section, match }) => normalizeNewsSection(match, section));
  const tableSections = matches.tableMatches.map(({ section, match }) => normalizeTableSection(match, section));
  const warnings = [];

  if (!newsSections.some((section) => section.items.length)) {
    warnings.push("未识别到新闻板块，请检查 Excel 中的板块标题或 sheet 名。");
  }

  if (!tableSections.some((section) => section.rows.length)) {
    warnings.push("未识别到表格明细，请检查 Excel 表头和数据区域。");
  }

  return {
    meta: {
      mode: "uploaded",
      updatedAt: new Date().toISOString(),
      sheetCount: workbook.sheetCount,
      recognizedNewsSections: newsSections.filter((section) => section.items.length).length,
      recognizedTableSections: tableSections.filter((section) => section.rows.length).length,
      warnings
    },
    newsSections,
    tableSections
  };
}

function renderNotice() {
  const host = document.querySelector("#noticeHost");
  if (!host) return;
  host.replaceChildren();

  if (!notice && !dashboardState.meta?.warnings?.length) return;

  if (notice) {
    const node = document.createElement("div");
    node.className = `notice notice-${notice.type}`;
    const iconName = notice.type === "error" ? "circle-alert" : notice.type === "success" ? "circle-check" : "refresh-cw";
    node.innerHTML = `<i data-lucide="${iconName}"></i><span></span>`;
    node.querySelector("span").textContent = notice.text;
    host.append(node);
  }

  dashboardState.meta?.warnings?.forEach((warning) => {
    const node = document.createElement("div");
    node.className = "notice notice-warning";
    node.innerHTML = '<i data-lucide="triangle-alert"></i><span></span>';
    node.querySelector("span").textContent = warning;
    host.append(node);
  });

  createIcons({ icons });
}

function openTableSection(sectionKey) {
  window.location.href = `/table.html?section=${encodeURIComponent(sectionKey)}`;
}

function getDashboardSummary(state) {
  const newsCount = state.newsSections.reduce((total, section) => total + section.items.length, 0);
  const rowCount = state.tableSections.reduce((total, section) => total + section.rows.length, 0);
  const assistCount = state.tableSections.reduce((total, section) => total + computeTableMetrics(section).assistCount, 0);
  const tableCount = state.tableSections.filter((section) => section.rows.length).length;

  return { newsCount, rowCount, assistCount, tableCount };
}

function formatDateTime(value) {
  if (!value) return "未更新";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
