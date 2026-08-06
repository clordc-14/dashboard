export function renderProcurementOriginatorDashboard(dashboard, ui) {
  const analysis = getRangeAnalysis(dashboard, ui);
  const topProduct = analysis.products[0];
  const topBrand = analysis.brands[0];
  const change = getChangePercent(analysis.trend[0]?.sales, analysis.trend.at(-1)?.sales);

  return `
    <main id="procurement-originator-content" class="specialty-main procurement-main">
      <section class="specialty-hero" aria-label="集采原研药品经营总览">
        <div class="specialty-hero-heading">
          <div>
            <span class="eyebrow">集采原研</span>
            <h2>集采原研药品经营分析</h2>
            <p>${analysis.startYear} 至 ${analysis.endYear} 年，源表收录 <strong>${dashboard.overview.catalogCount}</strong> 个有效品种，已建档经营 <strong>${dashboard.overview.archivedOperatingCount}</strong> 个，涉及 <strong>${dashboard.overview.manufacturerCount}</strong> 家原研厂家。</p>
          </div>
          <div class="specialty-hero-tools">
            ${renderYearRangeFilter("procurement", dashboard.years, analysis, "统计时段")}
            <span class="specialty-source-badge"><i data-lucide="database"></i>${escapeHtml(dashboard.source)}</span>
          </div>
        </div>
        <div class="specialty-kpi-grid">
          ${renderKpi("有效品种", dashboard.overview.catalogCount, "个", "package-check")}
          ${renderKpi("已建档经营", dashboard.overview.archivedOperatingCount, "个", "folder-check")}
          ${renderKpi("经营建档率", dashboard.overview.archiveRate, "%", "chart-no-axes-combined")}
          ${renderKpi(`${analysis.periodLabel}销售`, formatAmount(analysis.totalSales), "万元", "badge-dollar-sign")}
        </div>
        <section class="specialty-trend-section" aria-label="集采原研销售趋势">
          <div class="specialty-panel-heading">
            <div><span class="eyebrow">销售趋势</span><h2>原研药品销售趋势</h2></div>
            <p>单位：万元${analysis.endYear === 2025 ? "；2025 年为预测值" : ""}</p>
          </div>
          <div class="specialty-trend-layout">
            ${renderTrendChart(analysis.trend, "销售额（万元）")}
            <aside class="specialty-insight-card">
              <span class="eyebrow">区间结论</span>
              <h3>${analysis.periodLabel}经营要点</h3>
              <p>区间累计销售 <strong>${formatAmount(analysis.totalSales)}</strong> 万元。</p>
              ${renderInsightRow("chart-down", `${analysis.endYear} 年较 ${analysis.startYear} 年`, `${change}%`)}
              ${renderInsightRow("pill", "销售第一品种", topProduct ? `${topProduct.name} · ${formatAmount(topProduct.value)}万元` : "暂无数据")}
              ${renderInsightRow("factory", "销售第一原研厂家", topBrand ? `${topBrand.name} · ${formatAmount(topBrand.value)}万元` : "暂无数据")}
              <small>集采执行后，部分原研品种出现明显降幅，建议结合临床替代和库存策略持续跟进。</small>
            </aside>
          </div>
        </section>
      </section>

      <section class="specialty-analysis-section" aria-label="集采原研结构分析">
        <div class="specialty-section-heading">
          <div><span class="eyebrow">结构分析</span><h2>厂牌与品类分析</h2></div>
          <p>按所选时段汇总销售金额，支持识别核心合作厂家与优势治疗领域。</p>
        </div>
        <div class="specialty-analysis-grid">
          ${renderRankPanel("原研厂家销售排名", "核心厂家", analysis.brands, "factory")}
          ${renderRankPanel("药品品类销售排名", "治疗领域", analysis.categories, "layers-3")}
        </div>
      </section>

      <section class="specialty-bottom-grid" aria-label="集采原研重点品种">
        <article class="specialty-panel specialty-product-panel">
          <div class="specialty-panel-heading"><div><span class="eyebrow">品种贡献</span><h2>重点品种销售排名</h2></div><p>${analysis.periodLabel}</p></div>
          ${renderProductList(analysis.products)}
        </article>
        <article class="specialty-panel specialty-watch-panel">
          <div class="specialty-panel-heading"><div><span class="eyebrow">集采关注</span><h2>执行后降幅关注</h2></div><p>降幅按执行后首年测算</p></div>
          <div class="specialty-watch-list">${analysis.collectionWatch.length
            ? analysis.collectionWatch
                .map(
              (item) => `
                <article>
                  <div><span class="specialty-watch-icon"><i data-lucide="trending-down"></i></span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.brand)} · ${escapeHtml(item.batch)}</small></div></div>
                  <div><b>下降 ${item.decline}%</b><small>${formatAmount(item.beforeSales)} → ${formatAmount(item.afterSales)} 万元</small></div>
                </article>
              `
            )
                .join("")
            : '<div class="empty-state">所选时段暂无集采执行后降幅记录</div>'}</div>
          <p class="specialty-note"><i data-lucide="lightbulb"></i>优先复盘高销售基数且降幅明显的品种，形成集采后经营策略清单。</p>
        </article>
      </section>

      <section class="specialty-record-section specialty-panel" aria-label="集采原研药品明细">
        <div class="specialty-panel-heading"><div><span class="eyebrow">药品明细</span><h2>重点品种明细</h2></div><p>展示所选时段销售靠前的 ${analysis.products.length} 个品种</p></div>
        ${renderRecordsTable(analysis.products, analysis.periodLabel, ui, "procurement")}
      </section>
    </main>
  `;
}

