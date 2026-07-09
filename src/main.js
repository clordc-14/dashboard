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
const GUIDE_INNOVATION = "创新药";
const GUIDE_CONTROLLED_DRUGS = "麻精";
const controlledDrugData = {
  overview: {
    catalogCount: 128,
    archivedCount: 55,
    archiveRate: 82,
    salesText: "1.26亿元"
  },
  salesByQuarter: [
    { label: "第一季度", value: 46, color: "#4776d0" },
    { label: "第二季度", value: 31, color: "#f1872d" },
    { label: "第三季度", value: 14, color: "#f3bd22" },
    { label: "第四季度", value: 9, color: "#58b947" }
  ],
  categories: [
    {
      key: "narcotic",
      title: "麻醉药品",
      color: "#4776d0",
      catalogCount: 32,
      domesticCount: 18,
      archivedCount: 17,
      archiveRate: 94,
      salesText: "4,680万",
      unarchived: ["待正式表格源核对 1 个品种"],
      focus: ["维持高建档覆盖，优先核准目录与国内上市口径。", "销售贡献稳定，适合做月度库存与采购联动看板。"],
      actions: ["补齐未建档品种责任人与预计建档时间", "按采购负责人拆分销售与库存风险"]
    },
    {
      key: "psychotropic-one",
      title: "第一类精神药品",
      color: "#55b947",
      catalogCount: 18,
      domesticCount: 10,
      archivedCount: 5,
      archiveRate: 50,
      salesText: "2,150万",
      unarchived: ["γ-羟丁酸", "马吲哚", "司可巴比妥", "他喷他多", "含羟考酮复方口服固体制剂"],
      focus: ["建档率仍有提升空间，建议把未建档品种集中进跟进清单。", "优先识别预测销售额较高、临床需求较明确的品种。"],
      actions: ["新增未建档品种的厂牌、采购、准入状态字段", "对高潜品种补销售预测与合作厂牌状态"]
    },
    {
      key: "psychotropic-two",
      title: "第二类精神药品",
      color: "#31bdb5",
      catalogCount: 78,
      domesticCount: 39,
      archivedCount: 33,
      archiveRate: 74,
      salesText: "6,100万",
      unarchived: ["安纳咖", "氨氯草", "依他佐辛", "麦角胺咖啡因片", "氟西泮", "含地芬诺酯复方制剂"],
      focus: ["品种基数最大，适合用分层看板区分已建档、待建档与无需动作。", "需关注销售额集中度，避免重点品种被长尾清单淹没。"],
      actions: ["按销售额和临床科室做二级筛选", "补充采购频次、库存天数与异常波动提醒"]
    }
  ]
};
let dashboardState = demoDashboardData;
let notice = null;
let activeGuide = window.location.hash === "#controlled-drugs" ? GUIDE_CONTROLLED_DRUGS : GUIDE_INNOVATION;

initializeDashboard();
window.addEventListener("beforeprint", () => document.body.classList.add("is-printing-pdf"));
window.addEventListener("afterprint", () => document.body.classList.remove("is-printing-pdf"));

async function initializeDashboard() {
  dashboardState = (await loadDashboardState()) || demoDashboardData;
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
            <button class="button button-ghost" id="pdfExportButton" type="button"><i data-lucide="file-down"></i><span>PDF 导出</span></button>
            <label class="button button-primary" for="excelInput"><i data-lucide="upload"></i><span>上传 Excel</span></label>
            <input id="excelInput" type="file" accept=".xlsx,.xls" hidden />
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
  return `
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
  `;
}

