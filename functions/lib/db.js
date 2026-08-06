import { HttpError } from "./http.js";

const VALID_ROLES = new Set(["admin", "editor", "viewer"]);

export function requireDb(env) {
  if (!env.DB) {
    throw new HttpError(500, "Missing required D1 binding: DB");
  }

  return env.DB;
}

export async function findUserByEmail(db, email) {
  return db
    .prepare(
      `SELECT id, email, name, role, created_at, updated_at
       FROM users
       WHERE email = ?`
    )
    .bind(email)
    .first();
}

export async function ensureUser(db, identity, defaultRole = "viewer") {
  const email = normalizeEmail(identity.email);
  const now = new Date().toISOString();
  const existing = await findUserByEmail(db, email);

  if (existing) {
    const nextName = identity.name || existing.name;

    if (nextName !== existing.name) {
      await db
        .prepare(
          `UPDATE users
           SET name = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(nextName, now, existing.id)
        .run();
    }

    return mapUser(existing, nextName);
  }

  const id = createId("usr");
  const role = VALID_ROLES.has(defaultRole) ? defaultRole : "viewer";

  await db
    .prepare(
      `INSERT INTO users (id, email, name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, email, identity.name || null, role, now, now)
    .run();

  return {
    id,
    email,
    name: identity.name || null,
    role
  };
}

export function mapUser(row, nameOverride) {
  return {
    id: row.id,
    email: row.email,
    name: nameOverride === undefined ? row.name : nameOverride,
    role: VALID_ROLES.has(row.role) ? row.role : "viewer"
  };
}

export function normalizeEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();

  if (!normalized || !normalized.includes("@")) {
    throw new HttpError(401, "Authenticated user email is missing or invalid");
  }

  return normalized;
}

export function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}
