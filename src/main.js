import { createIcons, icons } from "lucide";
import { dashboardConfig } from "./config/dashboardConfig.js";
import { controlledDrugDemoData } from "./config/controlledDrugDemoData.js";
import { demoWorkbookState as demoDashboardData } from "./config/demoWorkbookState.js";
import { buildControlledDrugDashboard } from "./controlledDrugDashboard.js";
import { readExcelFile } from "./parser/excelParser.js";
import { matchWorkbookSections } from "./parser/sectionMatcher.js";
import { normalizeNewsSection, normalizeTableSection } from "./parser/normalizer.js";
import { renderNewsSections } from "./render/newsRenderer.js";
import { renderTableCards } from "./render/tableRenderer.js";
import { buildResearchSurvey, getSurveyMetrics, isAffirmative as isSurveyAffirmative } from "./researchSurvey.js";
import { loadDashboardState, saveDashboardState } from "./state/storage.js";
import { formatRole, isAdministrator, loadCurrentUser } from "./userSession.js";
import "./styles/base.css";
import "./styles/dashboard.css";

const app = document.querySelector("#app");
const sinopharmLogoUrl = new URL("./assets/sinopharm-logo.png", import.meta.url).href;
const guideItems = ["创新药", "麻精", "罕见病", "集采原研", "HIV药品"];
const GUIDE_INNOVATION = "创新药";
const GUIDE_CONTROLLED_DRUGS = "麻精";
let dashboardState = demoDashboardData;
let notice = null;
let activeGuide = window.location.hash === "#controlled-drugs" ? GUIDE_CONTROLLED_DRUGS : GUIDE_INNOVATION;
let currentUser = { name: "当前用户", role: "viewer" };

initializeDashboard();
window.addEventListener("beforeprint", () => document.body.classList.add("is-printing-pdf"));
window.addEventListener("afterprint", () => document.body.classList.remove("is-printing-pdf"));

async function initializeDashboard() {
  const [storedState, user] = await Promise.all([loadDashboardState(), loadCurrentUser()]);
  dashboardState = storedState || demoDashboardData;
  currentUser = user;
  renderDashboard();
}

