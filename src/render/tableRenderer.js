const POOL_SERIES = [
  { key: "newDrugCount", label: "上市新药数", color: "#0f766e" },
  { key: "landedSichuanCount", label: "落地四川数", color: "#245b89" },
  { key: "southwestArchivedCount", label: "国药西南建档数", color: "#b7791f" }
];

const SUPPORT_DETAIL_COLUMNS = [
  { key: "sequence", label: "序号" },
  { key: "productName", label: "通用名", field: "productName", link: true },
  { key: "tradeName", label: "商品名", field: "tradeName" },
  { key: "companyName", label: "厂牌", field: "companyName" },
  { key: "approvalDate", label: "获批时间", field: "approvalDate", date: true },
  { key: "indication", label: "获批适应症", field: "indication" },
  { key: "priorityReview", label: "是否优先审评审批", field: "priorityReview" },
  { key: "mainAdvantage", label: "主要优势", field: "mainAdvantage" },
  { key: "rating", label: "评价", field: "rating", rating: true }
];

const PROGRESS_DETAIL_COLUMNS = [
  { key: "sequence", label: "序号" },
  { key: "productName", label: "通用名", field: "productName", link: true },
  { key: "tradeName", label: "商品名", field: "tradeName" },
  { key: "companyName", label: "厂牌", field: "companyName" },
  { key: "approvalDate", label: "获批时间", field: "approvalDate", date: true },
  { key: "landedInSichuan", label: "落地四川", field: "landedInSichuan" },
  { key: "purchase", label: "采购", field: "purchase" },
  { key: "purchaseRemark", label: "采购备注", field: "purchaseRemark" }
];

const PROGRESS_BUCKETS = [
  { label: "无联系人", match: "四、未合作/无联系人", color: "#245b89" },
  { label: "无法动作", match: "一、无法动作", color: "#b42318" },
  { label: "沟通建档", match: "三、沟通中（待定）", color: "#0f766e" },
  { label: "等待建档", match: "二、等待建档", color: "#b7791f" },
  { label: "商务不建议/DTP", match: "六、商务不建议/只销售DTP药房品种", color: "#6b5b95" },
  { label: "需求建档", match: "五、需求建档", color: "#2f7d32" },
  { label: "调货品种", match: "七、调货品种", color: "#8a5a2b" }
];

const timeFilterValues = new Map();

export function renderTableCards(container, sections = [], onOpen) {
  container.replaceChildren();

  sections.filter((section) => !isPartnerCommunication(section)).forEach((section) => {
    if (isNeedLeaderSupport(section)) {
      container.append(createNeedLeaderSupportCard(section, onOpen));
      return;
    }

    if (isIntroductionProgress(section)) {
      container.append(createIntroductionProgressCard(section, onOpen));
      return;
    }

    if (isInnovativeDrugPool(section)) {
      container.append(createInnovativeDrugPoolCard(section, onOpen));
      return;
    }

    const card = document.createElement("article");
    card.className = isArchivedProducts(section) ? "table-card is-archived-products" : "table-card";
    card.id = `card-${section.key}`;

    const heading = document.createElement("div");
    heading.className = "panel-heading";

    const titleWrap = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = section.title;
    const source = document.createElement("p");
    source.className = "source-note";
    source.textContent = section.source?.sheetName ? `来源：${section.source.sheetName}` : "未识别到对应板块";
    titleWrap.append(title, source);

    const button = document.createElement("button");
    button.className = "icon-button";
    button.type = "button";
    button.title = "查看完整表格";
    button.setAttribute("aria-label", `查看${section.title}`);
    button.innerHTML = '<i data-lucide="arrow-right"></i>';
    button.addEventListener("click", () => onOpen(section.key));

    heading.append(titleWrap, button);
    card.append(heading);

    const metrics = createMetrics(section);
    card.append(metrics);

    if (!hasPreviewRows(section) || !section.columns.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = isArchivedProducts(section) ? "暂无符合条件的四/五星品种" : "暂无表格数据";
      card.append(empty);
    } else {
      card.append(createPreviewTable(section));
    }

    container.append(card);
  });
}

