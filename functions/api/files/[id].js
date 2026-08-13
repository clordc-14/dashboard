import { requireAdmin, requireAuthenticatedUser, requireSameOriginRequest } from "../../lib/authorization.js";
import { createConditionalAuditStatement } from "../../lib/audit.js";
import { requireDb } from "../../lib/db.js";
import { mapFile, mapFileVersion, requireFileById } from "../../lib/files.js";
import { HttpError, json, methodNotAllowed } from "../../lib/http.js";

const NO_STORE_HEADERS = { "cache-control": "no-store" };

export async function onRequestGet(context) {
  const actor = requireAuthenticatedUser(context);
  const db = requireDb(context.env);
  const file = await requireFileById(db, context.params.id);

  if (file.status === "archived" && actor.role !== "admin") {
    throw new HttpError(404, "File was not found");
  }
  const versions = await db
    .prepare(
      `SELECT id, version, size, created_by, created_at
       FROM file_versions
       WHERE file_id = ?
       ORDER BY version ASC, id ASC`
    )
    .bind(file.id)
    .all();

  return json(
    { file: mapFile(file), versions: (versions.results || []).map(mapFileVersion) },
    { headers: NO_STORE_HEADERS }
  );
}

export async function onRequestDelete(context) {
  requireSameOriginRequest(context.request);
  const actor = requireAdmin(context);
  const db = requireDb(context.env);
  const file = await requireFileById(db, context.params.id);

  if (file.status === "archived") {
    throw new HttpError(409, "File is already archived");
  }

  const now = new Date().toISOString();
  const before = mapFile(file);
  const after = { ...before, status: "archived", updatedAt: now };
  const update = db
    .prepare(
      `UPDATE files
       SET status = 'archived', updated_at = ?
       WHERE id = ? AND status <> 'archived'`
    )
    .bind(now, file.id);
  const audit = createConditionalAuditStatement(
    db,
    {
      userId: actor.id,
      action: "file.archive",
      entityType: "file",
      entityId: file.id,
      before,
      after,
      createdAt: now
    },
    "EXISTS (SELECT 1 FROM files WHERE id = ? AND status = 'archived' AND updated_at = ?)",
    [file.id, now]
  );
  const [result] = await db.batch([update, audit]);

  if (!result.meta?.changes) {
    throw new HttpError(409, "File archive could not be applied");
  }

  return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
}

export function onRequest() {
  return methodNotAllowed(["GET", "DELETE"]);
}
