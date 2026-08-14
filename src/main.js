import { createIcons, icons } from "lucide";
import { dashboardConfig } from "./config/dashboardConfig.js";
import { controlledDrugDemoData } from "./config/controlledDrugDemoData.js";
import { rareDiseaseDemoData } from "./config/rareDiseaseDemoData.js";
import { procurementOriginatorDemoData } from "./config/procurementOriginatorDemoData.js";
import { hivDemoData } from "./config/hivDemoData.js";
import { demoWorkbookState as demoDashboardData } from "./config/demoWorkbookState.js";
import { buildControlledDrugDashboard } from "./controlledDrugDashboard.js";
import { buildRareDiseaseDashboard, getRareDiseaseYearAnalysis } from "./rareDiseaseDashboard.js";
import { renderHivDashboard, renderProcurementOriginatorDashboard } from "./specialtyDashboards.js";
import { answerDataQuestion, appendAssistantMessage, askDeepSeekAssistant, createAssistantState, renderDataAssistant } from "./dataAssistant.js";
import { readExcelFile } from "./parser/excelParser.js";
import { matchWorkbookSections } from "./parser/sectionMatcher.js";
import { normalizeNewsSection, normalizeTableSection } from "./parser/normalizer.js";
import { renderNewsSections } from "./render/newsRenderer.js";
import { getInnovativePoolMonths, getInnovativePoolRangeAnalysis, renderInnovativePoolOverview, renderTableCards } from "./render/tableRenderer.js";
import { buildResearchSurvey, getSurveyMetrics, isAffirmative as isSurveyAffirmative } from "./researchSurvey.js";
import { loadDashboardState, saveDashboardState } from "./state/storage.js";
import { canAccessLibrary, formatRole, isAdministrator, loadCurrentUser } from "./userSession.js";
import "./styles/base.css";
import "./styles/dashboard.css";

