import { createIcons, icons } from "lucide";
import { demoWorkbookState as demoDashboardData } from "./config/demoWorkbookState.js";
import { loadDashboardState } from "./state/storage.js";
import "./styles/base.css";
import "./styles/dashboard.css";

const app = document.querySelector("#productAnalysisApp");
const sinopharmLogoUrl = new URL("./assets/sinopharm-logo.png", import.meta.url).href;

const SCORE_DIMENSIONS = [
  { key: "unmetNeedScore", label: "该适应症未满足需求程度", axisLabel: "未满足需求" },
  { key: "safetyScore", label: "安全性" },
  { key: "evidenceScore", label: "证据质量与人群适用性", axisLabel: "证据质量" },
  { key: "costEffectivenessScore", label: "成本-效果阈值", axisLabel: "成本效果" },
  { key: "targetPopulationScore", label: "目标人群" },
  { key: "competitionLifecycleScore", label: "竞品与生命周期", axisLabel: "竞品生命周期" },
  { key: "lifecycleManagementScore", label: "生命周期管理" },
  { key: "policyFitScore", label: "政策导向" },
  { key: "southwestValueScore", label: "是否与西南核心医院及院外药房优势匹配", axisLabel: "西南匹配" },
  { key: "companyCapabilityScore", label: "厂牌商业化能力强弱", axisLabel: "厂牌能力" }
];

const SERIES_COLORS = ["#0f766e", "#245b89", "#b7791f", "#8b5cf6", "#b42318", "#2f7d32"];
const RANKING_COLUMNS = [
  { key: "rank", label: "排名" },
  { key: "displayName", label: "西南名称（内部品名）" },
  { key: "companyName", label: "厂牌" },
  { key: "approvalDate", label: "获批时间" },
  { key: "indication", label: "获批适应症" },
  { key: "target", label: "靶点" }
];

let dashboardState = demoDashboardData;
let selectedTimeKeys = new Set();
let selectedProducts = new Set();
let productSearch = "";
let isProductSearchComposing = false;
let currentSalesOptions = [];

initializeProductAnalysisPage();

async function initializeProductAnalysisPage() {
  dashboardState = (await loadDashboardState()) || demoDashboardData;
  renderPage();
}

function renderPage() {
  const poolSection = getInnovativeDrugPoolSection();
  const scoreSection = getDrugScoreSection();
  currentSalesOptions = getSalesOptions(poolSection);
  syncSelectionDefaults(poolSection, currentSalesOptions, scoreSection);

  app.innerHTML = `
    <div class="app-shell analysis-shell product-analysis-shell">
      <header class="topbar">
        <a class="brand" href="/" aria-label="国药西南新药引进网首页">
          <img class="brand-logo" src="${sinopharmLogoUrl}" alt="国药集团" />
          <div>
            <h1>品种分析</h1>
            <p>国药西南新药引进网</p>
          </div>
        </a>
        <div class="topbar-actions">
          <a class="button button-ghost" href="/"><i data-lucide="arrow-left"></i><span>返回首页</span></a>
        </div>
      </header>

      <main class="analysis-main">
        <section class="analysis-title-band product-title-band">
          <span class="eyebrow">品种分析</span>
          <h2>销售排名、评分雷达与同类品种对标</h2>
          <p>基于“上市创新药品种池”的销售字段与“新药评分表”的十维评分字段生成。</p>
        </section>

        <section class="analysis-filter-grid" aria-label="品种分析筛选器">
          <article class="analysis-filter-card" id="timeFilter"></article>
          <article class="analysis-filter-card" id="productFilter"></article>
        </section>

        <section class="product-analysis-results" id="analysisResults" aria-live="polite"></section>
      </main>
    </div>
  `;

  renderTimeFilter(poolSection, scoreSection);
  renderProductFilter(poolSection, scoreSection);
  renderResults(poolSection, scoreSection);
  createIcons({ icons });
}