function renderDashboard() {
  const overview = getBusinessOverview(dashboardState);
  const meta = dashboardState.meta || {};
  const isControlledDrugGuide = activeGuide === GUIDE_CONTROLLED_DRUGS;

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
            <a class="user-greeting" href="/welcome.html" aria-label="打开欢迎页"><i data-lucide="circle-user-round"></i><span>欢迎，${escapeHtml(currentUser.name)}</span><small>${formatRole(currentUser)}</small></a>
            <button class="button button-ghost" id="pdfExportButton" type="button"><i data-lucide="file-down"></i><span>PDF 导出</span></button>
            ${
              isAdministrator(currentUser)
                ? '<label class="button button-primary" for="excelInput"><i data-lucide="upload"></i><span>上传 Excel</span></label><input id="excelInput" type="file" accept=".xlsx,.xls" hidden />'
                : ""
            }
          </div>
        </div>
      </header>

      <nav class="guide-nav" aria-label="业务导引">
        ${renderGuideItems()}
      </nav>

      ${
        isControlledDrugGuide
          ? renderControlledDrugDashboard()
          : renderInnovationDashboard(overview)
      }

      <div class="analysis-launcher" aria-label="数据分析功能">
        <button class="analysis-orb" type="button" aria-expanded="false" aria-controls="analysisMenu" title="数据分析">
          <i data-lucide="sparkles"></i>
        </button>
        <div class="analysis-menu" id="analysisMenu">
          <a class="analysis-menu-item" href="/analysis.html"><i data-lucide="factory"></i><span>厂牌分析</span></a>
          <a class="analysis-menu-item" href="/product-analysis.html"><i data-lucide="pill"></i><span>品种分析</span></a>
          <a class="analysis-menu-item" href="/target-analysis.html"><i data-lucide="target"></i><span>靶点分析</span></a>
        </div>
      </div>
    </div>
  `;

  bindUpload();
  bindGuideNav();
  bindPdfExport();
  bindAnalysisLauncher();
  renderNotice();
  const newsContainer = document.querySelector("#newsSections");
  const tableContainer = document.querySelector("#tableCards");
  if (newsContainer) renderNewsSections(newsContainer, dashboardState.newsSections, dashboardState.tableSections);
  if (tableContainer) renderTableCards(tableContainer, dashboardState.tableSections, openTableSection);
  createIcons({ icons });
}

function renderGuideItems() {
  return guideItems
    .map((item) => {
      const isActive = item === activeGuide;
      const current = isActive ? ' aria-current="page"' : "";
      return `<button class="guide-item${isActive ? " is-active" : ""}" type="button" data-guide-target="${item}"${current}>${item}</button>`;
    })
    .join("");
}

function renderInnovationDashboard(overview) {
  const hasNews = dashboardState.newsSections.some((section) => section.items.length);
  const hasTableData = dashboardState.tableSections.some((section) => section.rows.length);

  return `
      <main id="innovation-content">
        <section class="status-band overview-band${isAdministrator(currentUser) ? "" : " is-readonly"}"${isAdministrator(currentUser) ? ' id="uploadZone" aria-label="经营信息总览，可拖拽上传 Excel"' : ' aria-label="经营信息总览"'}>
          <div>
            <p class="business-overview"><strong>经营信息总览：</strong>${overview.text}</p>
            ${overview.researchMetrics ? renderResearchProgress(overview.researchMetrics) : renderResearchImportHint()}
          </div>
          <a class="survey-entry-card" href="/survey.html">
            <span><small>Research Survey</small><strong>调研信息填写</strong><em>${overview.researchMetrics ? `还有 ${overview.researchMetrics.currentUserPendingCount} 项待处理` : "上传调研表后开始填写"}</em></span>
            <i data-lucide="arrow-up-right"></i>
          </a>
        </section>

        <div id="noticeHost"></div>

        ${
          hasNews
            ? `
              <section class="content-band">
                <div class="section-heading">
                  <div>
                    <span class="eyebrow">News</span>
                    <h2>动态新闻板块</h2>
                  </div>
                </div>
                <div id="newsSections" class="news-grid"></div>
              </section>
            `
            : ""
        }

        ${
          hasTableData
            ? `
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
            `
            : ""
        }
      </main>
  `;
}

function renderResearchProgress(metrics) {
  return `
    <div class="research-progress" aria-label="调研进度">
      <span>截至今日，共调研 <strong>${metrics.totalCount}</strong> 项</span>
      <span>已完成填写 <strong>${metrics.completeCount}</strong> 项</span>
      <span>待完善 <strong>${metrics.incompleteCount}</strong> 项</span>
      <span>您待完善 <strong>${metrics.currentUserPendingCount}</strong> 项</span>
    </div>
  `;
}

function renderResearchImportHint() {
  return `
    <p class="research-import-hint">尚未识别到“网站用表—调研表”。${isAdministrator(currentUser) ? "可上传附件后生成实时调研进度。" : "请联系管理员导入调研数据。"}</p>
  `;
}

function renderControlledDrugDashboard() {
  const { overview, categories, salesPeriods } = dashboardState.controlledDrug || controlledDrugDemoData;
  const salesText = formatHundredMillion(overview.salesTotal);

  return `
      <main id="controlled-drug-content" class="controlled-main">
        <section class="controlled-overview-band" aria-label="麻精经营信息总览">
          <div class="controlled-overview-copy">
            <p class="business-overview">
              <strong>经营信息总览：</strong>依照《药用类精神药品目录（2025 年版）》、《药用类麻醉药品目录（2025 年版）》，麻精药品共<strong>${overview.catalogCount}</strong>个，有上市药品的<strong>${overview.marketedCount}</strong>个，国药西南建档<strong>${overview.archivedCount}</strong>个，建档率<strong>${overview.archiveRate}%</strong>，${overview.salesYear}年累计销售<strong>${salesText}</strong>。
            </p>
          </div>
          <div class="controlled-overview-layout">
            ${renderControlledOverviewTable(categories)}
            ${renderControlledSalesPanel(salesPeriods, categories)}
          </div>
        </section>

        <div id="noticeHost"></div>

        <section class="controlled-category-stack" aria-label="麻精药品分类展示">
          ${categories.map(renderControlledCategory).join("")}
        </section>
      </main>
  `;
}

function renderControlledOverviewTable(categories) {
  return `
    <div class="controlled-overview-table-card">
      <div class="controlled-panel-heading">
        <h2>目录建档概览</h2>
        <span>动态汇总</span>
      </div>
      <div class="table-wrap controlled-overview-table">
        <table>
          <thead>
            <tr>
              <th>目录分类</th>
              <th>目录品种</th>
              <th>国内上市品种</th>
              <th>西南建档品种</th>
              <th>实际建档率</th>
              <th>未建档品种</th>
            </tr>
          </thead>
          <tbody>
            ${categories
              .map(
                (category) => `
                  <tr>
                    <th scope="row"><span class="controlled-type-dot" style="--category-color: ${category.color}"></span>${escapeHtml(category.title)}</th>
                    <td>${category.catalogCount}</td>
                    <td>${category.domesticCount}</td>
                    <td>${category.archivedCount}</td>
                    <td><strong>${category.archiveRate}%</strong></td>
                    <td>${renderInlineList(category.unarchived)}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderControlledSalesPanel(periods, categories) {
  return `
    <section class="controlled-sales-panel">
      <div class="controlled-panel-heading">
        <h2>销售额趋势</h2>
        <span>分类销售与合计</span>
      </div>
      ${renderCombinedSalesChart(periods, categories)}
    </section>
  `;
}

function renderControlledCategory(category) {
  return `
    <article class="controlled-category" style="--category-color: ${category.color}">
      <div class="controlled-category-title">
        <h2>${category.title}</h2>
        <span>${category.archiveRate}% 建档率</span>
      </div>
      <div class="controlled-category-grid">
        <div class="controlled-category-left">
          <div class="controlled-stat-row">
            ${renderControlledStat("目录品种", category.catalogCount)}
            ${renderControlledStat("国内上市", category.domesticCount)}
            ${renderControlledStat("西南建档", category.archivedCount)}
          </div>
          <section class="controlled-detail-panel">
            <div class="controlled-detail-heading">
              <h3>未建档品种</h3>
              <span>${Math.max(category.domesticCount - category.archivedCount, 0)} 个</span>
            </div>
            ${renderUnarchivedList(category.unarchived)}
          </section>
        </div>
        <section class="controlled-detail-panel">
          <div class="controlled-detail-heading">
            <h3>销售 TOP5 品种</h3>
            <span>${category.topSalesYear ? `${category.topSalesYear}年销售` : "待补销售数据"}</span>
          </div>
          ${renderTopProducts(category.topProducts, category.topSalesYear)}
        </section>
        <section class="controlled-detail-panel">
          <div class="controlled-detail-heading">
            <h3>经营关注</h3>
            <span>动态提醒</span>
          </div>
          ${renderManagementFocus(category)}
        </section>
      </div>
    </article>
  `;
}

function renderControlledStat(label, value) {
  return `
    <div class="controlled-stat">
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `;
}

function renderInlineList(items) {
  return items.length
    ? `<span class="controlled-inline-list">${items.map((item) => escapeHtml(item.name || item)).join("、")}</span>`
    : "/";
}

function renderUnarchivedList(items) {
  if (!items.length) return '<div class="empty-state">暂无未建档品种</div>';
  return `
    <div class="controlled-unarchived-list">
      ${items
        .map((item) => {
          const management = item.management || [];
          const details = management.length
            ? management
                .map((entry) => {
                  const label = [entry.product, entry.status].filter(Boolean).join("：") || "已列入未建档管理";
                  return `<small>${escapeHtml(label)}</small>`;
                })
                .join("")
            : "<small>未建档管理中暂未补充品种现状</small>";
          return `<article><strong>${escapeHtml(item.name || item)}</strong>${details}</article>`;
        })
        .join("")}
    </div>
  `;
}

function renderTopProducts(items, year) {
  if (!items.length) return '<div class="empty-state">未识别到该分类的销售明细</div>';
  return `
    <ol class="controlled-top-products">
      ${items
        .map(
          (item, index) => `
            <li>
              <span class="controlled-rank">${index + 1}</span>
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <small>${escapeHtml(item.indication || "暂未填写适应症")}</small>
              </div>
              <em>${formatTopSalesAmount(item.sales)}${year ? " 万元" : ""}</em>
            </li>
          `
        )
        .join("")}
    </ol>
  `;
}

function renderManagementFocus(category) {
  const unarchivedCount = Math.max(category.domesticCount - category.archivedCount, 0);
  const managedItems = category.unarchived.filter((item) => item.management?.length);
  const missingItems = category.unarchived.filter((item) => !item.management?.length);
  const coverage = category.unarchived.length ? Math.round((managedItems.length / category.unarchived.length) * 100) : 100;

  return `
    <div class="controlled-note-stack">
      <p>国内上市品种中有 <strong>${unarchivedCount}</strong> 个尚未建档，当前建档覆盖率为 <strong>${category.archiveRate}%</strong>。</p>
      <p>“未建档管理”已匹配 <strong>${managedItems.length}</strong> 个品种，现状信息覆盖 <strong>${coverage}%</strong>。</p>
    </div>
    ${
      missingItems.length
        ? `<div class="controlled-action-list"><span><i data-lucide="circle-alert"></i>待补充现状：${escapeHtml(missingItems.map((item) => item.name).join("、"))}</span></div>`
        : '<div class="controlled-action-list"><span><i data-lucide="circle-check"></i>未建档品种均已在管理表中补充品种现状</span></div>'
    }
  `;
}

function renderCombinedSalesChart(periods, categories) {
  if (!periods?.length) return '<div class="empty-state">未识别到年度销售数据</div>';

  const width = Math.max(600, periods.length * 142);
  const height = 308;
  const margin = { top: 24, right: 28, bottom: 54, left: 68 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(1, ...periods.map((period) => period.total));
  const yMax = getChartMax(maxValue);
  const xStep = chartWidth / periods.length;
  const barWidth = Math.min(22, Math.max(12, (xStep - 28) / categories.length));
  const barGap = 5;
  const barsWidth = categories.length * barWidth + (categories.length - 1) * barGap;
  const yFor = (value) => margin.top + chartHeight - (Number(value || 0) / yMax) * chartHeight;
  const xFor = (index) => margin.left + index * xStep + xStep / 2;
  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const value = (yMax * (4 - index)) / 4;
    const y = margin.top + (chartHeight * index) / 4;
    return `<g><line class="controlled-chart-grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" /><text class="controlled-chart-axis" x="${margin.left - 10}" y="${y + 4}" text-anchor="end">${formatSalesAxis(value)}</text></g>`;
  }).join("");
  const bars = periods
    .flatMap((period, periodIndex) =>
      categories.map((category, categoryIndex) => {
        const value = Number(period.values?.[category.key] || 0);
        const x = xFor(periodIndex) - barsWidth / 2 + categoryIndex * (barWidth + barGap);
        const y = yFor(value);
        const barHeight = margin.top + chartHeight - y;
        return `<rect class="controlled-chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="3" fill="${category.color}"><title>${escapeHtml(category.title)} · ${period.year}销售：${formatSalesAmount(value)}万元</title></rect>`;
      })
    )
    .join("");
  const totalPoints = periods.map((period, index) => `${xFor(index)},${yFor(period.total)}`).join(" ");
  const pointMarkers = periods
    .map((period, index) => `<circle class="controlled-chart-total-point" cx="${xFor(index)}" cy="${yFor(period.total)}" r="4"><title>合计 · ${period.year}销售：${formatSalesAmount(period.total)}万元</title></circle>`)
    .join("");
  const labels = periods
    .map((period, index) => `<text class="controlled-chart-axis" x="${xFor(index)}" y="${height - 22}" text-anchor="middle">${String(period.year).slice(-2)}销售</text>`)
    .join("");
  const legend = [
    ...categories.map((category) => ({ label: category.title, color: category.color, type: "bar" })),
    { label: "合计", color: "#243f6c", type: "line" }
  ]
    .map((item) => `<span class="controlled-chart-legend-${item.type}" style="--legend-color: ${item.color}">${escapeHtml(item.label)}</span>`)
    .join("");

  return `
    <div class="controlled-sales-chart">
      <div class="controlled-chart-legend">${legend}</div>
      <div class="controlled-chart-scroll">
        <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="按麻醉药品、第一类精神药品、第二类精神药品及合计展示的年度销售额组合图">
          ${gridLines}
          <line class="controlled-chart-axis-line" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" />
          ${bars}
          <polyline class="controlled-chart-total-line" points="${totalPoints}" />
          ${pointMarkers}
          ${labels}
        </svg>
      </div>
      <small>单位：万元；柱形表示各目录分类，折线表示合计。</small>
    </div>
  `;
}