export function computeTableMetrics(section) {
  if (isInnovativeDrugPool(section)) {
    const rows = getInnovativeTrendRows(section, "all");
    const totals = summarizeTrendRows(rows);

    return {
      rowCount: totals.newDrugCount,
      assistCount: 0,
      focusCount: totals.southwestArchivedCount,
      landedSichuanCount: totals.landedSichuanCount,
      southwestArchivedCount: totals.southwestArchivedCount
    };
  }

  if (isArchivedProducts(section)) {
    const recentArchivedCount = section.rows.filter(isRecentArchivedProduct).length;
    const highRatingCount = section.rows.filter(isFeaturedArchivedProduct).length;

    return {
      rowCount: section.rows.length,
      assistCount: 0,
      focusCount: highRatingCount,
      recentArchivedCount,
      highRatingCount
    };
  }

  if (isNeedLeaderSupport(section)) {
    const metrics = getLeaderSupportMetrics(section.rows);

    return {
      rowCount: metrics.total,
      assistCount: metrics.total,
      focusCount: metrics.focusCount,
      landedSichuanCount: metrics.landedCount
    };
  }

  if (isIntroductionProgress(section)) {
    return {
      rowCount: section.rows.length,
      assistCount: section.rows.filter((row) => getRowField(row, "progress").includes("等待建档")).length,
      focusCount: section.rows.filter((row) => getStarCount(row) >= 4).length
    };
  }

  const rowCount = section.rows.length;
  const assistCount = section.rows.filter((row) => containsAny(row, ["协助", "待", "未合作"])).length;
  const focusCount = section.rows.filter((row) => containsAny(row, ["重点", "创新", "优先"])).length;

  return {
    rowCount,
    assistCount,
    focusCount
  };
}

export function getDisplayValue(row, column) {
  return row.values?.[column.key] ?? "";
}

function createInnovativeDrugPoolCard(section, onOpen) {
  const card = document.createElement("article");
  card.className = "table-card is-innovative-pool";
  card.id = `card-${section.key}`;
  const body = document.createElement("div");
  body.className = "innovative-pool-body";

  const heading = document.createElement("div");
  heading.className = "panel-heading pool-heading";

  const titleWrap = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = section.title;
  const source = document.createElement("p");
  source.className = "source-note";
  source.textContent = section.source?.sheetName ? `来源：${section.source.sheetName}` : "未识别到对应板块";
  titleWrap.append(title, source);

  const actions = document.createElement("div");
  actions.className = "panel-actions pool-panel-actions";

  const timeFilter = createTimeFilterControl(section, section.key, "筛选上市新药品种池时间", (value) => {
    renderInnovativePoolBody(body, section, value);
  });

  const button = document.createElement("button");
  button.className = "icon-button";
  button.type = "button";
  button.title = "查看完整表格";
  button.setAttribute("aria-label", `查看${section.title}`);
  button.innerHTML = '<i data-lucide="arrow-right"></i>';
  button.addEventListener("click", () => onOpen(section.key));

  actions.append(timeFilter.node, button);
  heading.append(titleWrap, actions);
  card.append(heading);

  card.append(body);
  renderInnovativePoolBody(body, section, timeFilter.value);

  return card;
}

function renderInnovativePoolBody(body, section, filterValue) {
  body.replaceChildren();

  const trendRows = getInnovativeTrendRows(section, filterValue);

  if (!trendRows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state empty-state-large";
    empty.textContent = "暂无可按获批时间统计的品种数据";
    body.append(empty);
    return;
  }

  body.append(createPoolMetrics(summarizeTrendRows(trendRows)), createPoolChart(trendRows));
}

function createNeedLeaderSupportCard(section, onOpen) {
  const card = document.createElement("article");
  card.className = "table-card is-need-leader-support";
  card.id = `card-${section.key}`;
  const body = document.createElement("div");
  body.className = "leader-support-body";

  const heading = createTimeFilteredHeading(section, onOpen, "筛选需领导协助引进时间", (value) => {
    renderNeedLeaderSupportBody(body, section, value);
  });

  card.append(heading, body);
  renderNeedLeaderSupportBody(body, section, getSelectedTimeFilterValue(section.key));
  return card;
}