export function renderHivDashboard(dashboard, ui) {
  const analysis = getRangeAnalysis(dashboard, ui, "regimens");
  const topProduct = analysis.products[0];
  const topBrand = analysis.brands[0];
  const topRegimen = analysis.categories[0];
  const regimenShare = topRegimen && analysis.totalSales ? Math.round((topRegimen.value / analysis.totalSales) * 100) : 0;

  return `
    <main id="hiv-content" class="specialty-main hiv-main">
      <section class="specialty-hero" aria-label="HIV药品经营总览">
        <div class="specialty-hero-heading">
          <div>
            <span class="eyebrow">HIV药品</span>
            <h2>HIV药品经营分析</h2>
            <p>指南目录涉及 <strong>${dashboard.overview.guidelineCount}</strong> 个品种，国药西南已建档 <strong>${dashboard.overview.archivedCount}</strong> 个，覆盖率 <strong>${dashboard.overview.archiveRate}%</strong>，涉及 <strong>${dashboard.overview.specificationCount}</strong> 个品规。</p>
          </div>
          <div class="specialty-hero-tools">
            ${renderYearRangeFilter("hiv", dashboard.years, analysis, "分析时段")}
            <span class="specialty-source-badge"><i data-lucide="book-open-check"></i>中国艾滋病诊疗指南（2024版）</span>
          </div>
        </div>
        <div class="specialty-kpi-grid">
          ${renderKpi("指南目录品种", dashboard.overview.guidelineCount, "个", "book-open-check")}
          ${renderKpi("西南建档品种", dashboard.overview.archivedCount, "个", "folder-check")}
          ${renderKpi("建档覆盖率", dashboard.overview.archiveRate, "%", "chart-no-axes-combined")}
          ${renderKpi(`${analysis.periodLabel}销售`, formatAmount(analysis.totalSales), "万元", "badge-dollar-sign")}
        </div>
        <section class="specialty-trend-section" aria-label="HIV药品销售趋势">
          <div class="specialty-panel-heading"><div><span class="eyebrow">销售趋势</span><h2>年度销售金额趋势</h2></div><p>单位：万元${analysis.endYear === 2025 ? "；2025 年为截至当前统计数据" : ""}</p></div>
          <div class="specialty-trend-layout">
            ${renderTrendChart(analysis.trend, "销售额（万元）")}
            <aside class="specialty-insight-card">
              <span class="eyebrow">经营结论</span>
              <h3>${analysis.periodLabel}销售要点</h3>
              <p>区间累计销售 <strong>${formatAmount(analysis.totalSales)}</strong> 万元。</p>
              ${renderInsightRow("pill", "销售第一品种", topProduct ? `${topProduct.name} · ${formatAmount(topProduct.value)}万元` : "暂无数据")}
              ${renderInsightRow("factory", "销售第一厂牌", topBrand ? `${topBrand.name} · ${formatAmount(topBrand.value)}万元` : "暂无数据")}
              ${renderInsightRow("git-branch", "主导治疗方案", topRegimen ? `${topRegimen.name} · ${regimenShare}%` : "暂无数据")}
              <small>指南核心方案为“2种核苷类逆转录酶抑制剂 + 1种整合酶抑制剂”，单片复方方案仍是主要增长方向。</small>
            </aside>
          </div>
        </section>
      </section>

      <section class="specialty-analysis-section" aria-label="HIV药品结构分析">
        <div class="specialty-section-heading"><div><span class="eyebrow">结构分析</span><h2>治疗方案与厂牌分析</h2></div><p>按所选时段汇总销售金额，聚焦核心治疗方案、主力厂牌与重点品种。</p></div>
        <div class="specialty-analysis-grid">
          ${renderRankPanel("治疗方案销售排名", "治疗方案", analysis.categories, "git-branch")}
          ${renderRankPanel("厂牌销售排名", "主要厂牌", analysis.brands, "factory")}
        </div>
      </section>

      <section class="specialty-bottom-grid hiv-bottom-grid" aria-label="HIV建档覆盖与重点关注">
        <article class="specialty-panel specialty-coverage-panel">
          <div class="specialty-panel-heading"><div><span class="eyebrow">指南覆盖</span><h2>药物类别建档情况</h2></div><p>按指南品种计</p></div>
          <div class="specialty-coverage-table"><table><thead><tr><th>类别</th><th>指南品种</th><th>已建档</th><th>覆盖状态</th></tr></thead><tbody>${dashboard.coverage
            .map(
              (item) => `<tr><th scope="row"><b>${escapeHtml(item.shortName)}</b><span>${escapeHtml(item.name)}</span></th><td>${item.guideline} 个</td><td>${item.archived} 个</td><td><em class="specialty-coverage-status">${escapeHtml(item.status)}</em></td></tr>`
            )
            .join("")}</tbody></table></div>
        </article>
        <article class="specialty-panel specialty-attention-panel">
          <div class="specialty-panel-heading"><div><span class="eyebrow">建档与战略</span><h2>重点关注品种</h2></div><p>结合指南与市场机会</p></div>
          <div class="specialty-attention-list">${dashboard.attentionProducts
            .map(
              (item) => `<article><span><i data-lucide="${item.type === "战略跟踪" ? "radar" : "circle-alert"}"></i></span><div><small>${escapeHtml(item.type)}</small><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.note)}</p></div></article>`
            )
            .join("")}</div>
        </article>
      </section>

      <section class="specialty-record-section specialty-panel" aria-label="HIV重点药品明细">
        <div class="specialty-panel-heading"><div><span class="eyebrow">品种贡献</span><h2>重点药品销售明细</h2></div><p>${analysis.periodLabel}销售贡献前 ${analysis.products.length} 个品种</p></div>
        ${renderRecordsTable(analysis.products, analysis.periodLabel, ui, "hiv")}
      </section>
    </main>
  `;
}