const app = document.querySelector("#app");
const sinopharmLogoUrl = new URL("./assets/sinopharm-logo.png", import.meta.url).href;
const guideItems = ["创新药", "麻精", "罕见病", "集采原研", "HIV药品"];
const GUIDE_INNOVATION = "创新药";
const GUIDE_CONTROLLED_DRUGS = "麻精";
const GUIDE_RARE_DISEASES = "罕见病";
const GUIDE_PROCUREMENT_ORIGINATOR = "集采原研";
const GUIDE_HIV = "HIV药品";
let dashboardState = demoDashboardData;
let notice = null;
let activeGuide = getActiveGuideFromHash();
let currentUser = { name: "当前用户", role: "viewer" };
let innovationUi = { overviewStartMonth: null, overviewEndMonth: null };
let rareDiseaseUi = {
  overviewStartYear: null,
  overviewEndYear: null,
  indicationStartYear: null,
  indicationEndYear: null,
  brandStartYear: null,
  brandEndYear: null,
  unarchivedStartYear: null,
  unarchivedEndYear: null,
  selectedIndication: "",
  searchTerm: "",
  recordArchiveStatus: "all",
  recordBrand: "",
  recordIndication: "",
  recordApprovalYear: "",
  recordSortKey: "",
  recordSortDirection: "asc",
  recordPage: 1,
  recordPageSize: 12
};
let procurementOriginatorUi = createSpecialtyTableState();
let hivUi = createSpecialtyTableState();
let dataAssistantUi = createAssistantState();
let dataAssistantNudgeTimer;
let dataAssistantNudgeHideTimer;
let dataAssistantNudgeHasBeenShown = false;

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
  const isRareDiseaseGuide = activeGuide === GUIDE_RARE_DISEASES;
  const isProcurementOriginatorGuide = activeGuide === GUIDE_PROCUREMENT_ORIGINATOR;
  const isHivGuide = activeGuide === GUIDE_HIV;

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
            ${canAccessLibrary(currentUser) ? '<a class="button button-ghost" href="/files.html"><i data-lucide="folder-open"></i><span>资料库</span></a>' : ""}
            ${isAdministrator(currentUser) ? '<a class="button button-ghost" href="/users.html"><i data-lucide="users-round"></i><span>用户管理</span></a>' : ""}
            <a class="user-greeting" href="/welcome.html" aria-label="打开欢迎页"><i data-lucide="circle-user-round"></i><span>欢迎，${escapeHtml(currentUser.name)}</span><small>${formatRole(currentUser)}</small></a>
          <button class="button button-ghost" id="pdfExportButton" type="button"><i data-lucide="file-down"></i><span>导出文档</span></button>
            ${
              isAdministrator(currentUser)
            ? '<label class="button button-primary" for="excelInput"><i data-lucide="upload"></i><span>上传表格</span></label><input id="excelInput" type="file" accept=".xlsx,.xls" hidden />'
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
          : isRareDiseaseGuide
            ? renderRareDiseaseDashboard()
            : isProcurementOriginatorGuide
              ? renderProcurementOriginatorDashboard(dashboardState.procurementOriginator || procurementOriginatorDemoData, procurementOriginatorUi)
              : isHivGuide
                ? renderHivDashboard(dashboardState.hiv || hivDemoData, hivUi)
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

      ${renderDataAssistant(dataAssistantUi, activeGuide)}
    </div>
  `;

  bindUpload();
  bindGuideNav();
  bindPdfExport();
  bindAnalysisLauncher();
  bindInnovationDashboard();
  bindRareDiseaseDashboard();
  bindSpecialtyDashboards();
  bindDataAssistant();
  renderNotice();
  const newsContainer = document.querySelector("#newsSections");
  const tableContainer = document.querySelector("#tableCards");
  const innovationPoolSection = dashboardState.tableSections.find((section) => section.key === "innovativeDrugPool");
  const innovationPoolBody = document.querySelector("#innovationPoolOverview");
  if (innovationPoolSection && innovationPoolBody) {
    renderInnovativePoolOverview(
      innovationPoolBody,
      getInnovativePoolRangeAnalysis(innovationPoolSection, innovationUi.overviewStartMonth, innovationUi.overviewEndMonth)
    );
  }
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
  const hasTableData = dashboardState.tableSections.some((section) => section.rows.length && section.key !== "innovativeDrugPool");
  const poolSection = dashboardState.tableSections.find((section) => section.key === "innovativeDrugPool");
  const availableMonths = getInnovativePoolMonths(poolSection);
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const selectableMonths = availableMonths.length ? availableMonths : [currentMonth];
  const selectableYears = [...new Set(selectableMonths.map((month) => month.slice(0, 4)))];

  if (!selectableMonths.includes(innovationUi.overviewStartMonth)) {
    innovationUi.overviewStartMonth = selectableMonths[0];
  }
  if (!selectableMonths.includes(innovationUi.overviewEndMonth)) {
    innovationUi.overviewEndMonth = selectableMonths.at(-1);
  }
  if (innovationUi.overviewStartMonth > innovationUi.overviewEndMonth) {
    innovationUi.overviewEndMonth = innovationUi.overviewStartMonth;
  }

  const poolAnalysis = getInnovativePoolRangeAnalysis(poolSection, innovationUi.overviewStartMonth, innovationUi.overviewEndMonth);
  const sourceName = poolSection?.source?.sheetName || "创新药表格";
  const periodLabel = poolAnalysis.startMonth === poolAnalysis.endMonth ? formatInnovationMonth(poolAnalysis.startMonth) : `${formatInnovationMonth(poolAnalysis.startMonth)}至${formatInnovationMonth(poolAnalysis.endMonth)}`;
  const [startYear, startMonth] = poolAnalysis.startMonth.split("-");
  const [endYear, endMonth] = poolAnalysis.endMonth.split("-");

  return `
      <main id="innovation-content" class="innovation-main">
        <section class="status-band innovation-hero${isAdministrator(currentUser) ? "" : " is-readonly"}"${isAdministrator(currentUser) ? ' id="uploadZone" aria-label="上市创新药品种池，可拖拽上传表格"' : ' aria-label="上市创新药品种池"'}>
          <div class="innovation-hero-heading">
            <div class="innovation-hero-copy">
              <span class="eyebrow">创新药</span>
              <h2>上市创新药品种池</h2>
              <p>${periodLabel}，国家药监局批准 <strong>${poolAnalysis.totals.newDrugCount}</strong> 个品种，落地四川 <strong>${poolAnalysis.totals.landedSichuanCount}</strong> 个，国药西南建档 <strong>${poolAnalysis.totals.southwestArchivedCount}</strong> 个，建档率 <strong>${poolAnalysis.archiveRate}%</strong>。</p>
              ${overview.researchMetrics ? renderResearchProgress(overview.researchMetrics) : renderResearchImportHint()}
            </div>
            <div class="innovation-hero-actions">
              <div class="innovation-overview-tools">
                <div class="innovation-overview-range" aria-label="总览统计时段"><span><i data-lucide="calendar-range"></i>统计时段</span><select id="innovationOverviewStartYear" aria-label="开始年份">${selectableYears
                  .map((year) => `<option value="${year}"${year === startYear ? " selected" : ""}>${year}年</option>`)
                  .join("")}</select><select id="innovationOverviewStartMonth" aria-label="开始月份">${renderInnovationMonthOptions(startMonth)}</select><b>至</b><select id="innovationOverviewEndYear" aria-label="结束年份">${selectableYears
                  .map((year) => `<option value="${year}"${year === endYear ? " selected" : ""}>${year}年</option>`)
                  .join("")}</select><select id="innovationOverviewEndMonth" aria-label="结束月份">${renderInnovationMonthOptions(endMonth)}</select></div>
                <span class="innovation-source-badge"><i data-lucide="database"></i>${escapeHtml(sourceName)}</span>
                <a class="innovation-table-link" href="/table.html?section=innovativeDrugPool"><span>查看品种明细</span><i data-lucide="arrow-up-right"></i></a>
              </div>
              <a class="survey-entry-card innovation-survey-entry" href="/survey.html">
                <span><small>调研填报</small><strong>调研信息填写</strong><em>${overview.researchMetrics ? `还有 ${overview.researchMetrics.currentUserPendingCount} 项待处理` : "上传调研表后开始填写"}</em></span>
                <i data-lucide="arrow-up-right"></i>
              </a>
            </div>
          </div>
          <div id="innovationPoolOverview" class="innovation-pool-overview" aria-live="polite"></div>
        </section>

        <div id="noticeHost"></div>

        ${
          hasNews
            ? `
              <section class="content-band innovation-news-section">
                <div class="section-heading">
                  <div>
                    <span class="eyebrow">实时动态</span>
                    <h2>本周关注与引进进展</h2>
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
              <section class="content-band innovation-workbench-section">
                <div class="section-heading">
                  <div>
                    <span class="eyebrow">重点跟进</span>
                    <h2>品种引进与建档工作台</h2>
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

function renderRareDiseaseDashboard() {
  const dashboard = dashboardState.rareDisease || rareDiseaseDemoData;
  const availableYears = (dashboard.analysisYears?.length ? dashboard.analysisYears : [dashboard.overview.year]).slice().sort((left, right) => left - right);
  const defaultAnalysisYear = dashboard.defaultAnalysisYear || dashboard.overview.year;
  if (!availableYears.includes(Number(rareDiseaseUi.overviewStartYear))) {
    rareDiseaseUi.overviewStartYear = availableYears[0];
  }
  if (!availableYears.includes(Number(rareDiseaseUi.overviewEndYear))) {
    rareDiseaseUi.overviewEndYear = availableYears.at(-1);
  }
  if (Number(rareDiseaseUi.overviewStartYear) > Number(rareDiseaseUi.overviewEndYear)) {
    rareDiseaseUi.overviewEndYear = rareDiseaseUi.overviewStartYear;
  }
  if (!availableYears.includes(Number(rareDiseaseUi.indicationStartYear))) {
    rareDiseaseUi.indicationStartYear = defaultAnalysisYear;
  }
  if (!availableYears.includes(Number(rareDiseaseUi.indicationEndYear))) {
    rareDiseaseUi.indicationEndYear = defaultAnalysisYear;
  }
  if (Number(rareDiseaseUi.indicationStartYear) > Number(rareDiseaseUi.indicationEndYear)) {
    rareDiseaseUi.indicationEndYear = rareDiseaseUi.indicationStartYear;
  }
  if (!availableYears.includes(Number(rareDiseaseUi.brandStartYear))) {
    rareDiseaseUi.brandStartYear = defaultAnalysisYear;
  }
  if (!availableYears.includes(Number(rareDiseaseUi.brandEndYear))) {
    rareDiseaseUi.brandEndYear = defaultAnalysisYear;
  }
  if (Number(rareDiseaseUi.brandStartYear) > Number(rareDiseaseUi.brandEndYear)) {
    rareDiseaseUi.brandEndYear = rareDiseaseUi.brandStartYear;
  }
  if (!availableYears.includes(Number(rareDiseaseUi.unarchivedStartYear))) {
    rareDiseaseUi.unarchivedStartYear = availableYears[0];
  }
  if (!availableYears.includes(Number(rareDiseaseUi.unarchivedEndYear))) {
    rareDiseaseUi.unarchivedEndYear = availableYears.at(-1);
  }
  if (Number(rareDiseaseUi.unarchivedStartYear) > Number(rareDiseaseUi.unarchivedEndYear)) {
    rareDiseaseUi.unarchivedEndYear = rareDiseaseUi.unarchivedStartYear;
  }

  const indicationAnalysis = getRareDiseaseRangeAnalysis(dashboard, rareDiseaseUi.indicationStartYear, rareDiseaseUi.indicationEndYear);
  const brandAnalysis = getRareDiseaseRangeAnalysis(dashboard, rareDiseaseUi.brandStartYear, rareDiseaseUi.brandEndYear);
  const overviewRange = getRareOverviewRange(dashboard, rareDiseaseUi.overviewStartYear, rareDiseaseUi.overviewEndYear);
  const unarchivedAnalysis = getRareUnarchivedAnalysis(dashboard, rareDiseaseUi.unarchivedStartYear, rareDiseaseUi.unarchivedEndYear);
  const selectedIndication =
    indicationAnalysis.indications.find((item) => item.name === rareDiseaseUi.selectedIndication) || indicationAnalysis.indications[0] || null;
  rareDiseaseUi.selectedIndication = selectedIndication?.name || "";

  return `
      <main id="rare-disease-content" class="rare-main">
        <section class="rare-hero" aria-label="罕见病经营信息总览">
          <div class="rare-hero-heading">
            <div>
              <span class="eyebrow">罕见病</span>
              <h2>罕见病经营信息总览</h2>
              <p>${overviewRange.startYear} 至 ${overviewRange.endYear} 年，国家药监局批准 <strong>${overviewRange.approvedCount}</strong> 个品种，国药西南建档 <strong>${overviewRange.archivedCount}</strong> 个，整体引进率 <strong>${overviewRange.archiveRate}%</strong>。</p>
            </div>
            <div class="rare-hero-tools">
              <label class="rare-overview-range" aria-label="总览统计时段"><span><i data-lucide="calendar-range"></i>统计时段</span><select id="rareOverviewStartYear" aria-label="开始年份">${availableYears
                .map((year) => `<option value="${year}"${Number(year) === Number(overviewRange.startYear) ? " selected" : ""}>${year} 年</option>`)
                .join("")}</select><b>至</b><select id="rareOverviewEndYear" aria-label="结束年份">${availableYears
                .map((year) => `<option value="${year}"${Number(year) === Number(overviewRange.endYear) ? " selected" : ""}>${year} 年</option>`)
                .join("")}</select></label>
              <span class="rare-source-badge"><i data-lucide="database"></i>6年上市罕见病用药</span>
            </div>
          </div>
          <div class="rare-kpi-grid">
            ${renderRareKpi("国家药监局批准品种", overviewRange.approvedCount, "个", "stamp")}
            ${renderRareKpi("国药西南建档", overviewRange.archivedCount, "个", "folder-check")}
            ${renderRareKpi("整体引进率", overviewRange.archiveRate, "%", "chart-no-axes-combined")}
            ${renderRareKpi("区间销售", formatTopSalesAmount(overviewRange.salesTotal), "万元", "badge-dollar-sign")}
          </div>

          <section class="rare-hero-trend" aria-label="年度罕见病药品与销售趋势">
            <div class="rare-panel-heading">
              <div>
                <span class="eyebrow">年度趋势</span>
                <h2>年度品种与销售趋势</h2>
              </div>
            </div>
            <div class="rare-trend-layout">
              ${renderRareTrendChart(overviewRange.trend)}
              ${renderRareTrendHighlights(dashboard, overviewRange.startYear, overviewRange.endYear)}
            </div>
          </section>
        </section>

        <div id="noticeHost"></div>

        <section class="rare-analysis-section" aria-label="适应症与厂牌分析">
          <section class="rare-analysis-group" aria-label="适应症分析">
            <div class="rare-section-heading">
              <div>
                <span class="eyebrow">适应症分析</span>
                <h2>适应症分析</h2>
              </div>
              <label class="rare-range-filter" aria-label="适应症分析时段"><span>分析时段</span><select id="rareIndicationStartYear" aria-label="适应症分析开始年份">${availableYears
                .map((year) => `<option value="${year}"${Number(year) === Number(indicationAnalysis.startYear) ? " selected" : ""}>${year} 年</option>`)
                .join("")}</select><b>至</b><select id="rareIndicationEndYear" aria-label="适应症分析结束年份">${availableYears
                .map((year) => `<option value="${year}"${Number(year) === Number(indicationAnalysis.endYear) ? " selected" : ""}>${year} 年</option>`)
                .join("")}</select></label>
            </div>

            <div class="rare-analysis-grid">
              <article class="rare-panel rare-analysis-card">
                <div class="rare-panel-heading compact">
                  <div><span class="eyebrow">适应症构成</span><h2>适应症销售占比</h2></div>
                  <p>${indicationAnalysis.periodLabel} · ${formatTopSalesAmount(indicationAnalysis.indicationTotal)} 万元</p>
                </div>
                ${renderRareDonut(indicationAnalysis)}
              </article>
              <article class="rare-panel rare-analysis-card">
                <div class="rare-panel-heading compact">
                  <div><span class="eyebrow">适应症排名</span><h2>适应症销售排名</h2></div>
                  <p>单位：万元</p>
                </div>
                ${renderRareRankedBars(indicationAnalysis.indications, "sales", "万元", true)}
              </article>
            </div>

            ${renderRareIndicationDetail(selectedIndication, indicationAnalysis.periodLabel)}
          </section>

          <section class="rare-analysis-group rare-brand-section" aria-label="厂牌分析">
            <div class="rare-brand-heading">
              <div><span class="eyebrow">厂牌分析</span><h2>厂牌分析</h2></div>
              <label class="rare-range-filter" aria-label="厂牌分析时段"><span>分析时段</span><select id="rareBrandStartYear" aria-label="厂牌分析开始年份">${availableYears
                .map((year) => `<option value="${year}"${Number(year) === Number(brandAnalysis.startYear) ? " selected" : ""}>${year} 年</option>`)
                .join("")}</select><b>至</b><select id="rareBrandEndYear" aria-label="厂牌分析结束年份">${availableYears
                .map((year) => `<option value="${year}"${Number(year) === Number(brandAnalysis.endYear) ? " selected" : ""}>${year} 年</option>`)
                .join("")}</select></label>
            </div>
            <p class="rare-brand-description">按所选时段，分别比较获批数量与累计销售金额。</p>
            <div class="rare-analysis-grid">
              <article class="rare-panel rare-analysis-card">
                <div class="rare-panel-heading compact"><div><span class="eyebrow">获批情况</span><h2>${brandAnalysis.periodLabel}获批数量</h2></div><p>按通用名计数</p></div>
                ${renderRareRankedBars(brandAnalysis.approvalBrands, "approvalCount", "个", false)}
              </article>
              <article class="rare-panel rare-analysis-card">
                <div class="rare-panel-heading compact"><div><span class="eyebrow">累计销售</span><h2>${brandAnalysis.periodLabel}累计销售金额</h2></div><p>单位：万元</p></div>
                ${renderRareRankedBars(brandAnalysis.salesBrands, "sales", "万元", false)}
              </article>
            </div>
          </section>
        </section>

        ${renderRareUnarchivedAnalysis(unarchivedAnalysis, availableYears)}

        <section class="rare-panel rare-records-panel" aria-label="罕见病药品明细">
          <div class="rare-section-heading">
            <div><span class="eyebrow">药品目录</span><h2>罕见病药品明细</h2></div>
            <form id="rareRecordSearchForm" class="rare-record-search">
              <label><i data-lucide="search"></i><input name="rareRecordSearch" value="${escapeHtml(rareDiseaseUi.searchTerm)}" placeholder="检索通用名、厂牌、适应症" aria-label="检索罕见病药品明细" /></label>
              <button class="button button-ghost" type="submit"><i data-lucide="search"></i><span>检索</span></button>
            </form>
          </div>
          ${renderRareRecords(dashboard.records, indicationAnalysis.salesYears, indicationAnalysis.periodLabel, rareDiseaseUi)}
        </section>
      </main>
  `;
}

function renderRareKpi(label, value, unit, icon) {
  return `
    <article class="rare-kpi-card">
      <span><i data-lucide="${icon}"></i>${label}</span>
      <strong>${value}<em>${unit}</em></strong>
    </article>
  `;
}

function renderRareTrendChart(periods) {
  if (!periods?.length) return '<div class="empty-state">未识别到年度趋势数据</div>';

  const width = Math.max(760, periods.length * 104);
  const height = 316;
  const margin = { top: 30, right: 66, bottom: 48, left: 58 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const countMax = getChartMax(Math.max(1, ...periods.flatMap((period) => [period.drugCount, period.archivedCount])));
  const salesMax = getChartMax(Math.max(1, ...periods.map((period) => period.sales)));
  const xStep = chartWidth / periods.length;
  const barWidth = Math.min(18, Math.max(12, xStep * 0.18));
  const yForCount = (value) => margin.top + chartHeight - (Number(value || 0) / countMax) * chartHeight;
  const yForSales = (value) => margin.top + chartHeight - (Number(value || 0) / salesMax) * chartHeight;
  const xFor = (index) => margin.left + index * xStep + xStep / 2;
  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const factor = (4 - index) / 4;
    const y = margin.top + (chartHeight * index) / 4;
    return `<g><line class="rare-chart-grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" /><text class="rare-chart-axis" x="${margin.left - 10}" y="${y + 4}" text-anchor="end">${Math.round(countMax * factor)}</text><text class="rare-chart-axis" x="${width - margin.right + 10}" y="${y + 4}">${formatSalesAxis(salesMax * factor)}</text></g>`;
  }).join("");
  const bars = periods
    .map((period, index) => {
      const center = xFor(index);
      const drugY = yForCount(period.drugCount);
      const archivedY = yForCount(period.archivedCount);
      return `<rect class="rare-trend-bar rare-trend-bar-approved" x="${center - barWidth - 3}" y="${drugY}" width="${barWidth}" height="${margin.top + chartHeight - drugY}" rx="3"><title>${period.year}年获批：${period.drugCount} 个</title></rect><rect class="rare-trend-bar rare-trend-bar-archived" x="${center + 3}" y="${archivedY}" width="${barWidth}" height="${margin.top + chartHeight - archivedY}" rx="3"><title>${period.year}年建档：${period.archivedCount} 个</title></rect>`;
    })
    .join("");
  const barLabels = periods
    .map((period, index) => {
      const center = xFor(index);
      const drugY = yForCount(period.drugCount);
      const archivedY = yForCount(period.archivedCount);
      return `<text class="rare-chart-bar-label approved" x="${center - barWidth / 2 - 3}" y="${Math.max(margin.top + 14, drugY - 8)}" text-anchor="middle">${period.drugCount}</text><text class="rare-chart-bar-label archived" x="${center + barWidth / 2 + 3}" y="${Math.max(margin.top + 14, archivedY - 8)}" text-anchor="middle">${period.archivedCount}</text>`;
    })
    .join("");
  const points = periods.map((period, index) => `${xFor(index)},${yForSales(period.sales)}`).join(" ");
  const labels = periods
    .map((period, index) => `<text class="rare-chart-axis" x="${xFor(index)}" y="${height - 18}" text-anchor="middle">${period.year}</text>`)
    .join("");
  const salesLabels = periods
    .map((period, index) => {
      const pointY = yForSales(period.sales);
      const labelY = Math.max(margin.top + 14, pointY - 10);
      return `<text class="rare-chart-sales-label" x="${xFor(index)}" y="${labelY}" text-anchor="middle">${formatTopSalesAmount(period.sales)}</text>`;
    })
    .join("");
  const axisTitles = `<text class="rare-chart-unit" x="${margin.left}" y="15">品种数量（个）</text><text class="rare-chart-unit" x="${width - margin.right}" y="15" text-anchor="end">销售金额（万元）</text><text class="rare-chart-unit" x="${width / 2}" y="${height - 2}" text-anchor="middle">年份</text>`;

  return `
    <div class="rare-trend-chart">
      <div class="rare-chart-legend"><span class="approved">获批品种（个）</span><span class="archived">西南建档（个）</span><span class="sales">销售金额（万元）</span></div>
      <div class="rare-chart-scroll"><svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="逐年罕见病获批数量、国药西南建档数量和销售金额的组合图">${axisTitles}${gridLines}<line class="rare-chart-axis-line" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" />${bars}${barLabels}<polyline class="rare-trend-line" points="${points}" />${periods.map((period, index) => `<circle class="rare-trend-point" cx="${xFor(index)}" cy="${yForSales(period.sales)}" r="4"><title>${period.year}年销售：${formatSalesAmount(period.sales)} 万元</title></circle>`).join("")}${salesLabels}${labels}</svg></div>
    </div>
  `;
}

function renderRareTrendHighlights(dashboard, startYear, endYear) {
  const highlights = getRareSalesHighlights(dashboard, startYear, endYear);
  if (!highlights) {
    return '<aside class="rare-trend-insights empty-state">暂未识别到可用于生成销售结论的数据</aside>';
  }

  const items = [
    { icon: "pill", label: `${highlights.periodLabel}销售第一品种`, item: highlights.topProduct },
    { icon: "stethoscope", label: `${highlights.periodLabel}销售第一适应症`, item: highlights.topIndication },
    { icon: "factory", label: `${highlights.periodLabel}销售第一厂牌`, item: highlights.topBrand }
  ];

  return `
    <aside class="rare-trend-insights" aria-label="${highlights.periodLabel}销售结论">
      <div class="rare-trend-insights-heading">
        <span class="eyebrow">销售结论</span>
        <h3>${highlights.periodLabel}销售要点</h3>
        <p>所选时段销售总额 <strong>${formatTopSalesAmount(highlights.totalSales)}</strong> 万元</p>
      </div>
      <ol class="rare-trend-insight-list">
        ${items
          .map(
            ({ icon, label, item }) => `
              <li>
                <span class="rare-trend-insight-icon"><i data-lucide="${icon}"></i></span>
                <div><small>${label}</small><strong>${escapeHtml(item.name)}</strong></div>
                <em>${formatTopSalesAmount(item.sales)}<span>万元</span></em>
              </li>
            `
          )
          .join("")}
      </ol>
      <p class="rare-trend-insight-note">按所选时段销售金额汇总计算，便于快速识别经营重点。</p>
    </aside>
  `;
}

function getRareSalesHighlights(dashboard, startYear, endYear) {
  const analysis = getRareDiseaseRangeAnalysis(dashboard, startYear, endYear);
  if (!analysis.indicationTotal || !analysis.indications.length || !analysis.salesBrands.length) return null;

  const productMap = new Map();
  (dashboard.records || []).forEach((record) => {
    const name = record.genericName || record.productName || "未标注品种";
    const product = productMap.get(name) || { name, sales: 0 };
    product.sales += analysis.salesYears.reduce((total, year) => total + Number(record.sales?.[year] || 0), 0);
    productMap.set(name, product);
  });

  const topProduct = [...productMap.values()].sort((left, right) => right.sales - left.sales || left.name.localeCompare(right.name, "zh-CN"))[0];
  const topIndication = analysis.indications[0];
  const topBrand = analysis.salesBrands[0];
  if (!topProduct || !topProduct.sales || !topIndication || !topBrand) return null;

  return {
    periodLabel: analysis.periodLabel,
    totalSales: analysis.indicationTotal,
    topProduct,
    topIndication,
    topBrand
  };
}

function getRareOverviewRange(dashboard, startYear, endYear) {
  const start = Math.min(Number(startYear), Number(endYear));
  const end = Math.max(Number(startYear), Number(endYear));
  const records = dashboard?.records || [];
  const approvedRecords = records.filter((record) => record.approvalYear >= start && record.approvalYear <= end);
  const archivedCount = approvedRecords.filter((record) => record.archived).length;
  const salesTotal = records.reduce(
    (total, record) =>
      total +
      Object.entries(record.sales || {}).reduce((sales, [year, value]) => {
        const saleYear = Number(year);
        return saleYear >= start && saleYear <= end ? sales + Number(value || 0) : sales;
      }, 0),
    0
  );

  return {
    startYear: start,
    endYear: end,
    approvedCount: approvedRecords.length,
    archivedCount,
    archiveRate: approvedRecords.length ? Math.round((archivedCount / approvedRecords.length) * 100) : 0,
    salesTotal,
    trend: (dashboard?.trend || []).filter((period) => period.year >= start && period.year <= end)
  };
}

function getRareDiseaseRangeAnalysis(dashboard, startYear, endYear) {
  const start = Math.min(Number(startYear), Number(endYear));
  const end = Math.max(Number(startYear), Number(endYear));
  const records = dashboard?.records || [];
  const salesYears = (dashboard?.salesYears || dashboard?.analysisYears || []).filter((year) => Number(year) >= start && Number(year) <= end).map(Number);
  const indicationMap = new Map();
  const brandMap = new Map();
  const salesForRange = (record) => salesYears.reduce((total, year) => total + Number(record.sales?.[year] || 0), 0);

  records.forEach((record) => {
    const sales = salesForRange(record);
    const indicationName = record.indicationShort || record.indication || "未标注适应症";
    const indication = indicationMap.get(indicationName) || { name: indicationName, sales: 0, records: [] };
    indication.sales += sales;
    indication.records.push(record);
    indicationMap.set(indicationName, indication);

    const brandName = record.brand || "未标注厂牌";
    const brand = brandMap.get(brandName) || { name: brandName, approvalCount: 0, sales: 0, records: [] };
    if (record.approvalYear >= start && record.approvalYear <= end) brand.approvalCount += 1;
    brand.sales += sales;
    brand.records.push(record);
    brandMap.set(brandName, brand);
  });

  const indications = [...indicationMap.values()]
    .filter((item) => item.sales > 0)
    .sort((left, right) => right.sales - left.sales || left.name.localeCompare(right.name, "zh-CN"));
  const brands = [...brandMap.values()];

  return {
    startYear: start,
    endYear: end,
    periodLabel: start === end ? `${start} 年` : `${start}—${end} 年`,
    salesYears,
    indications,
    indicationTotal: sumValues(indications.map((item) => item.sales)),
    approvalBrands: brands
      .filter((item) => item.approvalCount > 0)
      .sort((left, right) => right.approvalCount - left.approvalCount || left.name.localeCompare(right.name, "zh-CN")),
    salesBrands: brands
      .filter((item) => item.sales > 0)
      .sort((left, right) => right.sales - left.sales || left.name.localeCompare(right.name, "zh-CN"))
  };
}

function renderRareDonut(analysis) {
  if (!analysis.indications.length || !analysis.indicationTotal) return '<div class="empty-state">所选时段暂无适应症销售数据</div>';
  const palette = ["#3c5488", "#4dbbd5", "#e69f00", "#8491b4", "#7e8fa6", "#d98c3b", "#6c86a5", "#b0bec5"];
  const highlighted = analysis.indications.slice(0, 7).map((item, index) => ({ ...item, color: palette[index] }));
  const remaining = analysis.indications.slice(7);
  if (remaining.length) {
    highlighted.push({ name: "其他适应症", sales: sumValues(remaining.map((item) => item.sales)), color: "#a9b7c2", isOther: true });
  }
  let cursor = 0;
  const gradient = highlighted
    .map((item) => {
      const start = cursor;
      cursor += (item.sales / analysis.indicationTotal) * 100;
      return `${item.color} ${start}% ${cursor}%`;
    })
    .join(", ");

  return `
    <div class="rare-donut-area">
      <div class="rare-donut" style="--rare-donut-gradient: conic-gradient(${gradient})"><div><strong>${formatTopSalesAmount(analysis.indicationTotal)}</strong><span>万元销售</span></div></div>
      <div class="rare-donut-legend">${highlighted
        .map((item) => {
          const percent = Math.round((item.sales / analysis.indicationTotal) * 100);
          const label = `${escapeHtml(item.name)} ${percent}%`;
          return item.isOther
            ? `<span><i style="--legend-color:${item.color}"></i><b>${label}</b><em>${formatTopSalesAmount(item.sales)}</em></span>`
            : `<button type="button" data-rare-indication="${escapeHtml(item.name)}"><i style="--legend-color:${item.color}"></i><b>${label}</b><em>${formatTopSalesAmount(item.sales)}</em></button>`;
        })
        .join("")}</div>
    </div>
  `;
}

function renderRareRankedBars(items, valueKey, unit, interactive) {
  if (!items.length) return '<div class="empty-state">所选时段暂无可展示数据</div>';
  const visibleItems = items.slice(0, 10);
  const maxValue = Math.max(...visibleItems.map((item) => Number(item[valueKey] || 0)), 1);
  return `
    <ol class="rare-ranked-bars">
      ${visibleItems
        .map((item, index) => {
          const value = Number(item[valueKey] || 0);
          const percentage = Math.max(2, Math.round((value / maxValue) * 100));
          const content = `<span class="rare-bar-rank">${index + 1}</span><span class="rare-bar-label">${escapeHtml(item.name)}</span><span class="rare-bar-track"><i style="--bar-width:${percentage}%"></i></span><strong>${valueKey === "sales" ? formatTopSalesAmount(value) : value}${unit}</strong>`;
          return interactive
            ? `<li><button type="button" data-rare-indication="${escapeHtml(item.name)}">${content}</button></li>`
            : `<li><div>${content}</div></li>`;
        })
        .join("")}
    </ol>
  `;
}

function renderRareIndicationDetail(indication, periodLabel) {
  if (!indication) {
    return '<section class="rare-indication-detail empty-state">所选时段暂无适应症销售数据，暂不能生成详情。</section>';
  }
  const products = [...new Map(indication.records.map((record) => [record.genericName, record])).values()];
  return `
    <section class="rare-indication-detail" aria-live="polite">
      <div><span class="eyebrow">适应症详情</span><h2>${escapeHtml(indication.name)}</h2><p>${periodLabel}销售 <strong>${formatTopSalesAmount(indication.sales)} 万元</strong>，表内收录 ${products.length} 个相关品种。</p></div>
      <dl class="rare-disease-facts"><div><dt>发病率</dt><dd>待补充</dd></div><div><dt>服药周期</dt><dd>待补充</dd></div><div><dt>现有药品</dt><dd>源表已收录</dd></div></dl>
      <div class="rare-product-chips">${products
        .slice(0, 12)
        .map((record) => `<span><b>${escapeHtml(record.genericName)}</b><small>${escapeHtml(record.brand || "未标注厂牌")}</small></span>`)
        .join("")}${products.length > 12 ? `<em>另有 ${products.length - 12} 个品种</em>` : ""}</div>
      <small class="rare-data-note">发病率和服药周期不在本次 Excel 数据源内，已预留字段，接入权威疾病资料后可补全。</small>
    </section>
  `;
}

function renderRareRecordOptions(values, selectedValue, emptyLabel) {
  return [`<option value="">${emptyLabel}</option>`]
    .concat(
      values.map((value) => {
        const escaped = escapeHtml(value);
        return `<option value="${escaped}"${String(value) === String(selectedValue) ? " selected" : ""}>${escaped}</option>`;
      })
    )
    .join("");
}

function renderRareRecords(records, salesYears, periodLabel, ui) {
  const salesForRange = (record) => salesYears.reduce((total, year) => total + Number(record.sales?.[year] || 0), 0);
  const filtered = getFilteredRareRecords(records, ui, salesForRange);
  const pageSize = Math.max(1, Number(ui.recordPageSize) || 12);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, Number(ui.recordPage) || 1), pageCount);
  ui.recordPage = currentPage;
  const startIndex = (currentPage - 1) * pageSize;
  const displayed = filtered.slice(startIndex, startIndex + pageSize);
  const displayStart = filtered.length ? startIndex + 1 : 0;
  const displayEnd = startIndex + displayed.length;
  const { brands, indications, approvalYears } = getRareRecordFilterOptions(records);
  return `
    <div class="rare-record-meta">显示第 ${displayStart}-${displayEnd} 条，共 ${filtered.length} 条（全部 ${records.length} 条）</div>
    <div class="table-wrap rare-record-table"><table><thead><tr>${renderRareTableHeader("通用名", "genericName")}${renderRareTableHeader("商品名", "productName")}${renderRareTableHeader("厂牌", "brand", renderRareRecordHeaderFilter("厂牌", "recordBrand", brands, ui.recordBrand, "全部厂牌"))}${renderRareTableHeader("适应症", "indication", renderRareRecordHeaderFilter("适应症", "recordIndication", indications, ui.recordIndication, "全部适应症"))}${renderRareTableHeader("靶点", "target")}${renderRareTableHeader("初次获批", "approvalDate", renderRareRecordHeaderFilter("初次获批", "recordApprovalYear", approvalYears, ui.recordApprovalYear, "全部年份"))}${renderRareTableHeader("建档", "archived", renderRareArchiveHeaderFilter())}${renderRareTableHeader(`${periodLabel}销售`, "sales")}</tr></thead><tbody>${displayed.length ? displayed
      .map(
        (record) => `<tr><th scope="row">${escapeHtml(record.genericName)}</th><td>${escapeHtml(record.productName || "/")}</td><td>${escapeHtml(record.brand || "/")}</td><td>${escapeHtml(record.indicationShort || record.indication || "/")}</td><td>${escapeHtml(record.target || "/")}</td><td>${escapeHtml(record.approvalDate)}</td><td><span class="rare-archive-status ${record.archived ? "is-archived" : ""}">${record.archived ? "已建档" : "未建档"}</span></td><td>${formatTopSalesAmount(salesForRange(record))} 万元</td></tr>`
      )
      .join("") : '<tr><td colspan="8"><div class="empty-state">未找到匹配的药品明细</div></td></tr>'}</tbody></table></div>
    ${renderRareRecordPagination(currentPage, pageCount, filtered.length)}
  `;
}

function renderRareTableHeader(label, sortKey, filterControl = "") {
  const isCurrent = rareDiseaseUi.recordSortKey === sortKey;
  const icon = isCurrent ? (rareDiseaseUi.recordSortDirection === "asc" ? "arrow-up" : "arrow-down") : "arrow-up-down";
  return `<th><div class="table-header-content"><button class="sort-button" type="button" data-rare-record-sort="${sortKey}" aria-label="按${label}排序"><span>${label}</span><i data-lucide="${icon}"></i></button>${filterControl}</div></th>`;
}

function renderRareRecordHeaderFilter(label, stateKey, values, selectedValue, emptyLabel) {
  return `<span class="header-filter-control${selectedValue ? " is-active" : ""}"><i data-lucide="filter"></i><select data-rare-header-filter="${stateKey}" aria-label="按${label}筛选">${renderRareRecordOptions(values, selectedValue, emptyLabel)}</select></span>`;
}

function renderRareArchiveHeaderFilter() {
  const selected = rareDiseaseUi.recordArchiveStatus;
  return `<span class="header-filter-control${selected !== "all" ? " is-active" : ""}"><i data-lucide="filter"></i><select data-rare-header-filter="recordArchiveStatus" aria-label="按建档状态筛选"><option value="all"${selected === "all" ? " selected" : ""}>全部状态</option><option value="archived"${selected === "archived" ? " selected" : ""}>已建档</option><option value="unarchived"${selected === "unarchived" ? " selected" : ""}>未建档</option></select></span>`;
}

function getRareRecordFilterOptions(records) {
  const uniqueSortedValues = (values, compare) => [...new Set(values.filter(Boolean))].sort(compare);
  return {
    brands: uniqueSortedValues(records.map((record) => record.brand), (left, right) => left.localeCompare(right, "zh-CN")),
    indications: uniqueSortedValues(records.map(getRareRecordIndication), (left, right) => left.localeCompare(right, "zh-CN")),
    approvalYears: uniqueSortedValues(records.map(getRareRecordApprovalYear), (left, right) => Number(right) - Number(left))
  };
}

function getFilteredRareRecords(records, ui, salesForRange) {
  const normalizedSearch = String(ui.searchTerm || "").trim().toLowerCase();
  const filtered = records.filter((record) => {
    const matchesSearch =
      !normalizedSearch ||
      [record.genericName, record.productName, record.brand, record.indicationShort, record.indication, record.target]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    const matchesArchiveStatus =
      ui.recordArchiveStatus === "all" ||
      (ui.recordArchiveStatus === "archived" && record.archived) ||
      (ui.recordArchiveStatus === "unarchived" && !record.archived);
    const matchesBrand = !ui.recordBrand || record.brand === ui.recordBrand;
    const matchesIndication = !ui.recordIndication || getRareRecordIndication(record) === ui.recordIndication;
    const matchesApprovalYear = !ui.recordApprovalYear || getRareRecordApprovalYear(record) === ui.recordApprovalYear;
    return matchesSearch && matchesArchiveStatus && matchesBrand && matchesIndication && matchesApprovalYear;
  });

  if (!ui.recordSortKey) return filtered;
  return [...filtered].sort((left, right) => {
    const leftValue = getRareRecordSortValue(left, ui.recordSortKey, salesForRange);
    const rightValue = getRareRecordSortValue(right, ui.recordSortKey, salesForRange);
    const result = compareTableValues(leftValue, rightValue);
    return ui.recordSortDirection === "asc" ? result : -result;
  });
}

function getRareRecordSortValue(record, key, salesForRange) {
  if (key === "sales") return salesForRange(record);
  if (key === "archived") return record.archived ? 1 : 0;
  if (key === "indication") return getRareRecordIndication(record);
  return record[key] || "";
}

function compareTableValues(leftValue, rightValue) {
  const leftEmpty = leftValue === undefined || leftValue === null || leftValue === "";
  const rightEmpty = rightValue === undefined || rightValue === null || rightValue === "";
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;
  if (typeof leftValue === "number" && typeof rightValue === "number") return leftValue - rightValue;
  return String(leftValue).localeCompare(String(rightValue), "zh-CN", { numeric: true });
}

function getRareRecordIndication(record) {
  return record.indicationShort || record.indication || "";
}

function getRareRecordApprovalYear(record) {
  return String(record.approvalDate || "").match(/\d{4}/)?.[0] || "";
}

function renderRareRecordPagination(currentPage, pageCount, rowCount) {
  if (!rowCount) return "";

  const pageItems = getRareRecordPaginationItems(currentPage, pageCount);
  return `
    <nav class="rare-record-pagination" aria-label="药品明细分页">
      <div class="rare-pagination-buttons">
        <button class="button button-ghost rare-pagination-button" type="button" data-rare-record-page="1"${currentPage === 1 ? " disabled" : ""} aria-label="首页"><i data-lucide="chevrons-left"></i></button>
        <button class="button button-ghost rare-pagination-button" type="button" data-rare-record-page="${currentPage - 1}"${currentPage === 1 ? " disabled" : ""} aria-label="上一页"><i data-lucide="chevron-left"></i></button>
        ${pageItems
          .map((item) =>
            item === "…"
              ? '<span class="rare-page-ellipsis" aria-hidden="true">…</span>'
              : `<button class="button button-ghost rare-page-number${item === currentPage ? " is-active" : ""}" type="button" data-rare-record-page="${item}"${item === currentPage ? ' aria-current="page"' : ""}>${item}</button>`
          )
          .join("")}
        <button class="button button-ghost rare-pagination-button" type="button" data-rare-record-page="${currentPage + 1}"${currentPage === pageCount ? " disabled" : ""} aria-label="下一页"><i data-lucide="chevron-right"></i></button>
        <button class="button button-ghost rare-pagination-button" type="button" data-rare-record-page="${pageCount}"${currentPage === pageCount ? " disabled" : ""} aria-label="末页"><i data-lucide="chevrons-right"></i></button>
      </div>
      <form id="rareRecordPageJumpForm" class="rare-page-jump"><label>跳至 <input name="rareRecordPage" type="number" min="1" max="${pageCount}" value="${currentPage}" inputmode="numeric" aria-label="跳转页码" /> 页</label><button class="button button-ghost" type="submit">确定</button><small>共 ${pageCount} 页</small></form>
    </nav>
  `;
}

function getRareRecordPaginationItems(currentPage, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);

  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  if (currentPage <= 3) pages.add(2), pages.add(3), pages.add(4);
  if (currentPage >= pageCount - 2) pages.add(pageCount - 1), pages.add(pageCount - 2), pages.add(pageCount - 3);
  const sortedPages = [...pages].filter((page) => page >= 1 && page <= pageCount).sort((left, right) => left - right);

  return sortedPages.reduce((items, page, index) => {
    if (index && page - sortedPages[index - 1] > 1) items.push("…");
    items.push(page);
    return items;
  }, []);
}

function renderRareUnarchivedAnalysis(analysis, availableYears) {
  return `
    <section class="rare-panel rare-unarchived-section" aria-label="未建档品种分析">
      <div class="rare-section-heading">
        <div><span class="eyebrow">建档管理</span><h2>未建档品种分析</h2></div>
        <label class="rare-range-filter" aria-label="未建档品种分析时段"><span>分析时段</span><select id="rareUnarchivedStartYear" aria-label="未建档品种分析开始年份">${availableYears
          .map((year) => `<option value="${year}"${Number(year) === Number(analysis.startYear) ? " selected" : ""}>${year} 年</option>`)
          .join("")}</select><b>至</b><select id="rareUnarchivedEndYear" aria-label="未建档品种分析结束年份">${availableYears
          .map((year) => `<option value="${year}"${Number(year) === Number(analysis.endYear) ? " selected" : ""}>${year} 年</option>`)
          .join("")}</select></label>
      </div>
      <p class="rare-unarchived-description">聚焦尚未纳入国药西南档案的罕见病品种，支持后续建档与跟进。</p>
      ${
        analysis.totalCount
          ? `
            <div class="rare-unarchived-summary">
              ${renderRareManagementStat("尚未建档品种", analysis.totalCount, "个", "circle-alert")}
              ${renderRareManagementStat("整体建档率", analysis.archiveRate, "%", "chart-no-axes-combined")}
              ${renderRareManagementStat(`${analysis.periodLabel}待建档`, analysis.totalCount, "个", "calendar-clock")}
              ${renderRareManagementStat("涉及厂牌", analysis.brands.length, "家", "factory")}
            </div>
            <div class="rare-unarchived-grid">
              <article class="rare-unarchived-card rare-unarchived-list-card">
                <div class="rare-unarchived-card-heading"><div><span class="eyebrow">待办清单</span><h3>最新获批未建档品种</h3></div><span>共 ${analysis.totalCount} 个</span></div>
                <div class="rare-unarchived-list">
                  ${analysis.latestRecords
                    .map(
                      (record) => `
                        <article>
                          <div><strong>${escapeHtml(record.genericName)}</strong><small>${escapeHtml(record.brand || "未标注厂牌")} · ${escapeHtml(record.indicationShort || record.indication || "未标注适应症")}</small></div>
                          <time>${record.approvalYear} 年获批</time>
                        </article>
                      `
                    )
                    .join("")}
                </div>
              </article>
              <article class="rare-unarchived-card">
                <div class="rare-unarchived-card-heading"><div><span class="eyebrow">适应症分布</span><h3>待建档适应症</h3></div><span>按品种计</span></div>
                ${renderRareRankedBars(analysis.indications, "count", "个", false)}
              </article>
              <article class="rare-unarchived-card">
                <div class="rare-unarchived-card-heading"><div><span class="eyebrow">厂牌分布</span><h3>待建档厂牌</h3></div><span>按品种计</span></div>
                ${renderRareRankedBars(analysis.brands, "count", "个", false)}
              </article>
            </div>
            <div class="rare-unarchived-note"><i data-lucide="clipboard-list"></i><span>${analysis.unarchivedSalesTotal > 0 ? `${analysis.periodLabel}未建档品种销售合计 ${formatTopSalesAmount(analysis.unarchivedSalesTotal)} 万元；建议优先推进高销售品种的建档与跟进。` : "所选时段内未建档品种均未在源表销售列录入销售金额；建议优先核实最新获批品种及覆盖品种较多的厂牌。"}</span></div>
          `
          : '<div class="empty-state">所选时段暂无未建档品种</div>'
      }
    </section>
  `;
}

function renderRareManagementStat(label, value, unit, icon) {
  return `<div><span><i data-lucide="${icon}"></i>${label}</span><strong>${value}<em>${unit}</em></strong></div>`;
}

function getRareUnarchivedAnalysis(dashboard, startYear, endYear) {
  const start = Math.min(Number(startYear), Number(endYear));
  const end = Math.max(Number(startYear), Number(endYear));
  const rangeRecords = (dashboard?.records || []).filter((record) => record.approvalYear >= start && record.approvalYear <= end);
  const records = rangeRecords.filter((record) => !record.archived);
  const salesYears = (dashboard?.salesYears || dashboard?.analysisYears || []).filter((year) => Number(year) >= start && Number(year) <= end).map(Number);
  const latestSalesYear = [...salesYears].reverse().find((year) => records.some((record) => Number(record.sales?.[year] || 0) > 0)) || 0;
  const groupBy = (getName) =>
    [...records
      .reduce((groups, record) => {
        const name = getName(record) || "未标注";
        const item = groups.get(name) || { name, count: 0 };
        item.count += 1;
        groups.set(name, item);
        return groups;
      }, new Map())
      .values()]
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN"));
  const latestYear = Math.max(...records.map((record) => Number(record.approvalYear) || 0), 0);
  const latestRecords = [...records]
    .sort((left, right) => right.approvalYear - left.approvalYear || String(right.approvalDate).localeCompare(String(left.approvalDate), "zh-CN"))
    .slice(0, 10);

  return {
    startYear: start,
    endYear: end,
    periodLabel: start === end ? `${start} 年` : `${start}—${end} 年`,
    totalCount: records.length,
    archiveRate: rangeRecords.length ? Math.round(((rangeRecords.length - records.length) / rangeRecords.length) * 100) : 0,
    latestYear,
    latestYearCount: records.filter((record) => record.approvalYear === latestYear).length,
    latestSalesYear,
    unarchivedSalesTotal: records.reduce((total, record) => total + salesYears.reduce((sales, year) => sales + Number(record.sales?.[year] || 0), 0), 0),
    latestRecords,
    indications: groupBy((record) => record.indicationShort || record.indication),
    brands: groupBy((record) => record.brand)
  };
}

function renderControlledOverviewTable(categories) {
  const summaryRows = [
    { label: "目录品种", getValue: (category) => category.catalogCount },
    { label: "国内上市品种", getValue: (category) => category.domesticCount },
    { label: "西南建档品种", getValue: (category) => category.archivedCount },
    { label: "实际建档率", getValue: (category) => `<strong>${category.archiveRate}%</strong>` },
    { label: "未建档品种", getValue: (category) => renderInlineList(category.unarchived) }
  ];

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
              <th>统计指标</th>
              ${categories
                .map(
                  (category) =>
                    `<th><span class="controlled-type-dot" style="--category-color: ${category.color}"></span>${escapeHtml(category.title)}</th>`
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${summaryRows
              .map(
                (row) => `
                  <tr>
                    <th scope="row">${row.label}</th>
                    ${categories.map((category) => `<td>${row.getValue(category)}</td>`).join("")}
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
            <h3>销售前五品种</h3>
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

  const width = Math.max(760, periods.length * 170);
  const height = 310;
  const margin = { top: 32, right: 28, bottom: 54, left: 68 };
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
  const barLabels = periods
    .flatMap((period, periodIndex) =>
      categories.map((category, categoryIndex) => {
        const value = Number(period.values?.[category.key] || 0);
        if (!value) return "";
        const x = xFor(periodIndex) - barsWidth / 2 + categoryIndex * (barWidth + barGap) + barWidth / 2;
        const y = Math.max(margin.top + 13, yFor(value) - 8);
        return `<text class="controlled-chart-value-label" x="${x}" y="${y}" text-anchor="middle" fill="${category.color}">${formatTopSalesAmount(value)}</text>`;
      })
    )
    .join("");
  const totalPoints = periods.map((period, index) => `${xFor(index)},${yFor(period.total)}`).join(" ");
  const pointMarkers = periods
    .map((period, index) => `<circle class="controlled-chart-total-point" cx="${xFor(index)}" cy="${yFor(period.total)}" r="4"><title>合计 · ${period.year}销售：${formatSalesAmount(period.total)}万元</title></circle>`)
    .join("");
  const totalLabels = periods
    .map((period, index) => `<text class="controlled-chart-total-label" x="${xFor(index)}" y="${Math.max(margin.top + 13, yFor(period.total) - 10)}" text-anchor="middle">${formatTopSalesAmount(period.total)}</text>`)
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
          ${barLabels}
          <polyline class="controlled-chart-total-line" points="${totalPoints}" />
          ${pointMarkers}
          ${totalLabels}
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
  return formatSalesAmount(value);
}

function formatHundredMillion(value) {
  return `${(Number(value || 0) / 10000).toFixed(2)}亿元`;
}

function sumValues(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function getActiveGuideFromHash() {
  if (window.location.hash === "#controlled-drugs") return GUIDE_CONTROLLED_DRUGS;
  if (window.location.hash === "#rare-disease") return GUIDE_RARE_DISEASES;
  if (window.location.hash === "#procurement-originator") return GUIDE_PROCUREMENT_ORIGINATOR;
  if (window.location.hash === "#hiv") return GUIDE_HIV;
  return GUIDE_INNOVATION;
}

function formatInnovationMonth(value) {
  const [year, rawMonth] = String(value || "").split("-");
  return year && rawMonth ? `${year}年${Number(rawMonth)}月` : "未标注月份";
}

function renderInnovationMonthOptions(selectedMonth) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return `<option value="${month}"${month === selectedMonth ? " selected" : ""}>${index + 1}月</option>`;
  }).join("");
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
      if ([GUIDE_INNOVATION, GUIDE_CONTROLLED_DRUGS, GUIDE_RARE_DISEASES, GUIDE_PROCUREMENT_ORIGINATOR, GUIDE_HIV].includes(name)) {
        activeGuide = name;
        notice = null;
        const hash =
          name === GUIDE_CONTROLLED_DRUGS
            ? "#controlled-drugs"
            : name === GUIDE_RARE_DISEASES
              ? "#rare-disease"
              : name === GUIDE_PROCUREMENT_ORIGINATOR
                ? "#procurement-originator"
                : name === GUIDE_HIV
                  ? "#hiv"
                  : window.location.pathname;
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

function bindInnovationDashboard() {
  const controls = {
    startYear: document.querySelector("#innovationOverviewStartYear"),
    startMonth: document.querySelector("#innovationOverviewStartMonth"),
    endYear: document.querySelector("#innovationOverviewEndYear"),
    endMonth: document.querySelector("#innovationOverviewEndMonth")
  };

  const updateRange = (changedKey) => {
    let start = `${controls.startYear?.value}-${controls.startMonth?.value}`;
    let end = `${controls.endYear?.value}-${controls.endMonth?.value}`;
    if (start > end) {
      if (changedKey.startsWith("start")) end = start;
      else start = end;
    }
    innovationUi.overviewStartMonth = start;
    innovationUi.overviewEndMonth = end;
    renderDashboard();
  };

  Object.entries(controls).forEach(([key, control]) => control?.addEventListener("change", () => updateRange(key)));
}

function bindRareDiseaseDashboard() {
  const overviewStartYearSelect = document.querySelector("#rareOverviewStartYear");
  overviewStartYearSelect?.addEventListener("change", () => {
    rareDiseaseUi.overviewStartYear = Number(overviewStartYearSelect.value);
    if (rareDiseaseUi.overviewStartYear > rareDiseaseUi.overviewEndYear) {
      rareDiseaseUi.overviewEndYear = rareDiseaseUi.overviewStartYear;
    }
    renderDashboard();
  });

  const overviewEndYearSelect = document.querySelector("#rareOverviewEndYear");
  overviewEndYearSelect?.addEventListener("change", () => {
    rareDiseaseUi.overviewEndYear = Number(overviewEndYearSelect.value);
    if (rareDiseaseUi.overviewEndYear < rareDiseaseUi.overviewStartYear) {
      rareDiseaseUi.overviewStartYear = rareDiseaseUi.overviewEndYear;
    }
    renderDashboard();
  });

  const indicationStartYearSelect = document.querySelector("#rareIndicationStartYear");
  indicationStartYearSelect?.addEventListener("change", () => {
    rareDiseaseUi.indicationStartYear = Number(indicationStartYearSelect.value);
    if (rareDiseaseUi.indicationStartYear > rareDiseaseUi.indicationEndYear) {
      rareDiseaseUi.indicationEndYear = rareDiseaseUi.indicationStartYear;
    }
    rareDiseaseUi.selectedIndication = "";
    renderDashboard();
  });

  const indicationEndYearSelect = document.querySelector("#rareIndicationEndYear");
  indicationEndYearSelect?.addEventListener("change", () => {
    rareDiseaseUi.indicationEndYear = Number(indicationEndYearSelect.value);
    if (rareDiseaseUi.indicationEndYear < rareDiseaseUi.indicationStartYear) {
      rareDiseaseUi.indicationStartYear = rareDiseaseUi.indicationEndYear;
    }
    rareDiseaseUi.selectedIndication = "";
    renderDashboard();
  });

  const brandStartYearSelect = document.querySelector("#rareBrandStartYear");
  brandStartYearSelect?.addEventListener("change", () => {
    rareDiseaseUi.brandStartYear = Number(brandStartYearSelect.value);
    if (rareDiseaseUi.brandStartYear > rareDiseaseUi.brandEndYear) {
      rareDiseaseUi.brandEndYear = rareDiseaseUi.brandStartYear;
    }
    renderDashboard();
  });

  const brandEndYearSelect = document.querySelector("#rareBrandEndYear");
  brandEndYearSelect?.addEventListener("change", () => {
    rareDiseaseUi.brandEndYear = Number(brandEndYearSelect.value);
    if (rareDiseaseUi.brandEndYear < rareDiseaseUi.brandStartYear) {
      rareDiseaseUi.brandStartYear = rareDiseaseUi.brandEndYear;
    }
    renderDashboard();
  });

  const unarchivedStartYearSelect = document.querySelector("#rareUnarchivedStartYear");
  unarchivedStartYearSelect?.addEventListener("change", () => {
    rareDiseaseUi.unarchivedStartYear = Number(unarchivedStartYearSelect.value);
    if (rareDiseaseUi.unarchivedStartYear > rareDiseaseUi.unarchivedEndYear) {
      rareDiseaseUi.unarchivedEndYear = rareDiseaseUi.unarchivedStartYear;
    }
    renderDashboard();
  });

  const unarchivedEndYearSelect = document.querySelector("#rareUnarchivedEndYear");
  unarchivedEndYearSelect?.addEventListener("change", () => {
    rareDiseaseUi.unarchivedEndYear = Number(unarchivedEndYearSelect.value);
    if (rareDiseaseUi.unarchivedEndYear < rareDiseaseUi.unarchivedStartYear) {
      rareDiseaseUi.unarchivedStartYear = rareDiseaseUi.unarchivedEndYear;
    }
    renderDashboard();
  });

  document.querySelectorAll("[data-rare-indication]").forEach((button) => {
    button.addEventListener("click", () => {
      rareDiseaseUi.selectedIndication = button.dataset.rareIndication || "";
      renderDashboard();
      document.querySelector(".rare-indication-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });

  document.querySelector("#rareRecordSearchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    rareDiseaseUi.searchTerm = String(form.get("rareRecordSearch") || "");
    rareDiseaseUi.recordPage = 1;
    renderDashboard();
  });

  document.querySelectorAll("[data-rare-header-filter]").forEach((control) => {
    control.addEventListener("change", () => {
      rareDiseaseUi[control.dataset.rareHeaderFilter] = control.value;
      rareDiseaseUi.recordPage = 1;
      renderDashboard();
    });
  });

  document.querySelectorAll("[data-rare-record-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const sortKey = button.dataset.rareRecordSort;
      rareDiseaseUi.recordSortDirection = rareDiseaseUi.recordSortKey === sortKey && rareDiseaseUi.recordSortDirection === "asc" ? "desc" : "asc";
      rareDiseaseUi.recordSortKey = sortKey;
      rareDiseaseUi.recordPage = 1;
      renderDashboard();
    });
  });

  document.querySelectorAll("[data-rare-record-page]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      rareDiseaseUi.recordPage = Number(button.dataset.rareRecordPage) || 1;
      renderDashboard();
      scrollToRareRecords();
    });
  });

  document.querySelector("#rareRecordPageJumpForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = event.currentTarget.elements.rareRecordPage;
    const maximumPage = Number(input.max) || 1;
    const requestedPage = Number(input.value);
    rareDiseaseUi.recordPage = Math.min(maximumPage, Math.max(1, Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1));
    renderDashboard();
    scrollToRareRecords();
  });
}