function renderControlledDrugDashboard() {
  const { overview, categories, salesByQuarter } = controlledDrugData;

  return `
      <main id="controlled-drug-content" class="controlled-main">
        <section class="controlled-overview-band" aria-label="麻精经营信息总览">
          <div class="controlled-overview-copy">
            <span class="eyebrow">Controlled Drugs</span>
            <p class="business-overview">
              <strong>经营信息总览：</strong>依照《药用类精神药品目录（2025 年版）》、《药用类麻醉药品目录（2025 年版）》，麻精药品共<strong>${overview.catalogCount}</strong>个，国药西南建档<strong>${overview.archivedCount}</strong>个，建档率<strong>${overview.archiveRate}%</strong>，2026年累计销售<strong>${overview.salesText}</strong>。
            </p>
          </div>
          <div class="controlled-overview-layout">
            ${renderControlledOverviewTable(categories)}
            ${renderControlledSalesPanel(salesByQuarter, overview.salesText)}
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
        <span>示例口径</span>
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
                    <th scope="row"><span class="controlled-type-dot" style="--category-color: ${category.color}"></span>${category.title}</th>
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

function renderControlledSalesPanel(items, salesText) {
  return `
    <section class="controlled-sales-panel">
      <div class="controlled-panel-heading">
        <h2>销售额</h2>
        <span>2026累计</span>
      </div>
      <div class="controlled-donut-area">
        <div class="controlled-donut" style="--donut-gradient: ${getDonutGradient(items)}">
          <div class="controlled-donut-center">
            <strong>${salesText}</strong>
            <span>累计销售</span>
          </div>
        </div>
        <div class="controlled-donut-legend">
          ${items
            .map(
              (item) => `
                <span>
                  <i style="--legend-color: ${item.color}"></i>
                  <b>${item.label}</b>
                  <em>${item.value}%</em>
                </span>
              `
            )
            .join("")}
        </div>
      </div>
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
            ${renderPillList(category.unarchived)}
          </section>
        </div>
        <section class="controlled-detail-panel">
          <div class="controlled-detail-heading">
            <h3>建档状态</h3>
            <span>${category.salesText}</span>
          </div>
          ${renderControlledProgress(category)}
        </section>
        <section class="controlled-detail-panel">
          <div class="controlled-detail-heading">
            <h3>经营关注</h3>
            <span>后续接表</span>
          </div>
          <div class="controlled-note-stack">
            ${category.focus.map((item) => `<p>${item}</p>`).join("")}
          </div>
          <div class="controlled-action-list">
            ${category.actions.map((item) => `<span><i data-lucide="check-circle-2"></i>${item}</span>`).join("")}
          </div>
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

function renderControlledProgress(category) {
  const unarchivedCount = Math.max(category.domesticCount - category.archivedCount, 0);
  const progressItems = [
    { label: "已建档", value: category.archivedCount, total: category.domesticCount },
    { label: "未建档", value: unarchivedCount, total: category.domesticCount },
    { label: "目录覆盖", value: category.domesticCount, total: category.catalogCount }
  ];

  return `
    <div class="controlled-progress-list">
      ${progressItems
        .map((item) => {
          const percent = item.total ? Math.round((item.value / item.total) * 100) : 0;
          return `
            <div class="controlled-progress-row">
              <div>
                <span>${item.label}</span>
                <strong>${item.value}/${item.total}</strong>
              </div>
              <div class="controlled-progress-track" aria-hidden="true">
                <i style="width: ${percent}%"></i>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderInlineList(items) {
  return items.length ? `<span class="controlled-inline-list">${items.join("、")}</span>` : "/";
}

function renderPillList(items) {
  if (!items.length) return '<div class="empty-state">暂无未建档品种</div>';
  return `<div class="controlled-pill-list">${items.map((item) => `<span>${item}</span>`).join("")}</div>`;
}

function getDonutGradient(items) {
  let cursor = 0;
  return `conic-gradient(${items
    .map((item) => {
      const start = cursor;
      cursor += item.value;
      return `${item.color} ${start}% ${cursor}%`;
    })
    .join(", ")})`;
}

function bindUpload() {
  const input = document.querySelector("#excelInput");
  const uploadZone = document.querySelector("#uploadZone");

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
