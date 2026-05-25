import * as XLSX from "xlsx";
import { dashboardConfig } from "../config/dashboardConfig.js";

export async function readExcelFile(file) {
  validateExcelFile(file);
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), {
    type: "array",
    cellDates: true,
    cellHTML: false,
    cellNF: false
  });

  return parseWorkbook(workbook);
}

export function validateExcelFile(file) {
  if (!file) {
    throw new Error("未选择 Excel 文件。");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!dashboardConfig.upload.acceptedExtensions.includes(extension)) {
    throw new Error("文件格式不支持，请上传 .xlsx 或 .xls 文件。");
  }

  if (file.size > dashboardConfig.upload.maxFileSize) {
    throw new Error("文件超过 20MB 限制，请压缩或拆分后再上传。");
  }
}

function parseWorkbook(workbook) {
  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    return {
      name,
      rows: extractRows(sheet),
      range: sheet["!ref"] || "",
      merges: sheet["!merges"] || []
    };
  });

  return {
    sheets,
    sheetCount: sheets.length,
    sheetNames: workbook.SheetNames
  };
}

function extractRows(sheet) {
  const ref = sheet["!ref"];
  if (!ref) return [];

  const range = XLSX.utils.decode_range(ref);
  const rows = [];

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row = [];
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      row.push(readCell(sheet, rowIndex, columnIndex));
    }
    rows.push(row);
  }

  return rows;
}

function readCell(sheet, rowIndex, columnIndex) {
  const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
  const directCell = sheet[address];
  const mergedCell = directCell || findMergedAnchorCell(sheet, rowIndex, columnIndex);
  const cell = mergedCell || {};

  return {
    value: formatCellValue(cell),
    link: normalizeCellLink(cell),
    rowIndex,
    columnIndex
  };
}

function findMergedAnchorCell(sheet, rowIndex, columnIndex) {
  const merges = sheet["!merges"] || [];
  const merge = merges.find(
    (candidate) =>
      rowIndex >= candidate.s.r &&
      rowIndex <= candidate.e.r &&
      columnIndex >= candidate.s.c &&
      columnIndex <= candidate.e.c
  );

  if (!merge) return null;

  const anchorAddress = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
  return sheet[anchorAddress] || null;
}

function formatCellValue(cell) {
  if (cell.v === undefined || cell.v === null) return "";
  if (cell.w !== undefined && cell.w !== null) return String(cell.w).trim();
  if (cell.v instanceof Date) return toDateText(cell.v);
  if (cell.t === "d") return toDateText(new Date(cell.v));
  return String(cell.v).trim();
}

function normalizeCellLink(cell) {
  const target = cell?.l?.Target;
  return typeof target === "string" ? target.trim() : "";
}

function toDateText(date) {
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
