import { createIcons, icons } from "lucide";
import { demoWorkbookState as demoDashboardData } from "./config/demoWorkbookState.js";
import { loadDashboardState } from "./state/storage.js";
import "./styles/base.css";
import "./styles/dashboard.css";

const app = document.querySelector("#analysisApp");
const sinopharmLogoUrl = new URL("./assets/sinopharm-logo.png", import.meta.url).href;

let dashboardState = demoDashboardData;
let selectedTimeKeys = new Set();
let selectedBrands = new Set();
let brandSearch = "";
let currentSalesOptions = [];

initializeAnalysisPage();

async function initializeAnalysisPage() {
  dashboardState = (await loadDashboardState()) || demoDashboardData;
  renderPage();
}

function renderPage() {
  const poolSection = getInnovativeDrugPoolSection();
  currentSalesOptions = getSalesOptions(poolSection);
  syncSelectionDefaults(poolSection, currentSalesOptions);

  app.innerHTML = `
    <div class="app-shell analysis-shell">
      <header class="topbar">
        <a class="brand" href="/" aria-label="国药西南新药引进网首页">
          <img class="brand-logo" src="${sinopharmLogoUrl}" alt="国药集团" />
          <div>
            <h1>厂牌分析</h1>
            <p>国药西南新药引进网</p>
          </div>
        </a>
        <div class="topbar-actions">
          <a class="button button-ghost" href="/"><i data-lucide="arrow-left"></i><span>返回首页</span></a>
        </div>
      </header>

      <main class="analysis-main">
        <section class="analysis-title-band">
          <span class="eyebrow">Brand Analytics</span>
          <h2>销售数据与建档品种销售表现</h2>
          <p>基于“上市创新药品种池”的厂牌、是否建档及销售金额字段生成。</p>
        </section>

        <section class="analysis-filter-grid" aria-label="厂牌分析筛选器">
          <article class="analysis-filter-card" id="timeFilter"></article>
          <article class="analysis-filter-card" id="brandFilter"></article>
        </section>

        <section class="brand-analysis-results" id="analysisResults" aria-live="polite"></section>
      </main>
    </div>
  `;

  renderTimeFilter(poolSection);
  renderBrandFilter(poolSection);
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
      renderBrandFilter(poolSection);
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

function renderBrandFilter(poolSection) {
  const host = document.querySelector("#brandFilter");
  host.replaceChildren();

  const brandOptions = getBrandOptions(poolSection);
  const filteredOptions = getFilteredBrandOptions(brandOptions);
  const selectedCount = brandOptions.filter((option) => selectedBrands.has(option.name)).length;

  const heading = document.createElement("div");
  heading.className = "filter-heading";
  heading.innerHTML = `
    <span><i data-lucide="factory"></i>筛选器2</span>
    <strong>厂牌</strong>
    <small>${selectedCount} / ${brandOptions.length} 已选</small>
  `;

  const searchWrap = document.createElement("label");
  searchWrap.className = "analysis-search";
  searchWrap.innerHTML = '<i data-lucide="search"></i>';
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "输入厂牌检索";
  search.value = brandSearch;
  search.addEventListener("input", (event) => {
    brandSearch = event.target.value;
    renderBrandFilter(poolSection);
    createIcons({ icons });
    document.querySelector("#brandFilter input[type='search']")?.focus();
  });
  searchWrap.append(search);

  const actions = document.createElement("div");
  actions.className = "filter-actions";
  const selectVisible = document.createElement("button");
  selectVisible.type = "button";
  selectVisible.className = "button button-ghost";
  selectVisible.innerHTML = '<i data-lucide="check"></i><span>选中当前</span>';
  selectVisible.addEventListener("click", () => {
    filteredOptions.forEach((option) => selectedBrands.add(option.name));
    renderBrandFilter(poolSection);
    renderResults(poolSection);
    createIcons({ icons });
  });

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "button button-ghost";
  clear.innerHTML = '<i data-lucide="x"></i><span>清空</span>';
  clear.addEventListener("click", () => {
    selectedBrands.clear();
    renderBrandFilter(poolSection);
    renderResults(poolSection);
    createIcons({ icons });
  });
  actions.append(selectVisible, clear);

  const list = document.createElement("div");
  list.className = "brand-choice-list";

  if (!filteredOptions.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state brand-empty";
    empty.textContent = "未找到匹配厂牌";
    list.append(empty);
  } else {
    filteredOptions.forEach((option) => {
      const label = document.createElement("label");
      label.className = "brand-choice";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selectedBrands.has(option.name);
      input.addEventListener("change", () => {
        if (input.checked) {
          selectedBrands.add(option.name);
        } else {
          selectedBrands.delete(option.name);
        }
        renderBrandFilter(poolSection);
        renderResults(poolSection);
        createIcons({ icons });
      });

      const name = document.createElement("span");
      name.className = "brand-choice-name";
      name.textContent = option.name;
      const meta = document.createElement("small");
      meta.textContent = `${option.count} 个品种 · ${formatAmount(option.total)} 万元`;
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
    const empty = document.createElement("div");
    empty.className = "empty-state empty-state-large";
    empty.textContent = "未识别到“上市创新药品种池”数据";
    host.append(empty);
    return;
  }

  const selectedSalesOptions = getSelectedSalesOptions();
  if (!selectedSalesOptions.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state empty-state-large";
    empty.textContent = "请选择至少一个产生销售时间";
    host.append(empty);
    return;
  }

  const brandOptions = getBrandOptions(poolSection);
  const brands = brandOptions.map((option) => option.name).filter((name) => selectedBrands.has(name));
  if (!brands.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state empty-state-large";
    empty.textContent = "请选择至少一个厂牌";
    host.append(empty);
    return;
  }

  brands.forEach((brandName) => {
    host.append(createBrandPanel(poolSection, brandName, selectedSalesOptions));
  });
}

function createBrandPanel(section, brandName, salesOptions) {
  const rows = section.rows.filter((row) => getBrandName(row) === brandName);
  const analysis = analyzeBrand(rows, salesOptions);
  const panel = document.createElement("article");
  panel.className = "brand-analysis-panel";

  const heading = document.createElement("div");
  heading.className = "brand-analysis-heading";
  const titleWrap = document.createElement("div");
  titleWrap.innerHTML = `<span class="eyebrow">厂牌分析</span><h2>${escapeHtml(brandName)}</h2>`;

  const stats = document.createElement("div");
  stats.className = "brand-mini-stats";
  [
    ["品种数", rows.length],
    ["已建档品种", rows.filter((row) => isAffirmative(getRowField(row, "southwestArchived"))).length],
    ["销售合计", `${formatAmount(analysis.totalSales)} 万元`]
  ].forEach(([label, value]) => {
    const item = document.createElement("span");
    item.innerHTML = `<strong>${value}</strong><small>${label}</small>`;
    stats.append(item);
  });
  heading.append(titleWrap, stats);

  const overview = document.createElement("div");
  overview.className = "brand-overview-card";
  overview.textContent = createOverviewText(brandName, salesOptions, analysis);

  const chartGrid = document.createElement("div");
  chartGrid.className = "brand-chart-grid";
  chartGrid.append(createSalesChart(analysis.series), createProductChart(analysis.productRows));

  panel.append(heading, overview, chartGrid);
  return panel;
}

function createSalesChart(series) {
  const shell = document.createElement("section");
  shell.className = "analysis-chart-card";

  const top = document.createElement("div");
  top.className = "analysis-chart-top";
  top.innerHTML = `
    <div>
      <span class="eyebrow">数据框1</span>
      <h3>销售数据</h3>
    </div>
    <div class="analysis-legend">
      <span style="--legend-color: #2e74c9;">销售</span>
      <span style="--legend-color: #f08a24;">累计销售</span>
    </div>
  `;

  const scroll = document.createElement("div");
  scroll.className = "analysis-svg-scroll";
  scroll.append(createSalesChartSvg(series));
  shell.append(top, scroll);
  return shell;
}

function createSalesChartSvg(series) {
  const width = Math.max(640, series.length * 132);
  const height = 320;
  const margin = { top: 28, right: 34, bottom: 62, left: 72 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const baseY = height - margin.bottom;
  const maxValue = Math.max(1, ...series.flatMap((item) => [item.value, item.cumulative]));
  const roundedMax = getRoundedMax(maxValue);
  const barWidth = clamp(chartWidth / Math.max(5, series.length * 2.3), 34, 64);

  const svg = createSvgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: "img",
    "aria-label": "按产生销售时间统计的销售和累计销售图"
  });

  const xFor = (index) => {
    if (series.length === 1) return margin.left + chartWidth / 2;
    return margin.left + (chartWidth * index) / (series.length - 1);
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
        class: "analysis-grid-line"
      })
    );
    const label = createSvgElement("text", {
      x: margin.left - 12,
      y: y + 4,
      class: "analysis-axis-label",
      "text-anchor": "end"
    });
    label.textContent = formatCompactAmount(value);
    svg.append(label);
  }

  svg.append(
    createSvgElement("line", {
      x1: margin.left,
      y1: baseY,
      x2: width - margin.right,
      y2: baseY,
      class: "analysis-axis-line"
    })
  );

  series.forEach((item, index) => {
    const x = xFor(index);
    const y = yFor(item.value);
    const rect = createSvgElement("rect", {
      x: x - barWidth / 2,
      y,
      width: barWidth,
      height: Math.max(0, baseY - y),
      rx: 7,
      class: "analysis-sales-bar"
    });
    const title = createSvgElement("title");
    title.textContent = `${item.label}：${formatAmount(item.value)}万元`;
    rect.append(title);
    svg.append(rect);

    const valueLabel = createSvgElement("text", {
      x,
      y: Math.max(margin.top + 14, y - 8),
      class: "analysis-value-label",
      "text-anchor": "middle"
    });
    valueLabel.textContent = formatCompactAmount(item.value);
    svg.append(valueLabel);

    const xLabel = createSvgElement("text", {
      x,
      y: height - 28,
      class: "analysis-axis-label",
      "text-anchor": "middle"
    });
    xLabel.textContent = item.axisLabel;
    svg.append(xLabel);
  });

  const cumulativePoints = series.map((item, index) => ({
    x: xFor(index),
    y: yFor(item.cumulative),
    value: item.cumulative,
    label: item.label
  }));
  svg.append(
    createSvgElement("path", {
      d: pointsToPath(cumulativePoints),
      class: "analysis-cumulative-line"
    })
  );
  cumulativePoints.forEach((point) => {
    const circle = createSvgElement("circle", {
      cx: point.x,
      cy: point.y,
      r: 5,
      class: "analysis-cumulative-point"
    });
    const title = createSvgElement("title");
    title.textContent = `${point.label}累计：${formatAmount(point.value)}万元`;
    circle.append(title);
    svg.append(circle);

    const label = createSvgElement("text", {
      x: point.x,
      y: Math.max(margin.top + 12, point.y - 14),
      class: "analysis-cumulative-label",
      "text-anchor": "middle"
    });
    label.textContent = formatCompactAmount(point.value);
    svg.append(label);
  });

  return svg;
}