function getRangeAnalysis(dashboard, ui, categoryKey = "categories") {
  const years = [...dashboard.years].map(Number).sort((left, right) => left - right);
  if (!years.includes(Number(ui.startYear))) ui.startYear = years[0];
  if (!years.includes(Number(ui.endYear))) ui.endYear = years.at(-1);
  if (Number(ui.startYear) > Number(ui.endYear)) ui.endYear = ui.startYear;

  const startYear = Number(ui.startYear);
  const endYear = Number(ui.endYear);
  const selectedYears = years.filter((year) => year >= startYear && year <= endYear);
  const rankEntries = (entries) =>
    (entries || [])
      .map((entry) => ({ ...entry, value: sumYears(entry.sales, selectedYears) }))
      .filter((entry) => entry.value > 0)
      .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, "zh-CN"));
  const trend = (dashboard.trend || []).filter((item) => item.year >= startYear && item.year <= endYear);

  return {
    startYear,
    endYear,
    periodLabel: startYear === endYear ? `${startYear} 年` : `${startYear}—${endYear} 年`,
    trend,
    totalSales: sumValues(trend.map((item) => item.sales)),
    brands: rankEntries(dashboard.brands),
    categories: rankEntries(dashboard[categoryKey]),
    products: rankEntries(dashboard.products),
    collectionWatch: (dashboard.collectionWatch || []).filter((item) => Number(item.year) >= startYear && Number(item.year) <= endYear)
  };
}

function renderYearRangeFilter(prefix, years, analysis, label) {
  return `<label class="specialty-range-filter" aria-label="${label}"><span><i data-lucide="calendar-range"></i>${label}</span><select id="${prefix}StartYear" aria-label="开始年份">${years
    .map((year) => `<option value="${year}"${Number(year) === analysis.startYear ? " selected" : ""}>${year} 年</option>`)
    .join("")}</select><b>至</b><select id="${prefix}EndYear" aria-label="结束年份">${years
    .map((year) => `<option value="${year}"${Number(year) === analysis.endYear ? " selected" : ""}>${year} 年</option>`)
    .join("")}</select></label>`;
}

