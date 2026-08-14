import { requireAdmin, requireLibraryUser } from "../../lib/authorization.js";
import { requireDb } from "../../lib/db.js";
import { mapFile } from "../../lib/files.js";
import { requireFolderById } from "../../lib/folders.js";
import { HttpError, json, methodNotAllowed } from "../../lib/http.js";

const NO_STORE_HEADERS = { "cache-control": "no-store" };

export async function onRequestGet(context) {
  requireLibraryUser(context);
  const db = requireDb(context.env);
  const url = new URL(context.request.url);
  const folderId = url.searchParams.get("folderId");
  const status = parseStatus(url.searchParams.get("status"));

  if (!folderId) {
    throw new HttpError(400, "Folder id is required");
  }

  const isArchived = status === "archived";

  if (isArchived) {
    requireAdmin(context);
  }

  const folder = await requireFolderById(db, folderId);
  const result = await db
    .prepare(
      `SELECT id, folder_id, name, ext, mime_type, size, version, status, created_at, updated_at
       FROM files
       WHERE folder_id = ? AND ${isArchived ? "status = 'archived'" : "status <> 'archived'"}
       ORDER BY updated_at DESC, id DESC`
    )
    .bind(folder.id)
    .all();

  return json({ files: (result.results || []).map(mapFile) }, { headers: NO_STORE_HEADERS });
}

export function onRequest() {
  return methodNotAllowed(["GET"]);
}

function parseStatus(value) {
  if (!value) return null;
  if (value === "archived") return "archived";
  throw new HttpError(400, "File status filter is invalid");
}