function renderTimeFilter(poolSection, scoreSection) {
  const host = document.querySelector("#timeFilter");
  host.replaceChildren();

  const heading = document.createElement("div");
  heading.className = "filter-heading";
  heading.innerHTML = `
    <span><i data-lucide="sliders-horizontal"></i>筛选器1</span>
    <strong>产生销售时间</strong>
  `;

  const choices = document.createElement("div");
  choices.className = "time-choice-grid";

  if (!currentSalesOptions.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "未识别到销售数据列";
    host.append(heading, empty);
    return;
  }

  currentSalesOptions.forEach((option) => {
    const label = document.createElement("label");
    label.className = "choice-pill";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = selectedTimeKeys.has(option.key);
    input.addEventListener("change", () => {
      if (input.checked) {
        selectedTimeKeys.add(option.key);
      } else {
        selectedTimeKeys.delete(option.key);
      }
      renderProductFilter(poolSection, scoreSection);
      renderResults(poolSection, scoreSection);
      createIcons({ icons });
    });

    const span = document.createElement("span");
    span.textContent = option.displayLabel;
    label.append(input, span);
    choices.append(label);
  });

  host.append(heading, choices);
}

function renderProductFilter(poolSection, scoreSection) {
  const host = document.querySelector("#productFilter");
  host.replaceChildren();

  const productOptions = getProductOptions(poolSection, scoreSection);
  const filteredOptions = getFilteredProductOptions(productOptions);
  const selectedCount = productOptions.filter((option) => selectedProducts.has(option.name)).length;

  const heading = document.createElement("div");
  heading.className = "filter-heading";
  heading.innerHTML = `
    <span><i data-lucide="pill"></i>筛选器2</span>
    <strong>品种</strong>
    <small>${selectedCount} / ${productOptions.length} 已选</small>
  `;

  const searchWrap = document.createElement("label");
  searchWrap.className = "analysis-search";
  searchWrap.innerHTML = '<i data-lucide="search"></i>';
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "输入通用名、商品名、内部品名或厂牌检索";
  search.value = productSearch;
  search.addEventListener("compositionstart", () => {
    isProductSearchComposing = true;
  });
  search.addEventListener("compositionend", (event) => {
    isProductSearchComposing = false;
    productSearch = event.target.value;
    renderProductFilter(poolSection, scoreSection);
    createIcons({ icons });
    focusSearchInput("#productFilter");
  });
  search.addEventListener("input", (event) => {
    productSearch = event.target.value;
    if (isProductSearchComposing) return;
    renderProductFilter(poolSection, scoreSection);
    createIcons({ icons });
    focusSearchInput("#productFilter");
  });
  searchWrap.append(search);

  const actions = document.createElement("div");
  actions.className = "filter-actions";
  const selectVisible = document.createElement("button");
  selectVisible.type = "button";
  selectVisible.className = "button button-ghost";
  selectVisible.innerHTML = '<i data-lucide="check"></i><span>选中当前</span>';
  selectVisible.addEventListener("click", () => {
    filteredOptions.forEach((option) => selectedProducts.add(option.name));
    renderProductFilter(poolSection, scoreSection);
    renderResults(poolSection, scoreSection);
    createIcons({ icons });
  });

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "button button-ghost";
  clear.innerHTML = '<i data-lucide="x"></i><span>清空</span>';
  clear.addEventListener("click", () => {
    selectedProducts.clear();
    renderProductFilter(poolSection, scoreSection);
    renderResults(poolSection, scoreSection);
    createIcons({ icons });
  });
  actions.append(selectVisible, clear);

  const list = document.createElement("div");
  list.className = "brand-choice-list product-choice-list";

  if (!filteredOptions.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state brand-empty";
    empty.textContent = "未找到匹配品种";
    list.append(empty);
  } else {
    filteredOptions.forEach((option) => {
      const label = document.createElement("label");
      label.className = "brand-choice product-choice";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selectedProducts.has(option.name);
      input.addEventListener("change", () => {
        if (input.checked) {
          selectedProducts.add(option.name);
        } else {
          selectedProducts.delete(option.name);
        }
        renderProductFilter(poolSection, scoreSection);
        renderResults(poolSection, scoreSection);
        createIcons({ icons });
      });

      const name = document.createElement("span");
      name.className = "brand-choice-name";
      name.textContent = option.displayName;
      const meta = document.createElement("small");
      meta.textContent = `${option.companyName || "未知厂牌"} · ${formatAmount(option.total)} 万元`;
      label.append(input, name, meta);
      list.append(label);
    });
  }

  host.append(heading, searchWrap, actions, list);
}

