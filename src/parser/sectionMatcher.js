import { cellText, compactRows, normalizeComparable } from "./normalizer.js";

export function matchWorkbookSections(workbook, config) {
  const allSections = [...config.newsSections, ...config.tableSections];
  const usedMatchedSheets = new Set();

  const newsMatches = config.newsSections.map((section) => {
    const match = findSection(workbook, section, allSections);
    if (match?.sheetName) usedMatchedSheets.add(match.sheetName);
    return { section, match };
  });

  const tableMatches = config.tableSections.map((section) => {
    const match = findSection(workbook, section, allSections);
    if (match?.sheetName) usedMatchedSheets.add(match.sheetName);
    return { section, match };
  });

  fillDynamicTables(workbook, tableMatches, usedMatchedSheets);

  return {
    newsMatches,
    tableMatches
  };
}

function findSection(workbook, sectionConfig, allSections) {
  const matchers = getMatchers(sectionConfig);

  for (const sheet of workbook.sheets) {
    if (matchesText(sheet.name, matchers)) {
      return {
        sheetName: sheet.name,
        startRow: 0,
        endRow: Math.max(sheet.rows.length - 1, 0),
        rows: sheet.rows,
        matchType: "sheet"
      };
    }
  }

  for (const sheet of workbook.sheets) {
    for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex += 1) {
      if (!rowContainsMatcher(sheet.rows[rowIndex], matchers)) continue;

      const startRow = Math.min(rowIndex + 1, sheet.rows.length);
      const endRow = findSectionEnd(sheet.rows, startRow, allSections);

      return {
        sheetName: sheet.name,
        startRow,
        endRow: Math.max(endRow - 1, startRow),
        rows: sheet.rows.slice(startRow, endRow),
        matchType: "title"
      };
    }
  }

  return null;
}

function fillDynamicTables(workbook, tableMatches, usedWholeSheets) {
  const candidates = workbook.sheets
    .filter((sheet) => !usedWholeSheets.has(sheet.name))
    .map((sheet) => ({
      sheet,
      rows: compactRows(sheet.rows)
    }))
    .filter(({ rows }) => rows.length >= 2 && rows.some((row) => row.filter((cell) => cellText(cell)).length >= 2));

  const usedCandidateNames = new Set(tableMatches.filter(({ match }) => match?.matchType === "sheet").map(({ match }) => match.sheetName));

  tableMatches.forEach((entry) => {
    if (entry.match || !entry.section.autoFillFromUnmatched) return;

    const candidate = candidates.find(({ sheet }) => !usedCandidateNames.has(sheet.name));
    if (!candidate) return;

    usedCandidateNames.add(candidate.sheet.name);
    entry.match = {
      sheetName: candidate.sheet.name,
      startRow: 0,
      endRow: Math.max(candidate.sheet.rows.length - 1, 0),
      rows: candidate.sheet.rows,
      displayTitle: candidate.sheet.name,
      matchType: "auto-sheet"
    };
  });
}

function findSectionEnd(rows, startRow, allSections) {
  const allMatchers = allSections.flatMap(getMatchers);

  for (let rowIndex = startRow; rowIndex < rows.length; rowIndex += 1) {
    if (rowContainsMatcher(rows[rowIndex], allMatchers)) return rowIndex;
  }

  return rows.length;
}

function rowContainsMatcher(row, matchers) {
  return row.some((cell) => matchesText(cellText(cell), matchers));
}

function matchesText(value, matchers) {
  const normalizedValue = normalizeComparable(value);
  if (!normalizedValue) return false;
  return matchers.some((matcher) => normalizedValue.includes(matcher) || (normalizedValue.length >= 4 && matcher.includes(normalizedValue)));
}

function getMatchers(sectionConfig) {
  return [sectionConfig.matchTitle, sectionConfig.title, ...(sectionConfig.aliases || [])]
    .filter(Boolean)
    .map(normalizeComparable)
    .filter(Boolean);
}