function renderNeedLeaderSupportBody(body, section, filterValue) {
  body.replaceChildren();

  const rows = getTimeFilteredRows(section, filterValue);
  const featuredRows = getLeaderFeaturedRows(rows);
  const otherRows = getOtherUnarchivedLandingRows(rows);

  body.append(
    createLeaderSupportMetrics(getLeaderSupportMetrics(rows)),
    createInsightTable({
      title: "重点品种明细",
      rows: featuredRows,
      columns: SUPPORT_DETAIL_COLUMNS,
      section,
      className: "support-featured-table",
      emptyText: "暂无四/五星重点品种"
    }),
    createInsightTable({
      title: "其他落地未建档品种",
      rows: otherRows,
      columns: SUPPORT_DETAIL_COLUMNS,
      section,
      className: "support-other-table",
      emptyText: "暂无其他落地未建档品种"
    })
  );
}

function createLeaderSupportMetrics(metrics) {
  const wrap = document.createElement("div");
  wrap.className = "leader-metrics";

  [
    ["需领导协助品种数", metrics.total, "leader-metric-total"],
    ["落地四川数", metrics.landedCount, "leader-metric-landed"],
    ["四星/五星品种数", metrics.focusCount, "leader-metric-focus"]
  ].forEach(([label, value, className]) => {
    const item = document.createElement("div");
    item.className = `leader-metric ${className}`;
    const span = document.createElement("span");
    span.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    item.append(span, strong);
    wrap.append(item);
  });

  return wrap;
}

function createIntroductionProgressCard(section, onOpen) {
  const card = document.createElement("article");
  card.className = "table-card is-introduction-progress";
  card.id = `card-${section.key}`;
  const body = document.createElement("div");
  body.className = "introduction-progress-body";

  const heading = createTimeFilteredHeading(section, onOpen, "筛选新药引进进展时间", (value) => {
    renderIntroductionProgressBody(body, section, value);
  });

  card.append(heading, body);
  renderIntroductionProgressBody(body, section, getSelectedTimeFilterValue(section.key));
  return card;
}

function renderIntroductionProgressBody(body, section, filterValue) {
  body.replaceChildren();

  const rows = getTimeFilteredRows(section, filterValue);
  const left = document.createElement("div");
  left.className = "intro-progress-left";
  left.append(createIntroductionRecordMetric(rows.length), createProgressBarChart(rows));

  const right = document.createElement("div");
  right.className = "intro-progress-right";
  right.append(
    createInsightTable({
      title: "部分品种进展",
      rows: getProgressHighlightRows(rows),
      columns: PROGRESS_DETAIL_COLUMNS,
      section,
      className: "progress-highlight-table",
      emptyText: "暂无符合排序规则的四/五星品种"
    })
  );

  body.append(left, right);
}

function createIntroductionRecordMetric(value) {
  const metric = document.createElement("div");
  metric.className = "intro-record-metric";
  const span = document.createElement("span");
  span.textContent = "新药引进沟通记录数";
  const strong = document.createElement("strong");
  strong.textContent = value;
  metric.append(span, strong);
  return metric;
}

function createProgressBarChart(rows) {
  const shell = document.createElement("section");
  shell.className = "progress-chart-shell";

  const title = document.createElement("h3");
  title.textContent = "品种沟通进展";
  shell.append(title);

  const counts = PROGRESS_BUCKETS.map((bucket) => ({
    ...bucket,
    count: rows.filter((row) => matchesProgressBucket(row, bucket.match)).length
  }));
  const maxValue = Math.max(1, ...counts.map((item) => item.count));

  const list = document.createElement("div");
  list.className = "progress-bars";
  counts.forEach((item) => {
    const row = document.createElement("div");
    row.className = "progress-bar-row";
    row.style.setProperty("--bar-color", item.color);

    const label = document.createElement("span");
    label.className = "progress-bar-label";
    label.textContent = item.label;

    const track = document.createElement("div");
    track.className = "progress-bar-track";
    const bar = document.createElement("span");
    bar.style.width = `${(item.count / maxValue) * 100}%`;
    track.append(bar);

    const value = document.createElement("strong");
    value.textContent = item.count;

    row.append(label, track, value);
    list.append(row);
  });

  shell.append(list);
  return shell;
}