function renderResults(poolSection, scoreSection) {
  const host = document.querySelector("#analysisResults");
  host.replaceChildren();

  if (!poolSection?.rows?.length) {
    host.append(createLargeEmpty("未识别到“上市创新药品种池”数据"));
    return;
  }

  const selectedSalesOptions = getSelectedSalesOptions();
  if (!selectedSalesOptions.length) {
    host.append(createLargeEmpty("请选择至少一个产生销售时间"));
    return;
  }

  const selectedRows = getSelectedProductRows(poolSection);
  const selectedNames = selectedRows.map((row) => getGenericProductName(row)).filter(Boolean);
  const rankingRows = createTopSalesRows(poolSection, selectedRows, selectedSalesOptions, {
    includeTarget: true,
    topCount: 5
  });

  host.append(
    createSalesTopCard(rankingRows, selectedSalesOptions),
    createRadarCard(scoreSection, selectedNames),
    createPeerRankingCard({
      title: "同疾病领域药品排名",
      icon: "activity",
      emptyText: "请选择至少一个品种后查看同疾病领域排名",
      poolSection,
      selectedRows,
      salesOptions: selectedSalesOptions,
      groupField: "diseaseArea",
      groupLabel: "疾病领域",
      includeTarget: true
    }),
    createPeerRankingCard({
      title: "同靶点药品排名",
      icon: "target",
      emptyText: "请选择至少一个品种后查看同靶点排名",
      poolSection,
      selectedRows,
      salesOptions: selectedSalesOptions,
      groupField: "target",
      groupLabel: "靶点",
      includeTarget: false
    })
  );
}

function createSalesTopCard(rows, salesOptions) {
  const card = document.createElement("article");
  card.className = "analysis-data-card product-ranking-card";
  card.innerHTML = `
    <div class="analysis-chart-top">
      <div>
        <span class="eyebrow">数据框1</span>
        <h3>销售前五品种</h3>
      </div>
      <div class="analysis-card-note">${salesOptions.map((option) => option.displayLabel).join("、")}</div>
    </div>
  `;

  card.append(createRankingTable(rows, salesOptions, { includeTarget: true }));
  return card;
}

function createRadarCard(scoreSection, selectedNames) {
  const card = document.createElement("article");
  card.className = "analysis-data-card product-radar-card";
  card.innerHTML = `
    <div class="analysis-chart-top">
      <div>
        <span class="eyebrow">数据框2</span>
        <h3>品种维度分析图</h3>
      </div>
    </div>
  `;

  if (!selectedNames.length) {
    card.append(createEmptyState("请选择品种后查看评分雷达图"));
    return card;
  }

  if (!scoreSection?.rows?.length) {
    card.append(createEmptyState("未识别到“新药评分表”数据"));
    return card;
  }

  const scoreRows = selectedNames
    .map((name) => findScoreRow(scoreSection, name))
    .filter(Boolean)
    .slice(0, SERIES_COLORS.length);

  if (!scoreRows.length) {
    card.append(createEmptyState("所选品种暂未匹配到评分数据"));
    return card;
  }

  const body = document.createElement("div");
  body.className = "product-radar-layout";
  body.append(createRadarSvg(scoreRows), createRadarSummary(scoreRows));
  card.append(body);
  return card;
}

function createPeerRankingCard({ title, icon, emptyText, poolSection, selectedRows, salesOptions, groupField, groupLabel, includeTarget }) {
  const card = document.createElement("article");
  card.className = "analysis-data-card peer-ranking-card";
  card.innerHTML = `
    <div class="analysis-chart-top">
      <div>
        <span class="eyebrow">${groupLabel}</span>
        <h3>${title}</h3>
      </div>
      <i data-lucide="${icon}"></i>
    </div>
  `;

  if (!selectedRows.length) {
    card.append(createEmptyState(emptyText));
    return card;
  }

  const panels = createPeerRankingPanels(poolSection, selectedRows, salesOptions, groupField, groupLabel, includeTarget);
  if (!panels.length) {
    card.append(createEmptyState(`所选品种暂无可比较的${groupLabel}数据`));
    return card;
  }

  const stack = document.createElement("div");
  stack.className = "peer-ranking-stack";
  panels.forEach((panel) => stack.append(panel));
  card.append(stack);
  return card;
}

