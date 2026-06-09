import { createIcons, icons } from "lucide";
import { demoWorkbookState as demoDashboardData } from "./config/demoWorkbookState.js";
import { loadDashboardState } from "./state/storage.js";
import "./styles/base.css";
import "./styles/dashboard.css";

const app = document.querySelector("#targetAnalysisApp");
const sinopharmLogoUrl = new URL("./assets/sinopharm-logo.png", import.meta.url).href;
const SERIES_COLORS = ["#0f766e", "#245b89", "#b7791f", "#8b5cf6", "#b42318", "#2f7d32", "#0e7490", "#a21caf"];
const BASE_RANKING_COLUMNS = [
  { key: "rank", label: "排名" },
  { key: "displayName", label: "西南名称（CMS品名）" },
  { key: "companyName", label: "厂牌" },
  { key: "approvalDate", label: "获批时间" },
  { key: "indication", label: "获批适应症" },
  { key: "target", label: "靶点" }
];

let dashboardState = demoDashboardData;
let selectedTimeKeys = new Set();
let selectedTargets = new Set();
let targetSearch = "";
let isTargetSearchComposing = false;
let currentSalesOptions = [];

initializeTargetAnalysisPage();

async function initializeTargetAnalysisPage() {
  dashboardState = (await loadDashboardState()) || demoDashboardData;
  renderPage();
}

function renderPage() {
  const poolSection = getInnovativeDrugPoolSection();
  currentSalesOptions = getSalesOptions(poolSection);
  syncSelectionDefaults(poolSection, currentSalesOptions);

  app.innerHTML = `
    <div class="app-shell analysis-shell target-analysis-shell">
      <header class="topbar">
        <a class="brand" href="/" aria-label="国药西南新药引进网首页">
          <img class="brand-logo" src="${sinopharmLogoUrl}" alt="国药集团" />
          <div>
            <h1>靶点分析</h1>
            <p>国药西南新药引进网</p>
          </div>
        </a>
        <div class="topbar-actions">
          <a class="button button-ghost" href="/"><i data-lucide="arrow-left"></i><span>返回首页</span></a>
        </div>
      </header>

      <main class="analysis-main">
        <section class="analysis-title-band target-title-band">
          <span class="eyebrow">Target Analytics</span>
          <h2>靶点销售趋势、批文数量与重点品种排名</h2>
          <p>基于“上市创新药品种池”的靶点、获批时间与销售字段生成，后续新增 2026.2、2026.3 等月份列会自动进入时间筛选。</p>
        </section>

        <section class="analysis-filter-grid target-filter-grid" aria-label="靶点分析筛选器">
          <article class="analysis-filter-card" id="timeFilter"></article>
          <article class="analysis-filter-card" id="targetFilter"></article>
        </section>

        <section class="target-analysis-results" id="analysisResults" aria-live="polite"></section>
      </main>
    </div>
  `;

  renderTimeFilter(poolSection);
  renderTargetFilter(poolSection);
  renderResults(poolSection);
  createIcons({ icons });
}

function renderTimeFilter(poolSection) {
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
    host.append(heading, createEmptyState("未识别到销售数据列"));
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
      renderTargetFilter(poolSection);
      renderResults(poolSection);
      createIcons({ icons });
    });

    const span = document.createElement("span");
    span.textContent = option.displayLabel;
    label.append(input, span);
    choices.append(label);
  });

  host.append(heading, choices);
}