function createTimeFilteredHeading(section, onOpen, ariaLabel, onFilterChange) {
  const heading = document.createElement("div");
  heading.className = "panel-heading pool-heading";

  const titleWrap = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = section.title;
  const source = document.createElement("p");
  source.className = "source-note";
  source.textContent = section.source?.sheetName ? `来源：${section.source.sheetName}` : "未识别到对应板块";
  titleWrap.append(title, source);

  const actions = document.createElement("div");
  actions.className = "panel-actions pool-panel-actions";
  const timeFilter = createTimeFilterControl(section, section.key, ariaLabel, onFilterChange);

  const button = document.createElement("button");
  button.className = "icon-button";
  button.type = "button";
  button.title = "查看完整表格";
  button.setAttribute("aria-label", `查看${section.title}`);
  button.innerHTML = '<i data-lucide="arrow-right"></i>';
  button.addEventListener("click", () => onOpen(section.key));

  actions.append(timeFilter.node, button);
  heading.append(titleWrap, actions);
  return heading;
}

function createTimeFilterControl(section, filterKey, ariaLabel, onChange) {
  const filterWrap = document.createElement("label");
  filterWrap.className = "pool-filter-wrap";
  filterWrap.innerHTML = '<i data-lucide="calendar-range"></i><span>时间</span>';

  const filter = document.createElement("select");
  filter.className = "pool-filter";
  filter.setAttribute("aria-label", ariaLabel);
  const options = getTimeFilterOptions(section);
  const selectedValue = getSelectedTimeFilter(options, filterKey);

  options.forEach((option) => filter.append(new Option(option.label, option.value)));
  filter.value = selectedValue;
  filter.addEventListener("change", () => {
    timeFilterValues.set(filterKey, filter.value);
    onChange(filter.value);
  });

  filterWrap.append(filter);
  return { node: filterWrap, value: selectedValue };
}

function createInsightTable({ title, rows, columns, section, className = "", emptyText = "暂无数据" }) {
  const panel = document.createElement("section");
  panel.className = `insight-table-panel ${className}`.trim();

  const top = document.createElement("div");
  top.className = "insight-table-heading";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const count = document.createElement("span");
  count.textContent = `${rows.length} 项`;
  top.append(heading, count);
  panel.append(top);

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = emptyText;
    panel.append(empty);
    return panel;
  }

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap preview-table insight-table-wrap";
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
  rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    columns.forEach((column) => {
      const td = document.createElement("td");
      if (column.key === "sequence") {
        const badge = document.createElement("span");
        badge.className = "preview-index";
        badge.textContent = String(rowIndex + 1);
        td.append(badge);
      } else if (column.link) {
        const anchor = document.createElement("a");
        anchor.className = "product-detail-link";
        anchor.href = buildSearchUrl(section.key, getRowField(row, column.field));
        anchor.textContent = getFormattedField(row, column);
        anchor.title = "查看完整信息";
        td.append(anchor);
      } else {
        td.textContent = getFormattedField(row, column);
        if (column.rating) td.className = "rating-cell";
      }
      tr.append(td);
    });
    tbody.append(tr);
  });

  table.append(tbody);
  tableWrap.append(table);
  panel.append(tableWrap);
  return panel;
}

function createPoolMetrics(totals) {
  const wrap = document.createElement("div");
  wrap.className = "pool-metrics";

  [
    ["上市新药数目", totals.newDrugCount, "pool-metric-new"],
    ["落地四川数", totals.landedSichuanCount, "pool-metric-landed"],
    ["国药西南建档数", totals.southwestArchivedCount, "pool-metric-archived"]
  ].forEach(([label, value, className]) => {
    const item = document.createElement("div");
    item.className = `pool-metric ${className}`;
    const span = document.createElement("span");
    span.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    item.append(span, strong);
    wrap.append(item);
  });

  return wrap;
}

function createPoolChart(trendRows) {
  const shell = document.createElement("div");
  shell.className = "pool-chart-shell";

  const top = document.createElement("div");
  top.className = "pool-chart-top";
  const title = document.createElement("h3");
  title.textContent = "月度趋势";
  const legend = document.createElement("div");
  legend.className = "pool-legend";

  POOL_SERIES.forEach((series) => {
    const item = document.createElement("span");
    item.style.setProperty("--series-color", series.color);
    item.textContent = series.label;
    legend.append(item);
  });

  top.append(title, legend);
  shell.append(top);

  const scroll = document.createElement("div");
  scroll.className = "pool-chart-scroll";
  scroll.append(createPoolChartSvg(trendRows));
  shell.append(scroll);

  return shell;
}

