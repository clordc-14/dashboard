import { createId } from "./db.js";
import { HttpError } from "./http.js";

const DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_FILE_ID_LENGTH = 96;
const MAX_ORIGINAL_FILE_NAME_LENGTH = 255;
const MAX_SAFE_FILE_NAME_LENGTH = 160;

const FILE_TYPES = new Map([
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["xls", "application/vnd.ms-excel"],
  ["pdf", "application/pdf"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]
]);

export function getMaxUploadBytes(env) {
  const value = String(env.MAX_UPLOAD_BYTES || "").trim();
  const configured = /^\d+$/.test(value) ? Number(value) : Number.NaN;

  return Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_UPLOAD_BYTES;
}

export function validateUploadedFile(file, maxUploadBytes) {
  if (!isFile(file)) {
    throw new HttpError(400, "A file upload is required");
  }

  const name = normalizeOriginalFileName(file.name);
  const { ext, mimeType } = getSupportedFileType(name);
  const size = Number(file.size);

  if (!Number.isSafeInteger(size) || size < 0) {
    throw new HttpError(400, "File size is invalid");
  }

  if (size > maxUploadBytes) {
    throw new HttpError(413, `File exceeds the ${maxUploadBytes}-byte upload limit`);
  }

  return {
    name,
    ext,
    mimeType,
    size,
    safeFileName: createSafeFileName(name, ext)
  };
}

export function normalizeFileId(value, label = "File id") {
  const id = String(value || "").trim();

  if (!id || id.length > MAX_FILE_ID_LENGTH || !/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new HttpError(400, `${label} is invalid`);
  }

  return id;
}

export function createFileId() {
  return createId("file");
}

export function createFileVersionId() {
  return createId("fver");
}

export function buildR2Key({ folderId, fileId, version, safeFileName }) {
  const normalizedFolderId = String(folderId || "").trim();
  const normalizedFileId = normalizeFileId(fileId);
  const numericVersion = Number(version);

  if (!normalizedFolderId || !/^[A-Za-z0-9_-]+$/.test(normalizedFolderId)) {
    throw new HttpError(400, "Folder id is invalid");
  }

  if (!Number.isSafeInteger(numericVersion) || numericVersion < 1) {
    throw new HttpError(400, "File version is invalid");
  }

  if (!safeFileName || /[\\/\p{Cc}]/u.test(safeFileName)) {
    throw new HttpError(400, "Safe file name is invalid");
  }

  return `folders/${normalizedFolderId}/files/${normalizedFileId}/v${numericVersion}/${safeFileName}`;
}

export async function findFileById(db, id) {
  return db
    .prepare(
      `SELECT id, folder_id, name, ext, mime_type, size, r2_key, version, status, uploaded_by, created_at, updated_at
       FROM files
       WHERE id = ?`
    )
    .bind(normalizeFileId(id))
    .first();
}

export async function requireFileById(db, id) {
  const file = await findFileById(db, id);

  if (!file) {
    throw new HttpError(404, "File was not found");
  }

  return file;
}

export function mapFile(row) {
  return {
    id: row.id,
    folderId: row.folder_id,
    name: row.name,
    ext: row.ext,
    mimeType: row.mime_type,
    size: Number(row.size),
    version: Number(row.version),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapFileVersion(row) {
  return {
    id: row.id,
    version: Number(row.version),
    size: Number(row.size),
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function isFile(value) {
  if (!value || typeof value !== "object") return false;

  if (typeof File !== "undefined") {
    return value instanceof File;
  }

  return typeof value.name === "string" && typeof value.arrayBuffer === "function";
}

function normalizeOriginalFileName(value) {
  const name = String(value || "").normalize("NFKC").trim();

  if (!name) {
    throw new HttpError(400, "File name is required");
  }

  if (name.length > MAX_ORIGINAL_FILE_NAME_LENGTH) {
    throw new HttpError(400, `File name must be ${MAX_ORIGINAL_FILE_NAME_LENGTH} characters or fewer`);
  }

  if (/[\p{Cc}]/u.test(name)) {
    throw new HttpError(400, "File name contains unsupported control characters");
  }

  return name;
}

function getSupportedFileType(name) {
  const dotIndex = name.lastIndexOf(".");
  const ext = dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : "";
  const mimeType = FILE_TYPES.get(ext);

  if (!mimeType) {
    throw new HttpError(415, "Only .xlsx, .xls, .pdf, .docx, and .pptx files are supported");
  }

  return { ext, mimeType };
}

function createSafeFileName(name, ext) {
  const suffix = `.${ext}`;
  const originalStem = name.slice(0, -suffix.length);
  const normalizedStem = originalStem
    .normalize("NFKD")
    .replace(/[\\/\p{Cc}\p{Cf}]/gu, "-")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const availableLength = MAX_SAFE_FILE_NAME_LENGTH - suffix.length;
  const stem = truncateUnicode(normalizedStem || "upload", availableLength) || "upload";

  return `${stem}${suffix}`;
}

function truncateUnicode(value, maxLength) {
  return Array.from(value).slice(0, maxLength).join("");
}