function renderTargetFilter(poolSection) {
  const host = document.querySelector("#targetFilter");
  host.replaceChildren();

  const targetOptions = getTargetOptions(poolSection);
  const filteredOptions = getFilteredTargetOptions(targetOptions);
  const selectedCount = targetOptions.filter((option) => selectedTargets.has(option.name)).length;

  const heading = document.createElement("div");
  heading.className = "filter-heading";
  heading.innerHTML = `
    <span><i data-lucide="target"></i>筛选器2</span>
    <strong>靶点</strong>
    <small>${selectedCount} / ${targetOptions.length} 已选</small>
  `;

  const searchWrap = document.createElement("label");
  searchWrap.className = "analysis-search";
  searchWrap.innerHTML = '<i data-lucide="search"></i>';
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "输入靶点名称检索";
  search.value = targetSearch;
  search.addEventListener("compositionstart", () => {
    isTargetSearchComposing = true;
  });
  search.addEventListener("compositionend", (event) => {
    isTargetSearchComposing = false;
    targetSearch = event.target.value;
    renderTargetFilter(poolSection);
    createIcons({ icons });
    focusSearchInput("#targetFilter");
  });
  search.addEventListener("input", (event) => {
    targetSearch = event.target.value;
    if (isTargetSearchComposing) return;
    renderTargetFilter(poolSection);
    createIcons({ icons });
    focusSearchInput("#targetFilter");
  });
  searchWrap.append(search);

  const actions = document.createElement("div");
  actions.className = "filter-actions";

  const selectVisible = document.createElement("button");
  selectVisible.type = "button";
  selectVisible.className = "button button-ghost";
  selectVisible.innerHTML = '<i data-lucide="check"></i><span>选中当前</span>';
  selectVisible.addEventListener("click", () => {
    filteredOptions.forEach((option) => selectedTargets.add(option.name));
    renderTargetFilter(poolSection);
    renderResults(poolSection);
    createIcons({ icons });
  });

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "button button-ghost";
  clear.innerHTML = '<i data-lucide="x"></i><span>清空</span>';
  clear.addEventListener("click", () => {
    selectedTargets.clear();
    renderTargetFilter(poolSection);
    renderResults(poolSection);
    createIcons({ icons });
  });
  actions.append(selectVisible, clear);

  const list = document.createElement("div");
  list.className = "brand-choice-list target-choice-list";

  if (!filteredOptions.length) {
    const empty = createEmptyState("未找到匹配靶点");
    empty.classList.add("brand-empty");
    list.append(empty);
  } else {
    filteredOptions.forEach((option) => {
      const label = document.createElement("label");
      label.className = "brand-choice target-choice";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selectedTargets.has(option.name);
      input.addEventListener("change", () => {
        if (input.checked) {
          selectedTargets.add(option.name);
        } else {
          selectedTargets.delete(option.name);
        }
        renderTargetFilter(poolSection);
        renderResults(poolSection);
        createIcons({ icons });
      });

      const name = document.createElement("span");
      name.className = "brand-choice-name";
      name.textContent = option.name;
      const meta = document.createElement("small");
      meta.textContent = `${option.count} 个批文 · ${formatAmount(option.total)} 万元`;
      label.append(input, name, meta);
      list.append(label);
    });
  }

  host.append(heading, searchWrap, actions, list);
}

function renderResults(poolSection) {
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

  const targetOptions = getTargetOptions(poolSection);
  if (!targetOptions.length) {
    host.append(createLargeEmpty("未识别到可分析的靶点数据"));
    return;
  }

  const explicitlySelectedTargets = getSelectedTargetNames(targetOptions);
  const chartTargetNames = explicitlySelectedTargets.length
    ? explicitlySelectedTargets
    : targetOptions.slice(0, Math.min(5, SERIES_COLORS.length)).map((option) => option.name);

  const salesSeries = createSalesSeries(poolSection, chartTargetNames, selectedSalesOptions);
  const approvalSeries = createApprovalSeries(poolSection, chartTargetNames, selectedSalesOptions);
  const rankingRows = createRankingRows(poolSection, explicitlySelectedTargets, selectedSalesOptions);

  host.append(
    createLineChartCard({
      title: "销售数据",
      icon: "trending-up",
      note: createChartNote(chartTargetNames, selectedSalesOptions),
      legendLabel: "销售金额（万元）",
      emptyText: "暂无符合条件的销售数据",
      series: salesSeries,
      valueFormatter: formatCompactAmount
    }),
    createLineChartCard({
      title: "批文数据",
      icon: "file-check-2",
      note: "按所选销售时间映射获批时间统计批文数目",
      legendLabel: "批文数目（个）",
      emptyText: "暂无符合条件的批文数据",
      series: approvalSeries,
      valueFormatter: formatCount
    }),
    createTopProductsCard(rankingRows, selectedSalesOptions, explicitlySelectedTargets)
  );
}