function createPoolChartSvg(trendRows) {
  const showXAxis = trendRows.length <= 12;
  const showPointLabels = trendRows.length <= 12;
  const width = Math.max(1080, trendRows.length * (showXAxis ? 72 : 24));
  const height = 310;
  const margin = {
    top: 28,
    right: 28,
    bottom: showXAxis ? 52 : 28,
    left: 46
  };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const rawMaxValue = Math.max(
    1,
    ...trendRows.flatMap((row) => POOL_SERIES.map((series) => row[series.key]))
  );
  const maxValue = rawMaxValue <= 4 ? 4 : Math.ceil(rawMaxValue / 4) * 4;

  const svg = createSvgElement("svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "上市新药品种池月度趋势折线图");

  for (let index = 0; index <= 4; index += 1) {
    const value = Math.round((maxValue * (4 - index)) / 4);
    const y = margin.top + (chartHeight * index) / 4;
    const line = createSvgElement("line", {
      x1: margin.left,
      y1: y,
      x2: width - margin.right,
      y2: y,
      class: "pool-grid-line"
    });
    const label = createSvgElement("text", {
      x: margin.left - 10,
      y: y + 4,
      class: "pool-axis-label",
      "text-anchor": "end"
    });
    label.textContent = value;
    svg.append(line, label);
  }

  const axis = createSvgElement("line", {
    x1: margin.left,
    y1: height - margin.bottom,
    x2: width - margin.right,
    y2: height - margin.bottom,
    class: "pool-axis-line"
  });
  svg.append(axis);

  const xFor = (index) => {
    if (trendRows.length === 1) return margin.left + chartWidth / 2;
    return margin.left + (chartWidth * index) / (trendRows.length - 1);
  };
  const yFor = (value) => margin.top + chartHeight - (chartHeight * value) / maxValue;

  if (showXAxis) {
    trendRows.forEach((row, index) => {
      const label = createSvgElement("text", {
        x: xFor(index),
        y: height - 18,
        class: "pool-axis-label",
        "text-anchor": "middle"
      });
      label.textContent = getShortMonthLabel(row.month);
      svg.append(label);
    });
  }

  const seriesPointSets = POOL_SERIES.map((series, seriesIndex) => ({
    series,
    seriesIndex,
    points: trendRows.map((row, index) => ({
      x: xFor(index),
      y: yFor(row[series.key]),
      value: row[series.key],
      month: row.month
    }))
  }));

  seriesPointSets.forEach(({ series, points }) => {
    const path = createSvgElement("path", {
      d: pointsToPath(points),
      class: "pool-series-line",
      style: `--series-color: ${series.color}`
    });
    svg.append(path);

    points.forEach((point) => {
      const circle = createSvgElement("circle", {
        cx: point.x,
        cy: point.y,
        r: 4.5,
        class: "pool-series-point",
        style: `--series-color: ${series.color}`
      });
      const tooltip = createSvgElement("title");
      tooltip.textContent = `${series.label} ${getMonthLabel(point.month)}：${point.value}`;
      circle.append(tooltip);
      svg.append(circle);
    });
  });

  if (showPointLabels) {
    appendPoolPointLabels(svg, seriesPointSets, trendRows.length, margin, height);
  }

  return svg;
}

function appendPoolPointLabels(svg, seriesPointSets, pointCount, margin, height) {
  const minGap = 22;
  const topBound = margin.top - 8;
  const bottomBound = height - margin.bottom - 8;

  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const labels = seriesPointSets
      .map(({ series, seriesIndex, points }) => ({
        series,
        seriesIndex,
        point: points[pointIndex],
        y: points[pointIndex].y - getPreferredLabelOffset(seriesIndex)
      }))
      .sort((left, right) => left.y - right.y || left.seriesIndex - right.seriesIndex);

    labels.forEach((label, index) => {
      label.y = clamp(label.y, topBound, bottomBound);
      if (index > 0 && label.y - labels[index - 1].y < minGap) {
        label.y = labels[index - 1].y + minGap;
      }
    });

    const overflow = labels[labels.length - 1].y - bottomBound;
    if (overflow > 0) {
      labels.forEach((label) => {
        label.y -= overflow;
      });
    }

    const underflow = topBound - labels[0].y;
    if (underflow > 0) {
      labels.forEach((label) => {
        label.y += underflow;
      });
    }

    labels.forEach((label) => {
      const labelText = String(label.point.value);
      const labelWidth = labelText.length * 7 + 12;
      const group = createSvgElement("g", {
        class: "pool-point-label-group",
        style: `--series-color: ${label.series.color}`
      });
      const background = createSvgElement("rect", {
        x: label.point.x - labelWidth / 2,
        y: label.y - 13,
        width: labelWidth,
        height: 18,
        rx: 6,
        class: "pool-point-label-bg"
      });
      const text = createSvgElement("text", {
        x: label.point.x,
        y: label.y,
        class: "pool-point-label",
        "text-anchor": "middle"
      });
      text.textContent = labelText;
      group.append(background, text);
      svg.append(group);
    });
  }
}

