import { createId } from "./db.js";
import { HttpError } from "./http.js";

const MAX_FOLDER_NAME_LENGTH = 120;
const MAX_FOLDER_ID_LENGTH = 96;

export function normalizeFolderId(value, label = "Folder id") {
  const id = String(value || "").trim();

  if (!id || id.length > MAX_FOLDER_ID_LENGTH || !/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new HttpError(400, `${label} is invalid`);
  }

  return id;
}

export function normalizeFolderName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ");

  if (!name) {
    throw new HttpError(400, "Folder name is required");
  }

  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    throw new HttpError(400, `Folder name must be ${MAX_FOLDER_NAME_LENGTH} characters or fewer`);
  }

  if (/\p{Cc}/u.test(name)) {
    throw new HttpError(400, "Folder name contains unsupported control characters");
  }

  return name;
}

export async function findFolderById(db, id) {
  return db
    .prepare(
      `SELECT id, parent_id, name, path, owner_id, created_at, updated_at
       FROM folders
       WHERE id = ?`
    )
    .bind(id)
    .first();
}

export async function requireFolderById(db, id, label = "Folder") {
  const folder = await findFolderById(db, normalizeFolderId(id));

  if (!folder) {
    throw new HttpError(404, `${label} was not found`);
  }

  return folder;
}

export function mapFolder(row) {
  return {
    id: row.id,
    parentId: row.parent_id || null,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function buildBreadcrumbs(db, currentFolder) {
  const breadcrumbs = [{ id: null, name: "根目录" }];
  const ancestors = [];
  let cursor = currentFolder;
  let guard = 0;

  while (cursor) {
    if (guard > 100) {
      throw new HttpError(500, "Folder hierarchy is invalid");
    }

    ancestors.push({ id: cursor.id, name: cursor.name });
    cursor = cursor.parent_id ? await findFolderById(db, cursor.parent_id) : null;
    guard += 1;
  }

  return breadcrumbs.concat(ancestors.reverse());
}

export function createFolderRow({ id = createId("fld"), parentFolder, name, ownerId, now }) {
  return {
    id,
    parent_id: parentFolder?.id || null,
    name,
    path: parentFolder ? `${parentFolder.path}/${id}` : `/${id}`,
    owner_id: ownerId,
    created_at: now,
    updated_at: now
  };
}