function createPeerRankingPanels(poolSection, selectedRows, salesOptions, groupField, groupLabel, includeTarget) {
  const seenGroups = new Set();

  return selectedRows
    .map((selectedRow) => {
      const groupValue = cleanMeaningfulText(getRowField(selectedRow, groupField));
      if (!groupValue) return null;
      const groupKey = normalizeComparable(groupValue);
      if (seenGroups.has(groupKey)) return null;
      seenGroups.add(groupKey);

      const groupRows = poolSection.rows.filter((row) => normalizeComparable(getRowField(row, groupField)) === groupKey);
      const selectedInGroup = selectedRows.filter((row) => normalizeComparable(getRowField(row, groupField)) === groupKey);
      const rows = createTopSalesRows(
        { rows: groupRows },
        selectedInGroup,
        salesOptions,
        { includeTarget, topCount: 5 }
      );

      const panel = document.createElement("section");
      panel.className = "peer-ranking-panel";
      const heading = document.createElement("div");
      heading.className = "peer-ranking-heading";
      heading.innerHTML = `
        <strong>${escapeHtml(groupValue)}</strong>
        <span>${groupRows.length} 个品种</span>
      `;
      panel.append(heading, createRankingTable(rows, salesOptions, { includeTarget }));
      return panel;
    })
    .filter(Boolean);
}

function createRankingTable(rows, salesOptions, { includeTarget }) {
  if (!rows.length) {
    return createEmptyState("暂无符合条件的销售数据");
  }

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap product-ranking-table";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const baseColumns = includeTarget ? RANKING_COLUMNS : RANKING_COLUMNS.filter((column) => column.key !== "target");
  const columns = [
    ...baseColumns,
    ...salesOptions.map((option) => ({ key: option.key, label: option.displayLabel })),
    { key: "selectedTotal", label: "合计" }
  ];

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
    if (row.isSelected) tr.classList.add("is-selected-row");

    columns.forEach((column) => {
      const td = document.createElement("td");
      if (column.key === "rank") {
        const badge = document.createElement("span");
        badge.className = row.rank === "/" ? "rank-badge rank-badge-muted" : "rank-badge";
        badge.textContent = row.rank;
        td.append(badge);
      } else if (column.key === "displayName") {
        const name = document.createElement("strong");
        name.className = "ranking-product-name";
        name.textContent = row.displayName;
        td.append(name);
      } else if (column.key === "selectedTotal") {
        td.textContent = formatAmount(row.total);
        td.className = "amount-cell";
      } else if (salesOptions.some((option) => option.key === column.key)) {
        td.textContent = formatAmount(row.salesByKey[column.key] || 0);
        td.className = "amount-cell";
      } else {
        td.textContent = row[column.key] || "/";
      }
      tr.append(td);
    });
    tbody.append(tr);
  });

  table.append(tbody);
  tableWrap.append(table);
  return tableWrap;
}

function createTopSalesRows(section, selectedRows, salesOptions, { includeTarget, topCount }) {
  const salesKeys = salesOptions.map((option) => option.key);
  const rankedRows = section.rows
    .map((row) => createRankingRow(row, salesKeys))
    .sort(compareRankingRows)
    .map((row, index) => ({
      ...row,
      rank: row.isUnarchived ? "/" : String(index + 1)
    }));

  const topRows = rankedRows.slice(0, topCount);
  const selectedKeys = new Set(selectedRows.map((row) => getGenericProductName(row)).filter(Boolean));
  const selectedRankingRows = rankedRows.filter((row) => selectedKeys.has(row.productName));
  const selectedRowIds = new Set(selectedRankingRows.map((row) => row.id));
  const merged = [...topRows];

  selectedRankingRows.forEach((row) => {
    if (!merged.some((candidate) => candidate.id === row.id)) {
      merged.push(row);
    }
  });

  return merged.map((row) => ({
    ...row,
    isSelected: selectedRowIds.has(row.id),
    target: includeTarget ? row.target : ""
  }));
}

function createRankingRow(row, salesKeys) {
  const salesByKey = Object.fromEntries(salesKeys.map((key) => [key, sumRowsBySalesKey([row], key)]));
  const total = Object.values(salesByKey).reduce((sum, value) => sum + value, 0);
  const productName = getGenericProductName(row);
  const southwestName = cleanMeaningfulText(getRowField(row, "southwestName"));

  return {
    id: row.id,
    productName,
    displayName: southwestName || `${productName || "未命名品种"}（未建档）`,
    companyName: cleanMeaningfulText(getRowField(row, "companyName")),
    approvalDate: formatApprovalDate(getRowField(row, "approvalDate")),
    indication: cleanMeaningfulText(getRowField(row, "indication")),
    target: cleanMeaningfulText(getRowField(row, "target")),
    salesByKey,
    total,
    isUnarchived: !southwestName
  };
}