function getPreferredLabelOffset(seriesIndex) {
  return [14, 12, 10][seriesIndex] || 12;
}

function getTimeFilterOptions(section) {
  const months = getSectionMonths(section);
  if (!months.length) {
    return [{ value: "all", label: "全部时间" }];
  }

  const years = [...new Set(months.map((month) => month.slice(0, 4)))].sort((left, right) => Number(right) - Number(left));
  const options = [{ value: "all", label: "全部时间" }];

  if (months.length > 12) options.push({ value: "recent:12", label: "近12个月" });
  if (months.length > 6) options.push({ value: "recent:6", label: "近6个月" });

  years.forEach((year) => {
    options.push({ value: `year:${year}`, label: `${year}年` });
  });

  [...months].reverse().forEach((month) => {
    options.push({ value: `month:${month}`, label: getMonthLabel(month) });
  });

  return options;
}

function getSelectedTimeFilter(options, filterKey) {
  const currentValue = timeFilterValues.get(filterKey) || "";
  if (!options.some((option) => option.value === currentValue)) {
    const fallback = options.find((option) => option.value.startsWith("year:"))?.value || options[0]?.value || "all";
    timeFilterValues.set(filterKey, fallback);
  }

  return timeFilterValues.get(filterKey) || "all";
}

function getSelectedTimeFilterValue(filterKey) {
  return timeFilterValues.get(filterKey) || "all";
}

function getInnovativeTrendRows(section, filterValue) {
  const months = getSelectedMonths(getSectionMonths(section), filterValue);
  const buckets = new Map(
    months.map((month) => [
      month,
      {
        month,
        newDrugCount: 0,
        landedSichuanCount: 0,
        southwestArchivedCount: 0
      }
    ])
  );

  section.rows.forEach((row) => {
    const month = getApprovalMonth(row);
    const bucket = buckets.get(month);
    if (!bucket) return;

    bucket.newDrugCount += 1;
    if (isAffirmative(getRowField(row, "landedInSichuan"))) bucket.landedSichuanCount += 1;
    if (isAffirmative(getRowField(row, "southwestArchived"))) bucket.southwestArchivedCount += 1;
  });

  return months.map((month) => buckets.get(month));
}

function summarizeTrendRows(rows) {
  return rows.reduce(
    (totals, row) => ({
      newDrugCount: totals.newDrugCount + row.newDrugCount,
      landedSichuanCount: totals.landedSichuanCount + row.landedSichuanCount,
      southwestArchivedCount: totals.southwestArchivedCount + row.southwestArchivedCount
    }),
    { newDrugCount: 0, landedSichuanCount: 0, southwestArchivedCount: 0 }
  );
}

function getSelectedMonths(months, filterValue) {
  if (!months.length) return [];
  if (filterValue?.startsWith("month:")) {
    const month = filterValue.slice("month:".length);
    return months.includes(month) ? [month] : [];
  }

  if (filterValue?.startsWith("year:")) {
    const year = filterValue.slice("year:".length);
    return months.filter((month) => month.startsWith(`${year}-`));
  }

  if (filterValue?.startsWith("recent:")) {
    const count = Number(filterValue.slice("recent:".length));
    return months.slice(-Math.max(1, count || 12));
  }

  return months;
}

function getSectionMonths(section) {
  return [...new Set(section.rows.map(getApprovalMonth).filter(Boolean))].sort();
}