function renderKpi(label, value, unit, icon) {
  return `<article class="specialty-kpi"><span><i data-lucide="${icon}"></i>${escapeHtml(label)}</span><strong>${value}<em>${unit}</em></strong></article>`;
}

function renderTrendChart(trend, axisTitle) {
  if (!trend.length) return '<div class="empty-state">所选时段暂无销售数据</div>';
  const width = 820;
  const height = 320;
  const padding = { top: 36, right: 26, bottom: 54, left: 76 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxSales = Math.max(...trend.map((item) => item.sales), 1);
  const axisMax = getAxisMax(maxSales);
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((step) => axisMax * step);
  const step = chartWidth / trend.length;
  const barWidth = Math.min(76, step * 0.48);
  const points = trend.map((item, index) => {
    const x = padding.left + step * index + step / 2;
    const y = padding.top + chartHeight - (item.sales / axisMax) * chartHeight;
    return { ...item, x, y };
  });
  const linePath = points.map((item, index) => `${index ? "L" : "M"}${item.x} ${item.y}`).join(" ");

  return `
    <div class="specialty-chart-wrap">
      <svg class="specialty-trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${axisTitle}">
        <text x="${padding.left}" y="18" class="specialty-chart-axis-title">${axisTitle}</text>
        ${gridValues
          .map((value) => {
            const y = padding.top + chartHeight - (value / axisMax) * chartHeight;
            return `<g><line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="specialty-chart-grid"/><text x="${padding.left - 12}" y="${y + 4}" text-anchor="end" class="specialty-chart-axis">${formatAxis(value)}</text></g>`;
          })
          .join("")}
        <line x1="${padding.left}" y1="${padding.top + chartHeight}" x2="${width - padding.right}" y2="${padding.top + chartHeight}" class="specialty-chart-baseline"/>
        ${points
          .map((item) => {
            const barHeight = (item.sales / axisMax) * chartHeight;
            const x = item.x - barWidth / 2;
            const y = padding.top + chartHeight - barHeight;
            return `<g><rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="7" class="specialty-chart-bar${item.forecast || item.partial ? " is-muted" : ""}"/><text x="${item.x}" y="${Math.max(y - 10, 28)}" text-anchor="middle" class="specialty-chart-value">${formatAmount(item.sales)}</text><text x="${item.x}" y="${height - 20}" text-anchor="middle" class="specialty-chart-year">${item.year}${item.forecast ? "预测" : item.partial ? "" : ""}</text></g>`;
          })
          .join("")}
        <path d="${linePath}" class="specialty-chart-line"/>
        ${points.map((item) => `<circle cx="${item.x}" cy="${item.y}" r="5" class="specialty-chart-point"/>`).join("")}
      </svg>
      <div class="specialty-chart-legend"><span><i class="is-bar"></i>销售金额（万元）</span><span><i class="is-line"></i>年度趋势</span></div>
    </div>
  `;
}

function renderInsightRow(icon, label, value) {
  return `<div class="specialty-insight-row"><span><i data-lucide="${icon}"></i></span><div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div></div>`;
}

function renderRankPanel(title, eyebrow, entries, icon) {
  return `
    <article class="specialty-panel specialty-rank-panel">
      <div class="specialty-panel-heading"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h2>${escapeHtml(title)}</h2></div><i data-lucide="${icon}"></i></div>
      ${renderRankList(entries)}
    </article>
  `;
}

function renderRankList(entries) {
  if (!entries.length) return '<div class="empty-state">所选时段暂无可展示数据</div>';
  const visible = entries.slice(0, 7);
  const maxValue = Math.max(...visible.map((item) => item.value), 1);
  return `<ol class="specialty-rank-list">${visible
    .map((item, index) => {
      const width = Math.max(3, Math.round((item.value / maxValue) * 100));
      return `<li><span class="specialty-rank-index">${index + 1}</span><b>${escapeHtml(item.name)}</b><span class="specialty-rank-track"><i style="--rank-width:${width}%"></i></span><strong>${formatAmount(item.value)}<em>万元</em></strong></li>`;
    })
    .join("")}</ol>`;
}

function renderProductList(products) {
  if (!products.length) return '<div class="empty-state">所选时段暂无重点品种数据</div>';
  return `<div class="specialty-product-list">${products
    .slice(0, 6)
    .map(
      (item, index) => `<article><span>${index + 1}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.brand || "未标注厂牌")} · ${escapeHtml(item.category || "未标注类别")}</small></div><b>${formatAmount(item.value)}<em>万元</em></b></article>`
    )
    .join("")}</div>`;
}

