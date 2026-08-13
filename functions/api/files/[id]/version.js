import { requireFolderManager, requireMultipartSameOriginRequest } from "../../../lib/authorization.js";
import { createConditionalAuditStatement } from "../../../lib/audit.js";
import { requireDb } from "../../../lib/db.js";
import {
  buildR2Key,
  createFileVersionId,
  getMaxUploadBytes,
  mapFile,
  requireFileById,
  validateUploadedFile
} from "../../../lib/files.js";
import { HttpError, json, methodNotAllowed } from "../../../lib/http.js";
import { cleanupPrivateFile, putPrivateFile, requireFilesBucket } from "../../../lib/r2.js";

const NO_STORE_HEADERS = { "cache-control": "no-store" };

export async function onRequestPost(context) {
  requireMultipartSameOriginRequest(context.request);
  const actor = requireFolderManager(context);
  const db = requireDb(context.env);
  const bucket = requireFilesBucket(context.env);
  const file = await requireFileById(db, context.params.id);

  if (file.status === "archived") {
    throw new HttpError(409, "Archived files cannot receive a new version");
  }

  const formData = await readFormData(context.request);
  const uploadedFile = formData.get("file");
  const upload = validateUploadedFile(uploadedFile, getMaxUploadBytes(context.env));
  const expectedVersion = Number(file.version);

  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    throw new HttpError(409, "Current file version is invalid");
  }

  const nextVersion = expectedVersion + 1;
  const now = new Date().toISOString();
  const versionId = createFileVersionId();
  const r2Key = buildR2Key({
    folderId: file.folder_id,
    fileId: file.id,
    version: nextVersion,
    safeFileName: upload.safeFileName
  });
  const before = mapFile(file);
  const after = {
    ...before,
    size: upload.size,
    mimeType: upload.mimeType,
    version: nextVersion,
    status: "uploaded",
    updatedAt: now
  };

  await putPrivateFile(bucket, r2Key, uploadedFile, upload.mimeType);

  try {
    const update = db
      .prepare(
        `UPDATE files
         SET version = ?, r2_key = ?, size = ?, mime_type = ?, status = 'uploaded', updated_at = ?
         WHERE id = ? AND version = ? AND status <> 'archived'`
      )
      .bind(nextVersion, r2Key, upload.size, upload.mimeType, now, file.id, expectedVersion);
    const insertVersion = db
      .prepare(
        `INSERT INTO file_versions (id, file_id, version, r2_key, size, created_by, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM files
           WHERE id = ? AND version = ? AND r2_key = ? AND updated_at = ? AND status = 'uploaded'
         )`
      )
      .bind(
        versionId,
        file.id,
        nextVersion,
        r2Key,
        upload.size,
        actor.id,
        now,
        file.id,
        nextVersion,
        r2Key,
        now
      );
    const audit = createConditionalAuditStatement(
      db,
      {
        userId: actor.id,
        action: "file.version.create",
        entityType: "file",
        entityId: file.id,
        before,
        after,
        createdAt: now
      },
      "EXISTS (SELECT 1 FROM files WHERE id = ? AND version = ? AND r2_key = ? AND updated_at = ? AND status = 'uploaded')",
      [file.id, nextVersion, r2Key, now]
    );
    const [result] = await db.batch([update, insertVersion, audit]);

    if (!result.meta?.changes) {
      throw new HttpError(409, "File version conflict. Please retry the upload");
    }
  } catch (error) {
    await cleanupPrivateFile(bucket, r2Key);
    throw error;
  }

  return json({ file: after }, { headers: NO_STORE_HEADERS });
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
