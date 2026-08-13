import { requireAdmin, requireJsonSameOriginRequest } from "../../../lib/authorization.js";
import { createConditionalAuditStatement } from "../../../lib/audit.js";
import { requireDb } from "../../../lib/db.js";
import { mapFile, requireFileById } from "../../../lib/files.js";
import { HttpError, methodNotAllowed, readJson } from "../../../lib/http.js";
import { deletePrivateFiles, requireFilesBucket } from "../../../lib/r2.js";

const PURGE_CONFIRMATION = "PERMANENT DELETE";

export async function onRequestPost(context) {
  requireJsonSameOriginRequest(context.request);
  const actor = requireAdmin(context);
  const db = requireDb(context.env);
  const bucket = requireFilesBucket(context.env);
  const body = await readJson(context.request);
  const file = await requireFileById(db, context.params.id);

  if (file.status !== "archived") {
    throw new HttpError(409, "Only archived files can be permanently deleted");
  }

  if (body?.confirmation !== PURGE_CONFIRMATION || body?.fileName !== file.name) {
    throw new HttpError(400, "Permanent deletion confirmation is invalid");
  }

  const versions = await db
    .prepare(
      `SELECT id, r2_key, version, size, created_by, created_at
       FROM file_versions
       WHERE file_id = ?
       ORDER BY version ASC, id ASC`
    )
    .bind(file.id)
    .all();
  const versionRows = versions.results || [];
  const now = new Date().toISOString();
  const before = mapFile(file);
  const after = {
    id: file.id,
    folderId: file.folder_id,
    name: file.name,
    status: "purged",
    versionCount: versionRows.length,
    purgedAt: now
  };

  // R2 delete is idempotent. If the following D1 batch fails, the archived row
  // remains available for a safe retry without re-exposing any object URL.
  await deletePrivateFiles(bucket, [file.r2_key, ...versionRows.map((version) => version.r2_key)]);

  const deleteVersions = db.prepare("DELETE FROM file_versions WHERE file_id = ?").bind(file.id);
  const audit = createConditionalAuditStatement(
    db,
    {
      userId: actor.id,
      action: "file.purge",
      entityType: "file",
      entityId: file.id,
      before,
      after,
      createdAt: now
    },
    "EXISTS (SELECT 1 FROM files WHERE id = ? AND status = 'archived')",
    [file.id]
  );
  const deleteFile = db
    .prepare("DELETE FROM files WHERE id = ? AND status = 'archived'")
    .bind(file.id);
  const [, , deleteFileResult] = await db.batch([deleteVersions, audit, deleteFile]);

  if (!deleteFileResult.meta?.changes) {
    throw new HttpError(409, "File purge could not be applied");
  }

  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

export function onRequest() {
  return methodNotAllowed(["POST"]);
}