function createRadarSvg(scoreRows) {
  const size = 420;
  const center = size / 2;
  const radius = 132;
  const labelRadius = 174;
  const maxScore = 10;
  const svg = createSvgElement("svg", {
    viewBox: `0 0 ${size} ${size}`,
    width: "100%",
    height: String(size),
    role: "img",
    "aria-label": "品种十维评分雷达图"
  });

  for (let level = 1; level <= 5; level += 1) {
    const points = SCORE_DIMENSIONS.map((_, index) => {
      const angle = getRadarAngle(index);
      const levelRadius = (radius * level) / 5;
      return polarToPoint(center, center, levelRadius, angle);
    });
    svg.append(
      createSvgElement("polygon", {
        points: pointsToPolygon(points),
        class: "radar-grid-polygon"
      })
    );
  }

  SCORE_DIMENSIONS.forEach((dimension, index) => {
    const angle = getRadarAngle(index);
    const point = polarToPoint(center, center, radius, angle);
    const labelPoint = polarToPoint(center, center, labelRadius, angle);
    svg.append(
      createSvgElement("line", {
        x1: center,
        y1: center,
        x2: point.x,
        y2: point.y,
        class: "radar-axis-line"
      })
    );

    const label = createSvgElement("text", {
      x: labelPoint.x,
      y: labelPoint.y,
      class: "radar-axis-label",
      "text-anchor": getTextAnchor(labelPoint.x, center),
      "dominant-baseline": "middle"
    });
    label.textContent = dimension.axisLabel || dimension.label;
    svg.append(label);
  });

  scoreRows.forEach((row, index) => {
    const color = SERIES_COLORS[index % SERIES_COLORS.length];
    const points = SCORE_DIMENSIONS.map((dimension, dimensionIndex) => {
      const score = parseAmount(getRowField(row, dimension.key));
      const angle = getRadarAngle(dimensionIndex);
      return polarToPoint(center, center, radius * clamp(score / maxScore, 0, 1), angle);
    });

    const polygon = createSvgElement("polygon", {
      points: pointsToPolygon(points),
      class: "radar-series-polygon",
      style: `--series-color: ${color}`
    });
    const title = createSvgElement("title");
    title.textContent = getScoreProductName(row);
    polygon.append(title);
    svg.append(polygon);

    points.forEach((point) => {
      svg.append(
        createSvgElement("circle", {
          cx: point.x,
          cy: point.y,
          r: 3.8,
          class: "radar-series-point",
          style: `--series-color: ${color}`
        })
      );
    });
  });

  return svg;
}

function createRadarSummary(scoreRows) {
  const wrap = document.createElement("div");
  wrap.className = "radar-summary";

  const legend = document.createElement("div");
  legend.className = "analysis-legend radar-legend";
  scoreRows.forEach((row, index) => {
    const item = document.createElement("span");
    item.style.setProperty("--legend-color", SERIES_COLORS[index % SERIES_COLORS.length]);
    item.textContent = getScoreProductName(row);
    legend.append(item);
  });

  const notes = document.createElement("div");
  notes.className = "radar-notes";
  scoreRows.forEach((row) => {
    const note = document.createElement("p");
    note.textContent = createScoreInsight(row);
    notes.append(note);
  });

  wrap.append(legend, notes);
  return wrap;
}

function createScoreInsight(row) {
  const name = getScoreProductName(row);
  const total = parseAmount(getRowField(row, "totalScore"));
  const dimensionScores = SCORE_DIMENSIONS.map((dimension) => ({
    ...dimension,
    value: parseAmount(getRowField(row, dimension.key))
  }));
  const lowFour = dimensionScores.filter((dimension) => dimension.value === 4).map((dimension) => dimension.label);
  const minValue = Math.min(...dimensionScores.map((dimension) => dimension.value).filter(Number.isFinite));
  const lowLabels = lowFour.length
    ? lowFour
    : dimensionScores.filter((dimension) => dimension.value === minValue).map((dimension) => dimension.label);
  const valueText = lowFour.length ? "4分" : `${formatScore(minValue)}分`;

  return `${name}，合计评分${formatScore(total)}分，其中${lowLabels.join("、")}分值较低（${valueText}）。`;
}