function renderRecordsTable(products, periodLabel, ui, prefix) {
  const filteredProducts = getFilteredSpecialtyProducts(products, ui);
  const pageSize = Math.max(1, Number(ui.recordPageSize) || 8);
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(Math.max(1, Number(ui.recordPage) || 1), pageCount);
  ui.recordPage = currentPage;
  const startIndex = (currentPage - 1) * pageSize;
  const displayed = filteredProducts.slice(startIndex, startIndex + pageSize);
  const displayStart = filteredProducts.length ? startIndex + 1 : 0;
  const displayEnd = startIndex + displayed.length;

  return `
    <form id="${prefix}RecordSearchForm" class="specialty-record-search">
      <label><i data-lucide="search"></i><input name="specialtyRecordSearch" value="${escapeHtml(ui.recordSearch || "")}" placeholder="检索药品名称、厂牌、类别" aria-label="检索${prefix === "hiv" ? "HIV" : "集采原研"}药品明细" /></label>
      <button class="button button-ghost" type="submit"><i data-lucide="search"></i><span>检索</span></button>
    </form>
    <div class="specialty-record-meta">显示第 ${displayStart}-${displayEnd} 条，共 ${filteredProducts.length} 条（全部 ${products.length} 条）</div>
    <div class="table-wrap specialty-record-table"><table><thead><tr>${renderSpecialtyTableHeader("药品名称", "name", prefix, ui)}${renderSpecialtyTableHeader("厂牌", "brand", prefix, ui, renderSpecialtyHeaderFilter(products, ui, prefix, "brand", "厂牌", "全部厂牌"))}${renderSpecialtyTableHeader("药品类别", "category", prefix, ui, renderSpecialtyHeaderFilter(products, ui, prefix, "category", "药品类别", "全部类别"))}${renderSpecialtyTableHeader(`${escapeHtml(periodLabel)}销售`, "value", prefix, ui)}</tr></thead><tbody>${displayed.length
      ? displayed
          .map(
            (item) => `<tr><th scope="row">${escapeHtml(item.name)}</th><td>${escapeHtml(item.brand || "/")}</td><td>${escapeHtml(item.category || "/")}</td><td><strong>${formatAmount(item.value)}</strong> 万元</td></tr>`
          )
          .join("")
      : '<tr><td colspan="4"><div class="empty-state">未找到匹配的药品明细</div></td></tr>'}</tbody></table></div>
    ${renderSpecialtyPagination(currentPage, pageCount, filteredProducts.length, prefix)}
  `;
}

function getFilteredSpecialtyProducts(products, ui) {
  const search = String(ui.recordSearch || "").trim().toLowerCase();
  const filtered = products.filter((item) => {
    const matchesSearch = !search || [item.name, item.brand, item.category].join(" ").toLowerCase().includes(search);
    const matchesBrand = !ui.recordBrand || item.brand === ui.recordBrand;
    const matchesCategory = !ui.recordCategory || item.category === ui.recordCategory;
    return matchesSearch && matchesBrand && matchesCategory;
  });

  if (!ui.recordSortKey) return filtered;
  return [...filtered].sort((left, right) => {
    const result = compareSpecialtyValues(left[ui.recordSortKey], right[ui.recordSortKey]);
    return ui.recordSortDirection === "asc" ? result : -result;
  });
}

function compareSpecialtyValues(leftValue, rightValue) {
  const leftEmpty = leftValue === undefined || leftValue === null || leftValue === "";
  const rightEmpty = rightValue === undefined || rightValue === null || rightValue === "";
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;
  if (typeof leftValue === "number" && typeof rightValue === "number") return leftValue - rightValue;
  return String(leftValue).localeCompare(String(rightValue), "zh-CN", { numeric: true });
}

