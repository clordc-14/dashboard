import { createIcons, icons } from "lucide";
import { dashboardConfig } from "./config/dashboardConfig.js";
import { demoWorkbookState as demoDashboardData } from "./config/demoWorkbookState.js";
import { readExcelFile } from "./parser/excelParser.js";
import { matchWorkbookSections } from "./parser/sectionMatcher.js";
import { normalizeNewsSection, normalizeTableSection } from "./parser/normalizer.js";
import { renderNewsSections } from "./render/newsRenderer.js";
import { renderTableCards } from "./render/tableRenderer.js";
import { loadDashboardState, saveDashboardState } from "./state/storage.js";
import "./styles/base.css";
import "./styles/dashboard.css";

const app = document.querySelector("#app");
const sinopharmLogoUrl = new URL("./assets/sinopharm-logo.png", import.meta.url).href;
const guideItems = ["创新药", "麻精", "罕见病", "集采原研", "HIV药品"];
let dashboardState = demoDashboardData;
let notice = null;

initializeDashboard();
window.addEventListener("afterprint", () => document.body.classList.remove("is-printing-pdf"));

async function initializeDashboard() {
  dashboardState = (await loadDashboardState()) || demoDashboardData;
  renderDashboard();
}

function renderDashboard() {
  const overview = getBusinessOverview(dashboardState);
  const meta = dashboardState.meta || {};

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="/" aria-label="国药西南新药引进网首页">
          <img class="brand-logo" src="${sinopharmLogoUrl}" alt="国药集团" />
          <div>
            <h1>国药西南新药引进网</h1>
            <p>新药引进经营看板</p>
          </div>
        </a>
        <div class="topbar-tools">
          <form class="keyword-search" action="/search.html" method="get" target="_blank">
            <label class="keyword-search-field">
              <i data-lucide="search"></i>
              <input name="q" type="search" placeholder="关键词检索" aria-label="关键词检索" required />
            </label>
            <button class="icon-button keyword-search-submit" type="submit" title="打开检索结果" aria-label="打开检索结果">
              <i data-lucide="arrow-up-right"></i>
            </button>
          </form>
          <div class="topbar-actions">
            <span class="last-update"><i data-lucide="clock-3"></i><span>${formatDateTime(meta.updatedAt)}</span></span>
            <button class="button button-ghost" id="pdfExportButton" type="button"><i data-lucide="file-down"></i><span>PDF 导出</span></button>
            <label class="button button-primary" for="excelInput"><i data-lucide="upload"></i><span>上传 Excel</span></label>
            <input id="excelInput" type="file" accept=".xlsx,.xls" hidden />
          </div>
        </div>
      </header>

      <nav class="guide-nav" aria-label="业务导引">
        ${guideItems
          .map((item, index) =>
            index === 0
              ? `<a class="guide-item is-active" href="#innovation-content">${item}</a>`
              : `<button class="guide-item" type="button" data-guide-pending="${item}">${item}</button>`
          )
          .join("")}
      </nav>

      <main id="innovation-content">
        <section class="status-band overview-band" id="uploadZone" aria-label="经营信息总览，可拖拽上传 Excel">
          <p class="business-overview"><strong>经营信息总览：</strong>${overview.text}</p>
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

      <div class="analysis-launcher" aria-label="数据分析功能">
        <button class="analysis-orb" type="button" aria-expanded="false" aria-controls="analysisMenu" title="数据分析">
          <i data-lucide="sparkles"></i>
        </button>
        <div class="analysis-menu" id="analysisMenu">
          <a class="analysis-menu-item" href="/analysis.html"><i data-lucide="factory"></i><span>厂牌分析</span></a>
          <a class="analysis-menu-item" href="/product-analysis.html"><i data-lucide="pill"></i><span>品种分析</span></a>
          <button class="analysis-menu-item" type="button" data-analysis-pending="靶点分析"><i data-lucide="target"></i><span>靶点分析</span></button>
        </div>
      </div>
    </div>
  `;

  bindUpload();
  bindGuideNav();
  bindPdfExport();
  bindAnalysisLauncher();
  renderNotice();
  renderNewsSections(document.querySelector("#newsSections"), dashboardState.newsSections, dashboardState.tableSections);
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

function bindGuideNav() {
  document.querySelectorAll("[data-guide-pending]").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.guidePending;
      notice = { type: "warning", text: `${name}板块尚待开发，当前首页先展示创新药相关信息。` };
      renderNotice();
      document.querySelector("#noticeHost")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function bindPdfExport() {
  document.querySelector("#pdfExportButton")?.addEventListener("click", () => {
    document.body.classList.add("is-printing-pdf");
    window.print();
  });
}

function bindAnalysisLauncher() {
  const launcher = document.querySelector(".analysis-launcher");
  const orb = launcher?.querySelector(".analysis-orb");
  if (!launcher || !orb) return;

  orb.addEventListener("click", () => {
    const isOpen = launcher.classList.toggle("is-open");
    orb.setAttribute("aria-expanded", String(isOpen));
  });

  launcher.querySelectorAll("[data-analysis-pending]").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.analysisPending;
      notice = { type: "warning", text: `${name}功能尚待补充，当前先开放厂牌分析。` };
      launcher.classList.remove("is-open");
      orb.setAttribute("aria-expanded", "false");
      renderNotice();
      document.querySelector("#noticeHost")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

function getBusinessOverview(state) {
  const poolSection = state.tableSections.find((section) => section.key === "innovativeDrugPool");
  const approved2026Rows = poolSection?.rows.filter((row) => getApprovalYear(row) === 2026) || [];
  const landedCount = approved2026Rows.filter((row) => isAffirmative(getRowField(row, "landedInSichuan"))).length;
  const archivedCount = approved2026Rows.filter((row) => isAffirmative(getRowField(row, "southwestArchived"))).length;
  const archiveRate = landedCount ? Math.round((archivedCount / landedCount) * 100) : 0;

  return {
    text: `2026年至今，NMPA批准上市创新药${approved2026Rows.length}个，落地四川${landedCount}个，国药西南建档${archivedCount}个，建档率${archiveRate}%。`
  };
}

function getRowField(row, field) {
  return row.fields?.[field] || row.values?.[field] || "";
}

function getApprovalYear(row) {
  return getDateParts(getRowField(row, "approvalDate"))?.year || 0;
}

function isAffirmative(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return (
    ["是", "yes", "y", "true", "1", "已落地", "已建档", "√"].includes(text) ||
    text.startsWith("是，") ||
    text.startsWith("是,")
  );
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
