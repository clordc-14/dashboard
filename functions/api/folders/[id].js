import { requireAdmin, requireFolderManager, requireJsonSameOriginRequest } from "../../lib/authorization.js";
import { createAuditStatement } from "../../lib/audit.js";
import { requireDb } from "../../lib/db.js";
import { mapFolder, normalizeFolderName, requireFolderById } from "../../lib/folders.js";
import { HttpError, json, methodNotAllowed, readJson } from "../../lib/http.js";

export async function onRequestPatch(context) {
  requireJsonSameOriginRequest(context.request);
  const actor = requireFolderManager(context);
  const db = requireDb(context.env);
  const folder = await requireFolderById(db, context.params.id);
  const body = await readJson(context.request);
  const name = normalizeFolderName(body?.name);
  const before = mapFolder(folder);

  if (before.name === name) {
    return json({ folder: before });
  }

  const now = new Date().toISOString();
  const after = { ...before, name, updatedAt: now };
  const update = db
    .prepare("UPDATE folders SET name = ?, updated_at = ? WHERE id = ?")
    .bind(name, now, folder.id);
  const audit = createAuditStatement(db, {
    userId: actor.id,
    action: "folder.rename",
    entityType: "folder",
    entityId: folder.id,
    before,
    after,
    createdAt: now
  });

  await db.batch([update, audit]);
  return json({ folder: after });
}

export async function onRequestDelete(context) {
  requireJsonSameOriginRequest(context.request);
  const actor = requireAdmin(context);
  const db = requireDb(context.env);
  const folder = await requireFolderById(db, context.params.id);
  const child = await db.prepare("SELECT id FROM folders WHERE parent_id = ? LIMIT 1").bind(folder.id).first();

  if (child) {
    throw new HttpError(409, "Folders with child folders cannot be deleted");
  }

  const file = await db.prepare("SELECT id FROM files WHERE folder_id = ? LIMIT 1").bind(folder.id).first();
  if (file) {
    throw new HttpError(409, "Folders with file metadata cannot be deleted");
  }

  const now = new Date().toISOString();
  const before = mapFolder(folder);
  const remove = db.prepare("DELETE FROM folders WHERE id = ?").bind(folder.id);
  const audit = createAuditStatement(db, {
    userId: actor.id,
    action: "folder.delete",
    entityType: "folder",
    entityId: folder.id,
    before,
    createdAt: now
  });

  await db.batch([remove, audit]);
  return new Response(null, { status: 204 });
}

export function onRequest(context) {
  return methodNotAllowed(["PATCH", "DELETE"]);
}