function getTimeFilteredRows(section, filterValue) {
  const months = getSectionMonths(section);
  if (!months.length || !filterValue || filterValue === "all") return section.rows;

  const selectedMonths = new Set(getSelectedMonths(months, filterValue));
  return section.rows.filter((row) => selectedMonths.has(getApprovalMonth(row)));
}

function getLeaderSupportMetrics(rows) {
  return {
    total: rows.length,
    landedCount: rows.filter((row) => isAffirmative(getRowField(row, "landedInSichuan"))).length,
    focusCount: rows.filter((row) => getStarCount(row) >= 4).length
  };
}

function getLeaderFeaturedRows(rows) {
  return rows
    .filter((row) => getStarCount(row) >= 4)
    .sort(comparePriorityRows);
}

function getOtherUnarchivedLandingRows(rows) {
  return rows
    .filter((row) => isAffirmative(getRowField(row, "landedInSichuan")))
    .filter((row) => !isAffirmative(getRowField(row, "southwestArchived")))
    .filter((row) => getStarCount(row) < 4)
    .sort((left, right) => getApprovalTime(right) - getApprovalTime(left))
    .slice(0, 3);
}

function getProgressHighlightRows(rows) {
  return rows
    .filter((row) => getProgressSortGroup(row) < 6)
    .sort(compareProgressHighlightRows)
    .slice(0, 10);
}

function comparePriorityRows(left, right) {
  const starDiff = getStarCount(right) - getStarCount(left);
  if (starDiff !== 0) return starDiff;
  return getApprovalTime(right) - getApprovalTime(left);
}

function compareProgressHighlightRows(left, right) {
  const groupDiff = getProgressSortGroup(left) - getProgressSortGroup(right);
  if (groupDiff !== 0) return groupDiff;
  return getApprovalTime(right) - getApprovalTime(left);
}

function getProgressSortGroup(row) {
  const stars = getStarCount(row);
  const year = getApprovalYear(row);
  if (stars >= 5 && year === 2026) return 0;
  if (stars >= 5 && year === 2025) return 1;
  if (stars === 4 && year === 2026) return 2;
  if (stars === 4 && year === 2025) return 3;
  if (stars >= 5 && year === 2024) return 4;
  if (stars === 4 && year === 2024) return 5;
  return 6;
}

function matchesProgressBucket(row, matchText) {
  const progress = getRowField(row, "progress") || getRowField(row, "status");
  return String(progress).includes(matchText);
}

function getFormattedField(row, column) {
  const value = column.date ? formatApprovalDate(getRowField(row, column.field)) : getRowField(row, column.field);
  return value || "/";
}

function getApprovalMonth(row) {
  const parts = getDateParts(getRowField(row, "approvalDate"));
  if (!parts) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

function getMonthLabel(month) {
  const [year, rawMonth] = month.split("-");
  return `${year}年${Number(rawMonth)}月`;
}

function getShortMonthLabel(month) {
  const [, rawMonth] = month.split("-");
  return `${Number(rawMonth)}月`;
}

function isAffirmative(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return (
    ["是", "yes", "y", "true", "1", "已落地", "已建档", "√"].includes(text) ||
    text.startsWith("是，") ||
    text.startsWith("是,")
  );
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

function createMetrics(section) {
  const metrics = computeTableMetrics(section);
  const wrap = document.createElement("div");
  wrap.className = isArchivedProducts(section) ? "mini-metrics archived-metrics" : "mini-metrics";

  const items = isArchivedProducts(section)
    ? [
        ["2025至2026年已建档品种数目", metrics.recentArchivedCount],
        ["四/五星品种", metrics.highRatingCount]
      ]
    : [
        ["记录数", metrics.rowCount],
        ["待协助", metrics.assistCount],
        ["重点项", metrics.focusCount]
      ];

  items.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "mini-metric";
    const strong = document.createElement("strong");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    item.append(strong, span);
    wrap.append(item);
  });

  return wrap;
}

function createPreviewTable(section) {
  if (isArchivedProducts(section)) {
    return createArchivedProductsTable(section);
  }

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap preview-table";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const columns = section.columns.slice(0, 4);

  columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column.label;
    headRow.append(th);
  });

  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  section.rows.slice(0, 5).forEach((row) => {
    const tr = document.createElement("tr");
    columns.forEach((column) => {
      const td = document.createElement("td");
      td.textContent = getDisplayValue(row, column);
      tr.append(td);
    });
    tbody.append(tr);
  });

  table.append(tbody);
  tableWrap.append(table);
  return tableWrap;
}

