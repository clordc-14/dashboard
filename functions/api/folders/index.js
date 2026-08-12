import { requireAuthenticatedUser, requireFolderManager, requireJsonSameOriginRequest } from "../../lib/authorization.js";
import { createAuditStatement } from "../../lib/audit.js";
import { requireDb } from "../../lib/db.js";
import {
  buildBreadcrumbs,
  createFolderRow,
  mapFolder,
  normalizeFolderId,
  normalizeFolderName,
  requireFolderById
} from "../../lib/folders.js";
import { HttpError, json, methodNotAllowed, readJson } from "../../lib/http.js";

export async function onRequestGet(context) {
  requireAuthenticatedUser(context);
  const db = requireDb(context.env);
  const parentId = parseParentId(new URL(context.request.url).searchParams.get("parentId"));
  const parentFolder = parentId ? await requireFolderById(db, parentId, "Parent folder") : null;
  const result = await db
    .prepare(
      `SELECT id, parent_id, name, path, owner_id, created_at, updated_at
       FROM folders
       WHERE parent_id IS ?
       ORDER BY LOWER(name) ASC, id ASC`
    )
    .bind(parentId)
    .all();

  return json({
    currentFolder: parentFolder ? mapFolder(parentFolder) : null,
    breadcrumbs: await buildBreadcrumbs(db, parentFolder),
    folders: (result.results || []).map(mapFolder)
  });
}

export async function onRequestPost(context) {
  requireJsonSameOriginRequest(context.request);
  const actor = requireFolderManager(context);
  const db = requireDb(context.env);
  const body = await readJson(context.request);
  const name = normalizeFolderName(body?.name);
  const parentId = parseParentId(body?.parentId);
  const parentFolder = parentId ? await requireFolderById(db, parentId, "Parent folder") : null;
  const now = new Date().toISOString();
  const folder = createFolderRow({ parentFolder, name, ownerId: actor.id, now });
  const insert = db
    .prepare(
      `INSERT INTO folders (id, parent_id, name, path, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      folder.id,
      folder.parent_id,
      folder.name,
      folder.path,
      folder.owner_id,
      folder.created_at,
      folder.updated_at
    );
  const audit = createAuditStatement(db, {
    userId: actor.id,
    action: "folder.create",
    entityType: "folder",
    entityId: folder.id,
    after: mapFolder(folder),
    createdAt: now
  });

  await db.batch([insert, audit]);
  return json({ folder: mapFolder(folder) }, { status: 201 });
}

export function onRequest(context) {
  return methodNotAllowed(["GET", "POST"]);
}

function parseParentId(value) {
  if (value === undefined || value === null || value === "" || value === "null") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "Parent folder id is invalid");
  }

  return normalizeFolderId(value, "Parent folder id");
}