function getSalesOptions(section) {
  if (!section?.columns?.length) return [];

  return section.columns
    .map((column, index) => createSalesOption(column, index))
    .filter(Boolean)
    .sort((left, right) => left.order - right.order || left.index - right.index);
}

function createSalesOption(column, index) {
  const label = String(column.label || "").replace(/\s+/g, "");
  const yearMatch = label.match(/^(20\d{2})年销售数据$/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return {
      key: column.key,
      label: column.label,
      displayLabel: `${year}年`,
      axisLabel: String(year),
      kind: "year",
      order: year,
      index
    };
  }

  const periodMatch = label.match(/^(\d{2})-(\d{2})$/);
  if (periodMatch) {
    return {
      key: column.key,
      label: column.label,
      displayLabel: `20${periodMatch[1]}-20${periodMatch[2]}合计`,
      axisLabel: label,
      kind: "period",
      order: Number(`20${periodMatch[2]}`) + 0.6,
      index
    };
  }

  const monthMatch = label.match(/^(20\d{2})\.(\d{1,2})(?:0+)?$/);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    return {
      key: column.key,
      label: column.label,
      displayLabel: `${year}年${month}月`,
      axisLabel: `${year}.${month}`,
      kind: "month",
      order: year + month / 12,
      index
    };
  }

  const yearTotalMatch = label.match(/^(20\d{2})年?合计$/);
  if (yearTotalMatch) {
    const year = Number(yearTotalMatch[1]);
    return {
      key: column.key,
      label: column.label,
      displayLabel: `${year}年合计`,
      axisLabel: `${year}合计`,
      kind: "yearTotal",
      order: year + 0.95,
      index
    };
  }

  if (label === "合计累计") {
    return {
      key: column.key,
      label: column.label,
      displayLabel: "合计累计",
      axisLabel: "合计",
      kind: "total",
      order: 9999,
      index
    };
  }

  return null;
}

function syncSelectionDefaults(section, salesOptions, scoreSection) {
  const validTimeKeys = new Set(salesOptions.map((option) => option.key));
  selectedTimeKeys = new Set([...selectedTimeKeys].filter((key) => validTimeKeys.has(key)));

  if (!selectedTimeKeys.size && salesOptions.length) {
    const exampleYears = salesOptions.filter((option) => ["2022年", "2023年"].includes(option.displayLabel));
    (exampleYears.length ? exampleYears : salesOptions.filter((option) => option.kind === "year").slice(0, 2)).forEach((option) =>
      selectedTimeKeys.add(option.key)
    );
    if (!selectedTimeKeys.size) selectedTimeKeys.add(salesOptions[0].key);
  }

  const productNames = new Set(getProductOptions(section, scoreSection).map((option) => option.name));
  selectedProducts = new Set([...selectedProducts].filter((name) => productNames.has(name)));

  if (!selectedProducts.size && productNames.size) {
    const preferred = ["注射用罗普司亭", "注射用戈沙妥珠单抗", "盐酸丙卡巴肼胶囊"].find((name) => productNames.has(name));
    if (preferred) selectedProducts.add(preferred);
  }
}

function getProductOptions(section, scoreSection) {
  if (!section?.rows?.length) return [];

  const selectedKeys = getSelectedSalesOptions().map((option) => option.key);
  const fallbackKeys = currentSalesOptions.filter((option) => option.kind !== "total").map((option) => option.key);
  const salesKeys = selectedKeys.length ? selectedKeys : fallbackKeys;
  const scoreNames = new Set((scoreSection?.rows || []).map(getScoreProductName).filter(Boolean));
  const productMap = new Map();

  section.rows.forEach((row) => {
    const name = getGenericProductName(row);
    if (!name) return;
    const current =
      productMap.get(name) ||
      {
        name,
        displayName: getProductDisplayName(row),
        companyName: cleanMeaningfulText(getRowField(row, "companyName")),
        searchable: [name, getRowField(row, "tradeName"), getRowField(row, "southwestName"), getRowField(row, "companyName")].join(" "),
        total: 0,
        hasScore: scoreNames.has(name)
      };

    current.total += sumRowsBySalesKeys([row], salesKeys);
    productMap.set(name, current);
  });

  return [...productMap.values()].sort((left, right) => {
    if (left.hasScore !== right.hasScore) return left.hasScore ? -1 : 1;
    return right.total - left.total || left.name.localeCompare(right.name, "zh-CN");
  });
}