function createArchivedProductsTable(section) {
  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap preview-table archived-preview-table";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const columns = getArchivedPreviewColumns();

  columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column.label;
    headRow.append(th);
  });

  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  getArchivedPreviewRows(section).forEach((row, index) => {
    const tr = document.createElement("tr");
    columns.forEach((column) => {
      const td = document.createElement("td");

      if (column.key === "sequence") {
        const badge = document.createElement("span");
        badge.className = "preview-index";
        badge.textContent = String(index + 1);
        td.append(badge);
      } else if (column.key === "productName") {
        const anchor = document.createElement("a");
        anchor.className = "product-detail-link";
        anchor.href = buildSearchUrl(section.key, getRowField(row, "productName"));
        anchor.textContent = getRowField(row, "productName") || "查看品种";
        anchor.title = "查看完整信息";
        td.append(anchor);
      } else {
        td.textContent = formatArchivedValue(row, column.key);
        if (column.key === "rating") td.className = "rating-cell";
      }

      tr.append(td);
    });
    tbody.append(tr);
  });

  table.append(tbody);
  tableWrap.append(table);
  return tableWrap;
}

function hasPreviewRows(section) {
  if (!section.rows.length) return false;
  if (!isArchivedProducts(section)) return true;
  return getArchivedPreviewRows(section).length > 0;
}

function getArchivedPreviewColumns() {
  return [
    { key: "sequence", label: "序号" },
    { key: "productName", label: "品种名称" },
    { key: "companyName", label: "厂牌" },
    { key: "approvalDate", label: "获批时间" },
    { key: "indication", label: "获批适应症" },
    { key: "target", label: "靶点" },
    { key: "purchase", label: "采购" },
    { key: "rating", label: "评价" }
  ];
}

function getArchivedPreviewRows(section) {
  return section.rows
    .filter(isFeaturedArchivedProduct)
    .sort(compareArchivedRows)
    .slice(0, 6);
}

function compareArchivedRows(left, right) {
  const groupDiff = getFeaturedGroup(left) - getFeaturedGroup(right);
  if (groupDiff !== 0) return groupDiff;
  return getApprovalTime(right) - getApprovalTime(left);
}

function getFeaturedGroup(row) {
  const year = getApprovalYear(row);
  const stars = getStarCount(row);
  if (year === 2026 && stars >= 5) return 0;
  if (year === 2026 && stars === 4) return 1;
  if (year === 2025 && stars >= 5) return 2;
  return 3;
}

function isArchivedProducts(section) {
  return section.key === "archivedProducts";
}

function isNeedLeaderSupport(section) {
  return section.key === "needLeaderSupport";
}

function isIntroductionProgress(section) {
  return section.key === "introductionProgress";
}

function isInnovativeDrugPool(section) {
  return section.key === "innovativeDrugPool";
}

function isPartnerCommunication(section) {
  return section.key === "partnerCommunication";
}

function isRecentArchivedProduct(row) {
  return [2025, 2026].includes(getApprovalYear(row));
}

function isFeaturedArchivedProduct(row) {
  return isRecentArchivedProduct(row) && getStarCount(row) >= 4;
}

function getRowField(row, field) {
  return row.fields?.[field] || row.values?.[field] || "";
}

function formatArchivedValue(row, field) {
  const value = getRowField(row, field);
  if (field === "approvalDate") return formatApprovalDate(value);
  return value;
}

function buildSearchUrl(sectionKey, query) {
  const params = new URLSearchParams({
    section: sectionKey,
    search: query
  });
  return `/table.html?${params.toString()}`;
}

function getStarCount(row) {
  const rating = getRowField(row, "rating");
  return (String(rating).match(/[⭐★]/g) || []).length;
}

function getApprovalYear(row) {
  return getDateParts(getRowField(row, "approvalDate"))?.year || 0;
}

function getApprovalTime(row) {
  const parts = getDateParts(getRowField(row, "approvalDate"));
  if (!parts) return 0;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
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

function containsAny(row, keywords) {
  const text = Object.values(row.values || {}).join(" ");
  return keywords.some((keyword) => text.includes(keyword));
}