function scrollToRareRecords() {
  requestAnimationFrame(() => {
    document.querySelector(".rare-records-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function bindSpecialtyDashboards() {
  bindSpecialtyRangeFilter("procurement", procurementOriginatorUi);
  bindSpecialtyRangeFilter("hiv", hivUi);
  bindSpecialtyRecordTable("procurement", procurementOriginatorUi);
  bindSpecialtyRecordTable("hiv", hivUi);
}

function createSpecialtyTableState() {
  return {
    startYear: null,
    endYear: null,
    recordSearch: "",
    recordBrand: "",
    recordCategory: "",
    recordSortKey: "",
    recordSortDirection: "asc",
    recordPage: 1,
    recordPageSize: 8
  };
}

function bindSpecialtyRangeFilter(prefix, state) {
  const startYearSelect = document.querySelector(`#${prefix}StartYear`);
  const endYearSelect = document.querySelector(`#${prefix}EndYear`);

  startYearSelect?.addEventListener("change", () => {
    state.startYear = Number(startYearSelect.value);
    if (state.startYear > Number(state.endYear)) state.endYear = state.startYear;
    renderDashboard();
  });

  endYearSelect?.addEventListener("change", () => {
    state.endYear = Number(endYearSelect.value);
    if (state.endYear < Number(state.startYear)) state.startYear = state.endYear;
    renderDashboard();
  });
}

function bindSpecialtyRecordTable(prefix, state) {
  document.querySelector(`#${prefix}RecordSearchForm`)?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.recordSearch = String(new FormData(event.currentTarget).get("specialtyRecordSearch") || "");
    state.recordPage = 1;
    renderDashboard();
  });

  document.querySelectorAll(`[data-specialty-header-filter="${prefix}"]`).forEach((control) => {
    control.addEventListener("change", () => {
      const stateKey = control.dataset.specialtyFilterKey === "brand" ? "recordBrand" : "recordCategory";
      state[stateKey] = control.value;
      state.recordPage = 1;
      renderDashboard();
    });
  });

  document.querySelectorAll(`[data-specialty-record-sort="${prefix}"]`).forEach((button) => {
    button.addEventListener("click", () => {
      const sortKey = button.dataset.specialtySortKey;
      state.recordSortDirection = state.recordSortKey === sortKey && state.recordSortDirection === "asc" ? "desc" : "asc";
      state.recordSortKey = sortKey;
      state.recordPage = 1;
      renderDashboard();
    });
  });

  document.querySelectorAll(`[data-specialty-record="${prefix}"]`).forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      state.recordPage = Number(button.dataset.specialtyPage) || 1;
      renderDashboard();
      scrollToSpecialtyRecords();
    });
  });

  document.querySelector(`#${prefix}RecordPageJumpForm`)?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector('input[name="specialtyRecordPage"]');
    const maximumPage = Number(input?.max) || 1;
    const requestedPage = Number(input?.value);
    state.recordPage = Math.min(maximumPage, Math.max(1, Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1));
    renderDashboard();
    scrollToSpecialtyRecords();
  });
}