function createProductChart(productRows) {
  const shell = document.createElement("section");
  shell.className = "analysis-chart-card";

  const top = document.createElement("div");
  top.className = "analysis-chart-top";
  top.innerHTML = `
    <div>
      <span class="eyebrow">数据框2</span>
      <h3>品种销售数据</h3>
    </div>
  `;
  shell.append(top);

  if (!productRows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "暂无已建档品种销售数据";
    shell.append(empty);
    return shell;
  }

  const maxValue = Math.max(1, ...productRows.map((row) => row.value));
  const rows = document.createElement("div");
  rows.className = "product-bar-list";

  productRows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "product-bar-row";

    const name = document.createElement("span");
    name.className = "product-bar-name";
    name.textContent = row.name;
    const track = document.createElement("div");
    track.className = "product-bar-track";
    const bar = document.createElement("span");
    bar.style.width = `${Math.max(1, (row.value / maxValue) * 100)}%`;
    track.append(bar);
    const value = document.createElement("strong");
    value.textContent = formatAmount(row.value);

    item.append(name, track, value);
    rows.append(item);
  });

  shell.append(rows);
  return shell;
}

function analyzeBrand(rows, salesOptions) {
  let cumulative = 0;
  const series = salesOptions.map((option) => {
    const value = sumRowsBySalesKey(rows, option.key);
    cumulative += value;
    return {
      key: option.key,
      label: option.displayLabel,
      axisLabel: option.axisLabel,
      value,
      cumulative
    };
  });

  const productMap = new Map();
  rows
    .filter((row) => isAffirmative(getRowField(row, "southwestArchived")))
    .forEach((row) => {
      const name = getProductName(row);
      const value = sumRowsBySalesKeys([row], salesOptions.map((option) => option.key));
      productMap.set(name, (productMap.get(name) || 0) + value);
    });

  const productRows = [...productMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, "zh-CN"));

  return {
    series,
    productRows,
    totalSales: series.reduce((total, item) => total + item.value, 0),
    topProduct: productRows[0] || null
  };
}