function getSpecialtyFilterValues(products, key) {
  return [...new Set(products.map((item) => String(item[key] || "").trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function renderSpecialtyOptions(values, selectedValue, emptyLabel) {
  return [`<option value="">${emptyLabel}</option>`]
    .concat(
      values.map((value) => {
        const escaped = escapeHtml(value);
        return `<option value="${escaped}"${value === selectedValue ? " selected" : ""}>${escaped}</option>`;
      })
    )
    .join("");
}

function renderSpecialtyHeaderFilter(products, ui, prefix, key, label, emptyLabel) {
  const selectedValue = key === "brand" ? ui.recordBrand : ui.recordCategory;
  return `<span class="header-filter-control${selectedValue ? " is-active" : ""}"><i data-lucide="filter"></i><select data-specialty-header-filter="${prefix}" data-specialty-filter-key="${key}" aria-label="按${label}筛选">${renderSpecialtyOptions(getSpecialtyFilterValues(products, key), selectedValue, emptyLabel)}</select></span>`;
}

function renderSpecialtyTableHeader(label, sortKey, prefix, ui, filterControl = "") {
  const isCurrent = ui.recordSortKey === sortKey;
  const icon = isCurrent ? (ui.recordSortDirection === "asc" ? "arrow-up" : "arrow-down") : "arrow-up-down";
  return `<th><div class="table-header-content"><button class="sort-button" type="button" data-specialty-record-sort="${prefix}" data-specialty-sort-key="${sortKey}" aria-label="按${label}排序"><span>${label}</span><i data-lucide="${icon}"></i></button>${filterControl}</div></th>`;
}

function renderSpecialtyPagination(currentPage, pageCount, rowCount, prefix) {
  if (!rowCount) return "";
  return `
    <nav class="specialty-record-pagination" aria-label="药品明细分页">
      <div class="specialty-pagination-buttons">
        <button class="button button-ghost specialty-page-button" type="button" data-specialty-record="${prefix}" data-specialty-page="1"${currentPage === 1 ? " disabled" : ""} aria-label="首页"><i data-lucide="chevrons-left"></i></button>
        <button class="button button-ghost specialty-page-button" type="button" data-specialty-record="${prefix}" data-specialty-page="${currentPage - 1}"${currentPage === 1 ? " disabled" : ""} aria-label="上一页"><i data-lucide="chevron-left"></i></button>
        ${getSpecialtyPaginationItems(currentPage, pageCount)
          .map((item) =>
            item === "…"
              ? '<span class="specialty-page-ellipsis" aria-hidden="true">…</span>'
              : `<button class="button button-ghost specialty-page-number${item === currentPage ? " is-active" : ""}" type="button" data-specialty-record="${prefix}" data-specialty-page="${item}"${item === currentPage ? ' aria-current="page"' : ""}>${item}</button>`
          )
          .join("")}
        <button class="button button-ghost specialty-page-button" type="button" data-specialty-record="${prefix}" data-specialty-page="${currentPage + 1}"${currentPage === pageCount ? " disabled" : ""} aria-label="下一页"><i data-lucide="chevron-right"></i></button>
        <button class="button button-ghost specialty-page-button" type="button" data-specialty-record="${prefix}" data-specialty-page="${pageCount}"${currentPage === pageCount ? " disabled" : ""} aria-label="末页"><i data-lucide="chevrons-right"></i></button>
      </div>
      <form id="${prefix}RecordPageJumpForm" class="specialty-page-jump"><label>跳至 <input name="specialtyRecordPage" type="number" min="1" max="${pageCount}" value="${currentPage}" inputmode="numeric" aria-label="跳转页码" /> 页</label><button class="button button-ghost" type="submit">确定</button><small>共 ${pageCount} 页</small></form>
    </nav>
  `;
}

function getSpecialtyPaginationItems(currentPage, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  if (currentPage <= 3) [2, 3, 4].forEach((page) => pages.add(page));
  if (currentPage >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((page) => pages.add(page));
  const sorted = [...pages].filter((page) => page >= 1 && page <= pageCount).sort((left, right) => left - right);
  return sorted.reduce((items, page, index) => {
    if (index && page - sorted[index - 1] > 1) items.push("…");
    items.push(page);
    return items;
  }, []);
}

function getChangePercent(firstValue, lastValue) {
  const first = Number(firstValue || 0);
  const last = Number(lastValue || 0);
  if (!first) return "—";
  const value = ((last - first) / first) * 100;
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function getAxisMax(value) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  return Math.ceil(value / magnitude / 4) * 4 * magnitude;
}

function formatAxis(value) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0, notation: value >= 10000 ? "compact" : "standard" }).format(value);
}

function formatAmount(value) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function sumYears(sales, years) {
  return years.reduce((total, year) => total + Number(sales?.[year] || 0), 0);
}

function sumValues(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