function scrollToSpecialtyRecords() {
  requestAnimationFrame(() => {
    document.querySelector(".specialty-record-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

function bindDataAssistant() {
  document.querySelector("#dataAssistantToggle")?.addEventListener("click", () => {
    dataAssistantUi.isOpen = !dataAssistantUi.isOpen;
    if (dataAssistantUi.isOpen) cancelDataAssistantNudge();
    renderDashboard();
    if (dataAssistantUi.isOpen) focusDataAssistantInput();
  });

  document.querySelector("#dataAssistantClose")?.addEventListener("click", () => {
    dataAssistantUi.isOpen = false;
    dismissDataAssistantNudge();
    renderDashboard();
  });

  document.querySelector("#dataAssistantNudge")?.addEventListener("click", () => {
    dataAssistantUi.isOpen = true;
    cancelDataAssistantNudge();
    renderDashboard();
    focusDataAssistantInput();
  });

  document.querySelectorAll("[data-assistant-example]").forEach((button) => {
    button.addEventListener("click", () => submitDataAssistantQuestion(button.dataset.assistantExample || ""));
  });

  document.querySelector("#dataAssistantForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submitDataAssistantQuestion(String(form.get("question") || ""));
  });

  scheduleDataAssistantNudge();
}

function scheduleDataAssistantNudge() {
  if (dataAssistantUi.isOpen) {
    cancelDataAssistantNudge();
    return;
  }

  if (dataAssistantUi.showNudge) {
    if (!dataAssistantNudgeHideTimer) {
      dataAssistantNudgeHideTimer = window.setTimeout(() => {
        dataAssistantNudgeHideTimer = undefined;
        if (!dataAssistantUi.isOpen && dataAssistantUi.showNudge) {
          dataAssistantUi.showNudge = false;
          renderDashboard();
        }
      }, 7000);
    }
    return;
  }

  if (dataAssistantNudgeTimer) return;
  const minDelay = dataAssistantNudgeHasBeenShown ? 80000 : 16000;
  const maxDelay = dataAssistantNudgeHasBeenShown ? 150000 : 30000;
  const delay = minDelay + Math.round(Math.random() * (maxDelay - minDelay));
  dataAssistantNudgeTimer = window.setTimeout(() => {
    dataAssistantNudgeTimer = undefined;
    if (dataAssistantUi.isOpen) return;
    dataAssistantUi.showNudge = true;
    dataAssistantNudgeHasBeenShown = true;
    renderDashboard();
  }, delay);
}

function dismissDataAssistantNudge() {
  dataAssistantUi.showNudge = false;
  window.clearTimeout(dataAssistantNudgeHideTimer);
  dataAssistantNudgeHideTimer = undefined;
}

function cancelDataAssistantNudge() {
  dismissDataAssistantNudge();
  window.clearTimeout(dataAssistantNudgeTimer);
  dataAssistantNudgeTimer = undefined;
}

async function submitDataAssistantQuestion(question) {
  const text = String(question || "").trim();
  if (!text || dataAssistantUi.isLoading) return;

  dataAssistantUi.isOpen = true;
  dataAssistantUi.isLoading = true;
  const groundedAnswer = answerDataQuestion(text, dashboardState, activeGuide);
  const pendingId = `assistant-pending-${Date.now()}`;
  appendAssistantMessage(dataAssistantUi, { role: "user", content: text });
  appendAssistantMessage(dataAssistantUi, {
    id: pendingId,
    role: "assistant",
    content: "正在根据已存数据核对信息…",
    sources: ["当前网站经营数据"]
  });
  renderDashboard();

  try {
    replaceDataAssistantMessage(pendingId, await askDeepSeekAssistant(text, groundedAnswer));
  } catch {
    replaceDataAssistantMessage(pendingId, groundedAnswer);
  } finally {
    dataAssistantUi.isLoading = false;
    renderDashboard();
    focusDataAssistantInput();
  }
}

function replaceDataAssistantMessage(id, message) {
  dataAssistantUi.messages = dataAssistantUi.messages.map((item) => (item.id === id ? message : item));
}

function focusDataAssistantInput() {
  requestAnimationFrame(() => {
    const messages = document.querySelector("#dataAssistantMessages");
    if (messages) messages.scrollTop = messages.scrollHeight;
    document.querySelector("#dataAssistantInput")?.focus();
  });
}

async function handleFile(file) {
  notice = { type: "loading", text: "正在解析表格数据..." };
  renderNotice();

  try {
    const workbook = await readExcelFile(file);
    const nextState = buildDashboardState(workbook);
    dashboardState = nextState;
    await saveDashboardState(nextState);

    notice = {
      type: "success",
      text: `解析成功：识别 ${nextState.meta.recognizedNewsSections} 个新闻板块、${nextState.meta.recognizedTableSections} 个表格板块${nextState.researchSurvey ? `、${nextState.researchSurvey.records.length} 条调研记录` : ""}${nextState.meta.recognizedControlledDrugDashboard ? "，并已更新麻精经营看板" : ""}${nextState.meta.recognizedRareDiseaseDashboard ? "，并已更新罕见病经营看板" : ""}。`
    };
    renderDashboard();
  } catch (error) {
    notice = {
      type: "error",
      text: error instanceof Error ? error.message : "表格解析失败。"
    };
    renderNotice();
  }
}

function buildDashboardState(workbook) {
  const matches = matchWorkbookSections(workbook, dashboardConfig);
  const newsSections = matches.newsMatches.map(({ section, match }) => normalizeNewsSection(match, section));
  const tableSections = matches.tableMatches.map(({ section, match }) => normalizeTableSection(match, section));
  const controlledDrug = buildControlledDrugDashboard(workbook);
  const rareDisease = buildRareDiseaseDashboard(workbook);
  const researchSurvey = buildResearchSurvey(workbook);
  const warnings = [];
  const hasSpecialDashboard = Boolean(controlledDrug || rareDisease);

  if (!newsSections.some((section) => section.items.length) && !researchSurvey && !hasSpecialDashboard) {
    warnings.push("未识别到新闻板块，请检查表格中的板块标题或工作表名称。");
  }

  if (!tableSections.some((section) => section.rows.length) && !researchSurvey && !hasSpecialDashboard) {
    warnings.push("未识别到表格明细，请检查表头和数据区域。");
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
      recognizedRareDiseaseDashboard: Boolean(rareDisease),
      warnings
    },
    newsSections,
    tableSections,
    controlledDrug,
    rareDisease,
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
      text: `${currentYear}年至今，国家药监局批准上市创新药${approvedThisYear.length}个，落地四川${landedCount}个，国药西南建档${archivedCount}个，建档率${archiveRate}%。`,
      researchMetrics: getSurveyMetrics(survey, currentUser.name)
    };
  }

  const poolSection = state.tableSections.find((section) => section.key === "innovativeDrugPool");
  const approved2026Rows = poolSection?.rows.filter((row) => getApprovalYear(row) === 2026) || [];
  const landedCount = approved2026Rows.filter((row) => isAffirmative(getRowField(row, "landedInSichuan"))).length;
  const archivedCount = approved2026Rows.filter((row) => isAffirmative(getRowField(row, "southwestArchived"))).length;
  const archiveRate = landedCount ? Math.round((archivedCount / landedCount) * 100) : 0;

  return {
    text: `2026年至今，国家药监局批准上市创新药${approved2026Rows.length}个，落地四川${landedCount}个，国药西南建档${archivedCount}个，建档率${archiveRate}%。`
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