function createOverviewText(brandName, salesOptions, analysis) {
  const timeText = salesOptions.map((option) => option.displayLabel).join("、");
  const topProduct = analysis.topProduct;
  const productText = topProduct
    ? `其中${topProduct.name}累计销售金额最高，为${formatAmount(topProduct.value)}万元。`
    : "暂无已建档品种产生销售。";
  return `在${timeText}，${brandName}产生销售合计${formatAmount(analysis.totalSales)}万元，${productText}`;
}

function getInnovativeDrugPoolSection() {
  return dashboardState.tableSections?.find((section) => section.key === "innovativeDrugPool") || null;
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

  const brandNames = new Set(getBrandOptions(section).map((option) => option.name));
  selectedBrands = new Set([...selectedBrands].filter((name) => brandNames.has(name)));

  if (!selectedBrands.size && brandNames.size) {
    if (brandNames.has("艾伯维")) {
      selectedBrands.add("艾伯维");
    } else {
      selectedBrands.add(getBrandOptions(section)[0].name);
    }
  }
}

function getBrandOptions(section) {
  if (!section?.rows?.length) return [];

  const selectedKeys = getSelectedSalesOptions().map((option) => option.key);
  const fallbackKeys = currentSalesOptions.filter((option) => option.kind !== "total").map((option) => option.key);
  const salesKeys = selectedKeys.length ? selectedKeys : fallbackKeys;
  const brandMap = new Map();

  section.rows.forEach((row) => {
    const name = getBrandName(row);
    if (!name) return;
    const current = brandMap.get(name) || { name, count: 0, total: 0 };
    current.count += 1;
    current.total += sumRowsBySalesKeys([row], salesKeys);
    brandMap.set(name, current);
  });

  return [...brandMap.values()].sort((left, right) => right.total - left.total || left.name.localeCompare(right.name, "zh-CN"));
}