function getChartMax(value) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  return Math.ceil(value / magnitude) * magnitude;
}

function formatSalesAmount(value) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatTopSalesAmount(value) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatSalesAxis(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k` : formatSalesAmount(value);
}

function formatHundredMillion(value) {
  return `${(Number(value || 0) / 10000).toFixed(2)}亿元`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function bindUpload() {
  const input = document.querySelector("#excelInput");
  const uploadZone = document.querySelector("#uploadZone");

  if (!input) return;

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    input.value = "";
    if (file) handleFile(file);
  });

  if (!uploadZone) return;

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
  document.querySelectorAll("[data-guide-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.guideTarget;
      if ([GUIDE_INNOVATION, GUIDE_CONTROLLED_DRUGS].includes(name)) {
        activeGuide = name;
        notice = null;
        const hash = name === GUIDE_CONTROLLED_DRUGS ? "#controlled-drugs" : window.location.pathname;
        window.history.replaceState(null, "", hash);
        renderDashboard();
        return;
      }

      notice = { type: "warning", text: `${name}板块尚待开发，当前先展示${activeGuide}相关信息。` };
      renderNotice();
      document.querySelector("#noticeHost")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function bindPdfExport() {
  document.querySelector("#pdfExportButton")?.addEventListener("click", () => {
    document.body.classList.add("is-printing-pdf");
    requestAnimationFrame(() => window.print());
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
      text: `解析成功：识别 ${nextState.meta.recognizedNewsSections} 个新闻板块、${nextState.meta.recognizedTableSections} 个表格板块${nextState.researchSurvey ? `、${nextState.researchSurvey.records.length} 条调研记录` : ""}${nextState.meta.recognizedControlledDrugDashboard ? "，并已更新麻精经营看板" : ""}。`
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
  const controlledDrug = buildControlledDrugDashboard(workbook);
  const researchSurvey = buildResearchSurvey(workbook);
  const warnings = [];

  if (!newsSections.some((section) => section.items.length) && !researchSurvey) {
    warnings.push("未识别到新闻板块，请检查 Excel 中的板块标题或 sheet 名。");
  }

  if (!tableSections.some((section) => section.rows.length) && !researchSurvey) {
    warnings.push("未识别到表格明细，请检查 Excel 表头和数据区域。");
  }

  if (workbook.sheetNames.some((name) => String(name).replace(/[\s—_()（）]/g, "") === "网站用表麻精") && !controlledDrug) {
    warnings.push("已识别“网站用表—麻精”工作表，但未找到完整的麻精字段，请检查是否包含序号、中文名、分类等表头。");
  }

  return {
    meta: {
      mode: "uploaded",
      updatedAt: new Date().toISOString(),
      sheetCount: workbook.sheetCount,
      recognizedNewsSections: newsSections.filter((section) => section.items.length).length,
      recognizedTableSections: tableSections.filter((section) => section.rows.length).length,
      recognizedControlledDrugDashboard: Boolean(controlledDrug),
      warnings
    },
    newsSections,
    tableSections,
    controlledDrug,
    researchSurvey
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
  const survey = state.researchSurvey;
  if (survey?.records?.length) {
    const currentYear = new Date().getFullYear();
    const approvedThisYear = survey.records.filter((record) => getDateParts(record.approvalDate)?.year === currentYear);
    const landedCount = approvedThisYear.filter((record) => isSurveyAffirmative(record.landedInSichuan)).length;
    const archivedCount = approvedThisYear.filter((record) => isSurveyAffirmative(record.southwestArchived)).length;
    const archiveRate = landedCount ? Math.round((archivedCount / landedCount) * 100) : 0;

    return {
      text: `${currentYear}年至今，NMPA批准上市创新药${approvedThisYear.length}个，落地四川${landedCount}个，国药西南建档${archivedCount}个，建档率${archiveRate}%。`,
      researchMetrics: getSurveyMetrics(survey, currentUser.name)
    };
  }

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
