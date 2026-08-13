import { requireAuthenticatedUser } from "../../lib/authorization.js";
import { requireDb } from "../../lib/db.js";
import { mapFile } from "../../lib/files.js";
import { requireFolderById } from "../../lib/folders.js";
import { HttpError, json, methodNotAllowed } from "../../lib/http.js";

const NO_STORE_HEADERS = { "cache-control": "no-store" };

export async function onRequestGet(context) {
  requireAuthenticatedUser(context);
  const db = requireDb(context.env);
  const folderId = new URL(context.request.url).searchParams.get("folderId");

  if (!folderId) {
    throw new HttpError(400, "Folder id is required");
  }

  const folder = await requireFolderById(db, folderId);
  const result = await db
    .prepare(
      `SELECT id, folder_id, name, ext, mime_type, size, version, status, created_at, updated_at
       FROM files
       WHERE folder_id = ? AND status <> 'archived'
       ORDER BY updated_at DESC, id DESC`
    )
    .bind(folder.id)
    .all();

  return json({ files: (result.results || []).map(mapFile) }, { headers: NO_STORE_HEADERS });
}

export function onRequest() {
  return methodNotAllowed(["GET"]);
}