function createLineChartCard({ title, icon, note, legendLabel, emptyText, series, valueFormatter }) {
  const card = document.createElement("article");
  card.className = "analysis-data-card target-chart-card";
  card.innerHTML = `
    <div class="analysis-chart-top">
      <div>
        <span class="eyebrow">数据框</span>
        <h3>${title}</h3>
      </div>
      <i data-lucide="${icon}"></i>
    </div>
    <div class="target-chart-note">${escapeHtml(note)}</div>
  `;

  if (!series.length || !series.some((item) => item.points.length)) {
    card.append(createEmptyState(emptyText));
    return card;
  }

  const legend = document.createElement("div");
  legend.className = "analysis-legend target-legend";
  series.forEach((item) => {
    const legendItem = document.createElement("span");
    legendItem.style.setProperty("--legend-color", item.color);
    legendItem.textContent = item.name;
    legend.append(legendItem);
  });

  const scroll = document.createElement("div");
  scroll.className = "target-chart-scroll";
  scroll.append(createMultiLineSvg(series, legendLabel, valueFormatter));

  card.append(legend, scroll);
  return card;
}

function createMultiLineSvg(series, yAxisLabel, valueFormatter) {
  const pointCount = Math.max(1, ...series.map((item) => item.points.length));
  const width = Math.max(680, pointCount * 132);
  const height = 340;
  const margin = { top: 32, right: 42, bottom: 64, left: 82 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(1, ...series.flatMap((item) => item.points.map((point) => point.value)));
  const roundedMax = getRoundedMax(maxValue);
  const labelPoints = series.length <= 3;

  const svg = createSvgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: "img",
    "aria-label": yAxisLabel
  });

  const firstSeries = series.find((item) => item.points.length) || { points: [] };
  const xFor = (index) => {
    if (pointCount === 1) return margin.left + chartWidth / 2;
    return margin.left + (chartWidth * index) / (pointCount - 1);
  };
  const yFor = (value) => margin.top + chartHeight - (chartHeight * value) / roundedMax;

  for (let index = 0; index <= 4; index += 1) {
    const value = (roundedMax * (4 - index)) / 4;
    const y = margin.top + (chartHeight * index) / 4;
    svg.append(
      createSvgElement("line", {
        x1: margin.left,
        y1: y,
        x2: width - margin.right,
        y2: y,
        class: "target-grid-line"
      })
    );

    const label = createSvgElement("text", {
      x: margin.left - 12,
      y: y + 4,
      class: "target-axis-label",
      "text-anchor": "end"
    });
    label.textContent = valueFormatter(value);
    svg.append(label);
  }

  svg.append(
    createSvgElement("line", {
      x1: margin.left,
      y1: height - margin.bottom,
      x2: width - margin.right,
      y2: height - margin.bottom,
      class: "target-axis-line"
    })
  );

  const yLabel = createSvgElement("text", {
    x: 18,
    y: margin.top + 8,
    class: "target-axis-title"
  });
  yLabel.textContent = yAxisLabel;
  svg.append(yLabel);

  firstSeries.points.forEach((point, index) => {
    const label = createSvgElement("text", {
      x: xFor(index),
      y: height - 28,
      class: "target-axis-label",
      "text-anchor": "middle"
    });
    label.textContent = point.axisLabel;
    svg.append(label);
  });

  series.forEach((item) => {
    const points = item.points.map((point, index) => ({
      ...point,
      x: xFor(index),
      y: yFor(point.value)
    }));

    svg.append(
      createSvgElement("path", {
        d: pointsToPath(points),
        class: "target-series-line",
        style: `--series-color: ${item.color}`
      })
    );

    points.forEach((point) => {
      const circle = createSvgElement("circle", {
        cx: point.x,
        cy: point.y,
        r: 5,
        class: "target-series-point",
        style: `--series-color: ${item.color}`
      });
      const title = createSvgElement("title");
      title.textContent = `${item.name} · ${point.label}: ${valueFormatter(point.value)}`;
      circle.append(title);
      svg.append(circle);

      if (labelPoints || point.value > 0) {
        const valueLabel = createSvgElement("text", {
          x: point.x,
          y: Math.max(margin.top + 12, point.y - 12),
          class: "target-point-label",
          "text-anchor": "middle",
          style: `--series-color: ${item.color}`
        });
        valueLabel.textContent = valueFormatter(point.value);
        svg.append(valueLabel);
      }
    });
  });

  return svg;
}