function getFilteredBrandOptions(brandOptions) {
  const keyword = brandSearch.trim().toLowerCase();
  if (!keyword) return brandOptions;
  return brandOptions.filter((option) => option.name.toLowerCase().includes(keyword));
}

function getSelectedSalesOptions() {
  return currentSalesOptions.filter((option) => selectedTimeKeys.has(option.key));
}

function sumRowsBySalesKey(rows, key) {
  return rows.reduce((total, row) => total + parseAmount(row.values?.[key] ?? row.fields?.[key]), 0);
}

function sumRowsBySalesKeys(rows, keys) {
  return keys.reduce((total, key) => total + sumRowsBySalesKey(rows, key), 0);
}

function getBrandName(row) {
  return cleanMeaningfulText(getRowField(row, "companyName"));
}

function getProductName(row) {
  return (
    cleanMeaningfulText(getRowField(row, "southwestName")) ||
    cleanMeaningfulText(getRowField(row, "productName")) ||
    cleanMeaningfulText(getRowField(row, "tradeName")) ||
    "未命名品种"
  );
}

function getRowField(row, field) {
  return row.fields?.[field] || row.values?.[field] || "";
}

function cleanMeaningfulText(value) {
  const text = String(value ?? "").trim();
  return text && text !== "/" && text !== "-" ? text : "";
}

function isAffirmative(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return (
    ["是", "yes", "y", "true", "1", "已落地", "已建档", "√"].includes(text) ||
    text.startsWith("是，") ||
    text.startsWith("是,")
  );
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

function formatAmount(value) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: value >= 100 ? 1 : 2
  }).format(value || 0);
}

function formatCompactAmount(value) {
  if (value >= 10000) return `${formatAmount(value / 10000)}万`;
  return formatAmount(value);
}

function getRoundedMax(value) {
  if (value <= 10) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  return element;
}

function pointsToPath(points) {
  return points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