function getFilteredProductOptions(productOptions) {
  const keyword = productSearch.trim().toLowerCase();
  if (!keyword) return productOptions;
  return productOptions.filter((option) => option.searchable.toLowerCase().includes(keyword));
}

function getSelectedProductRows(section) {
  if (!section?.rows?.length || !selectedProducts.size) return [];
  const seen = new Set();
  return section.rows.filter((row) => {
    const name = getGenericProductName(row);
    if (!selectedProducts.has(name) || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

function getSelectedSalesOptions() {
  return currentSalesOptions.filter((option) => selectedTimeKeys.has(option.key));
}

function getInnovativeDrugPoolSection() {
  return dashboardState.tableSections?.find((section) => section.key === "innovativeDrugPool") || null;
}

function getDrugScoreSection() {
  return dashboardState.tableSections?.find((section) => section.key === "drugScore" || section.title === "新药评分表") || null;
}

function findScoreRow(section, productName) {
  const normalized = normalizeComparable(productName);
  return section.rows.find((row) => {
    const candidates = [getRowField(row, "productName"), getRowField(row, "southwestName"), getRowField(row, "tradeName")];
    return candidates.some((candidate) => normalizeComparable(candidate) === normalized);
  });
}

function getGenericProductName(row) {
  return cleanMeaningfulText(getRowField(row, "productName"));
}

function getProductDisplayName(row) {
  const southwestName = cleanMeaningfulText(getRowField(row, "southwestName"));
  return southwestName || `${getGenericProductName(row) || "未命名品种"}（未建档）`;
}

function getScoreProductName(row) {
  return cleanMeaningfulText(getRowField(row, "productName")) || cleanMeaningfulText(getRowField(row, "southwestName")) || "未命名品种";
}

function getRowField(row, field) {
  return row.fields?.[field] || row.values?.[field] || "";
}

function cleanMeaningfulText(value) {
  const text = String(value ?? "").trim();
  return text && text !== "/" && text !== "-" && text.toLowerCase() !== "nan" ? text : "";
}

function normalizeComparable(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[（）()【】\[\]《》<>:：,，.。;；'"“”‘’_\-]/g, "");
}

function sumRowsBySalesKey(rows, key) {
  return rows.reduce((total, row) => total + parseAmount(row.values?.[key] ?? row.fields?.[key]), 0);
}

function sumRowsBySalesKeys(rows, keys) {
  return keys.reduce((total, key) => total + sumRowsBySalesKey(rows, key), 0);
}

function parseAmount(value) {
  if (value === undefined || value === null || value === "") return 0;
  const normalized = String(value)
    .replace(/,/g, "")
    .replace(/万元|万|元/g, "")
    .trim();
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : 0;
}

function compareRankingRows(left, right) {
  const totalDiff = right.total - left.total;
  if (totalDiff !== 0) return totalDiff;
  return left.productName.localeCompare(right.productName, "zh-CN");
}

function formatAmount(value) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: value >= 100 ? 1 : 2
  }).format(value || 0);
}

function formatScore(value) {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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

function createEmptyState(text) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = text;
  return empty;
}

function createLargeEmpty(text) {
  const empty = createEmptyState(text);
  empty.classList.add("empty-state-large");
  return empty;
}

function getRadarAngle(index) {
  return -Math.PI / 2 + (Math.PI * 2 * index) / SCORE_DIMENSIONS.length;
}

function polarToPoint(cx, cy, radius, angle) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  };
}

function pointsToPolygon(points) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function getTextAnchor(x, center) {
  if (Math.abs(x - center) < 18) return "middle";
  return x > center ? "start" : "end";
}

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  return element;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function focusSearchInput(filterSelector) {
  const nextSearch = document.querySelector(`${filterSelector} input[type='search']`);
  if (!nextSearch) return;
  nextSearch.focus();
  nextSearch.setSelectionRange(nextSearch.value.length, nextSearch.value.length);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