function createTopProductsCard(rows, salesOptions, selectedTargetNames) {
  const card = document.createElement("article");
  card.className = "analysis-data-card target-ranking-card";
  const note = selectedTargetNames.length
    ? `${selectedTargetNames.join("、")} 的品种明细，排名按所选销售时间合计计算`
    : "未选择靶点时展示所选时间内销售合计 TOP5 品种";

  card.innerHTML = `
    <div class="analysis-chart-top">
      <div>
        <span class="eyebrow">数据框</span>
        <h3>销售TOP5品种</h3>
      </div>
      <div class="analysis-card-note">${escapeHtml(note)}</div>
    </div>
  `;
  card.append(createRankingTable(rows, salesOptions));
  return card;
}

function createRankingTable(rows, salesOptions) {
  if (!rows.length) {
    return createEmptyState("暂无符合条件的品种销售数据");
  }

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap product-ranking-table target-ranking-table";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const columns = [
    ...BASE_RANKING_COLUMNS,
    ...salesOptions.map((option) => ({ key: option.key, label: option.displayLabel })),
    { key: "selectedTotal", label: "合计销售" }
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
    columns.forEach((column) => {
      const td = document.createElement("td");
      if (column.key === "rank") {
        const badge = document.createElement("span");
        badge.className = "rank-badge";
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

function createSalesSeries(section, targetNames, salesOptions) {
  return targetNames
    .map((targetName, index) => {
      const rows = getRowsByTarget(section, targetName);
      return {
        name: targetName,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
        points: salesOptions.map((option) => ({
          key: option.key,
          label: option.displayLabel,
          axisLabel: option.axisLabel,
          value: sumRowsBySalesKey(rows, option.key)
        }))
      };
    })
    .filter((item) => item.points.length);
}

function createApprovalSeries(section, targetNames, salesOptions) {
  return targetNames
    .map((targetName, index) => {
      const rows = getRowsByTarget(section, targetName);
      return {
        name: targetName,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
        points: salesOptions.map((option) => ({
          key: option.key,
          label: option.displayLabel,
          axisLabel: option.axisLabel,
          value: countApprovalsByOption(rows, option)
        }))
      };
    })
    .filter((item) => item.points.length);
}

function createRankingRows(section, selectedTargetNames, salesOptions) {
  const salesKeys = salesOptions.map((option) => option.key);
  const selectedTargetKeys = new Set(selectedTargetNames.map(normalizeComparable));
  const rankedRows = section.rows
    .map((row) => createRankingRow(row, salesKeys))
    .filter((row) => row.target)
    .sort(compareRankingRows)
    .map((row, index) => ({
      ...row,
      rank: String(index + 1)
    }));

  if (!selectedTargetNames.length) return rankedRows.slice(0, 5);

  return rankedRows.filter((row) => selectedTargetKeys.has(normalizeComparable(row.target)));
}

function createRankingRow(row, salesKeys) {
  const salesByKey = Object.fromEntries(salesKeys.map((key) => [key, sumRowsBySalesKey([row], key)]));
  const total = Object.values(salesByKey).reduce((sum, value) => sum + value, 0);
  const productName = cleanMeaningfulText(getRowField(row, "productName"));
  const southwestName = cleanMeaningfulText(getRowField(row, "southwestName"));
  const tradeName = cleanMeaningfulText(getRowField(row, "tradeName"));

  return {
    id: row.id,
    displayName: southwestName || productName || tradeName || "未命名品种",
    companyName: cleanMeaningfulText(getRowField(row, "companyName")),
    approvalDate: formatApprovalDate(getRowField(row, "approvalDate")),
    indication: cleanMeaningfulText(getRowField(row, "indication")),
    target: cleanMeaningfulText(getRowField(row, "target")),
    salesByKey,
    total
  };
}

function countApprovalsByOption(rows, option) {
  return rows.filter((row) => {
    const parts = getDateParts(getRowField(row, "approvalDate"));
    if (!parts) return false;
    if (option.kind === "year") return parts.year === option.year;
    if (option.kind === "period") return parts.year >= option.startYear && parts.year <= option.endYear;
    if (option.kind === "month") return parts.year === option.year && parts.month === option.month;
    if (option.kind === "total") return true;
    return false;
  }).length;
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
      year,
      order: year,
      index
    };
  }

  const periodMatch = label.match(/^(\d{2})-(\d{2})$/);
  if (periodMatch) {
    const startYear = Number(`20${periodMatch[1]}`);
    const endYear = Number(`20${periodMatch[2]}`);
    return {
      key: column.key,
      label: column.label,
      displayLabel: `${startYear}-${endYear}合计`,
      axisLabel: label,
      kind: "period",
      startYear,
      endYear,
      order: endYear + 0.6,
      index
    };
  }

  const monthMatch = label.match(/^(20\d{2})\.(\d{1,2})$/);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    return {
      key: column.key,
      label: column.label,
      displayLabel: `${year}年${month}月`,
      axisLabel: `${year}.${month}`,
      kind: "month",
      year,
      month,
      order: year + month / 12,
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

function syncSelectionDefaults(section, salesOptions) {
  const validTimeKeys = new Set(salesOptions.map((option) => option.key));
  selectedTimeKeys = new Set([...selectedTimeKeys].filter((key) => validTimeKeys.has(key)));

  if (!selectedTimeKeys.size && salesOptions.length) {
    const defaultOptions = salesOptions.filter((option) => option.kind === "year").slice(0, 4);
    (defaultOptions.length ? defaultOptions : salesOptions.filter((option) => option.kind !== "total")).forEach((option) =>
      selectedTimeKeys.add(option.key)
    );
    if (!selectedTimeKeys.size) selectedTimeKeys.add(salesOptions[0].key);
  }

  const targetNames = new Set(getTargetOptions(section).map((option) => option.name));
  selectedTargets = new Set([...selectedTargets].filter((name) => targetNames.has(name)));

  if (!selectedTargets.size && targetNames.size) {
    if (targetNames.has("CDK4/6")) {
      selectedTargets.add("CDK4/6");
    } else {
      selectedTargets.add(getTargetOptions(section)[0].name);
    }
  }
}

function getTargetOptions(section) {
  if (!section?.rows?.length) return [];

  const selectedKeys = getSelectedSalesOptions().map((option) => option.key);
  const fallbackKeys = currentSalesOptions.filter((option) => option.kind !== "total").map((option) => option.key);
  const salesKeys = selectedKeys.length ? selectedKeys : fallbackKeys;
  const targetMap = new Map();

  section.rows.forEach((row) => {
    const name = cleanMeaningfulText(getRowField(row, "target"));
    if (!name) return;
    const current = targetMap.get(name) || { name, count: 0, total: 0 };
    current.count += 1;
    current.total += sumRowsBySalesKeys([row], salesKeys);
    targetMap.set(name, current);
  });

  return [...targetMap.values()].sort((left, right) => {
    const totalDiff = right.total - left.total;
    if (totalDiff !== 0) return totalDiff;
    return right.count - left.count || left.name.localeCompare(right.name, "zh-CN");
  });
}

function getFilteredTargetOptions(targetOptions) {
  const keyword = targetSearch.trim().toLowerCase();
  if (!keyword) return targetOptions;
  return targetOptions.filter((option) => option.name.toLowerCase().includes(keyword));
}

function getSelectedTargetNames(targetOptions) {
  return targetOptions.map((option) => option.name).filter((name) => selectedTargets.has(name));
}

function getRowsByTarget(section, targetName) {
  const targetKey = normalizeComparable(targetName);
  return (section?.rows || []).filter((row) => normalizeComparable(getRowField(row, "target")) === targetKey);
}

function getSelectedSalesOptions() {
  return currentSalesOptions.filter((option) => selectedTimeKeys.has(option.key));
}

function getInnovativeDrugPoolSection() {
  return dashboardState.tableSections?.find((section) => section.key === "innovativeDrugPool") || null;
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
    .replace(/[()（）【】\[\]《》<>:：;；,，.。"“”'‘’`·\-_/\\]/g, "");
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
    .replace(/万元|万/g, "")
    .trim();
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : 0;
}

function compareRankingRows(left, right) {
  const totalDiff = right.total - left.total;
  if (totalDiff !== 0) return totalDiff;
  return left.displayName.localeCompare(right.displayName, "zh-CN");
}

function formatAmount(value) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: value >= 100 ? 1 : 2
  }).format(value || 0);
}

function formatCompactAmount(value) {
  if (value >= 10000) return `${formatAmount(value / 10000)}万`;
  return formatAmount(value);
}

function formatCount(value) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value || 0);
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

function getRoundedMax(value) {
  if (value <= 10) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function createChartNote(targetNames, salesOptions) {
  const targetText = targetNames.length ? targetNames.join("、") : "全部靶点";
  const timeText = salesOptions.map((option) => option.displayLabel).join("、");
  return `${targetText} · ${timeText}`;
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

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  return element;
}

function pointsToPath(points) {
  return points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
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
