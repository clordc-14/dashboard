import { requireFolderManager, requireMultipartSameOriginRequest } from "../../lib/authorization.js";
import { createAuditStatement } from "../../lib/audit.js";
import { requireDb } from "../../lib/db.js";
import { buildR2Key, createFileId, createFileVersionId, getMaxUploadBytes, mapFile, validateUploadedFile } from "../../lib/files.js";
import { requireFolderById } from "../../lib/folders.js";
import { HttpError, json, methodNotAllowed } from "../../lib/http.js";
import { cleanupPrivateFile, putPrivateFile, requireFilesBucket } from "../../lib/r2.js";

const NO_STORE_HEADERS = { "cache-control": "no-store" };

export async function onRequestPost(context) {
  requireMultipartSameOriginRequest(context.request);
  const actor = requireFolderManager(context);
  const db = requireDb(context.env);
  const bucket = requireFilesBucket(context.env);
  const formData = await readFormData(context.request);
  const folderId = formData.get("folderId");

  if (typeof folderId !== "string" || !folderId.trim()) {
    throw new HttpError(400, "Folder id is required");
  }

  const folder = await requireFolderById(db, folderId);
  const file = formData.get("file");
  const upload = validateUploadedFile(file, getMaxUploadBytes(context.env));
  const now = new Date().toISOString();
  const fileId = createFileId();
  const versionId = createFileVersionId();
  const r2Key = buildR2Key({ folderId: folder.id, fileId, version: 1, safeFileName: upload.safeFileName });
  const row = {
    id: fileId,
    folder_id: folder.id,
    name: upload.name,
    ext: upload.ext,
    mime_type: upload.mimeType,
    size: upload.size,
    r2_key: r2Key,
    version: 1,
    status: "uploaded",
    uploaded_by: actor.id,
    created_at: now,
    updated_at: now
  };

  await putPrivateFile(bucket, r2Key, file, upload.mimeType);

  try {
    const insertFile = db
      .prepare(
        `INSERT INTO files (
          id, folder_id, name, ext, mime_type, size, r2_key, version, status, uploaded_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        row.id,
        row.folder_id,
        row.name,
        row.ext,
        row.mime_type,
        row.size,
        row.r2_key,
        row.version,
        row.status,
        row.uploaded_by,
        row.created_at,
        row.updated_at
      );
    const insertVersion = db
      .prepare(
        `INSERT INTO file_versions (id, file_id, version, r2_key, size, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(versionId, row.id, row.version, row.r2_key, row.size, actor.id, now);
    const audit = createAuditStatement(db, {
      userId: actor.id,
      action: "file.create",
      entityType: "file",
      entityId: row.id,
      after: mapFile(row),
      createdAt: now
    });

    await db.batch([insertFile, insertVersion, audit]);
  } catch (error) {
    await cleanupPrivateFile(bucket, r2Key);
    throw error;
  }

  return json({ file: mapFile(row) }, { status: 201, headers: NO_STORE_HEADERS });
}

export function onRequest() {
  return methodNotAllowed(["POST"]);
}

async function readFormData(request) {
  try {
    return await request.formData();
  } catch {
    throw new HttpError(400, "Multipart form data is invalid");
  }
}
