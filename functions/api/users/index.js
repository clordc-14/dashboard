import { requireAdmin } from "../../lib/authorization.js";
import { mapUser, requireDb } from "../../lib/db.js";
import { HttpError, json, methodNotAllowed } from "../../lib/http.js";

const PAGE_SIZE = 50;

export async function onRequestGet(context) {
  requireAdmin(context);
  const db = requireDb(context.env);
  const url = new URL(context.request.url);
  const query = String(url.searchParams.get("query") || "").trim();
  const role = String(url.searchParams.get("role") || "").trim().toLowerCase();
  const cursor = decodeCursor(url.searchParams.get("cursor"));

  if (query.length > 120) {
    throw new HttpError(400, "Search query must be 120 characters or fewer");
  }

  if (role && !["admin", "editor", "viewer"].includes(role)) {
    throw new HttpError(400, "Role filter must be admin, editor, or viewer");
  }

  const clauses = [];
  const values = [];

  if (query) {
    const escaped = query.toLowerCase().replace(/[\\%_]/g, "\\$&");
    clauses.push("(LOWER(email) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(name, '')) LIKE ? ESCAPE '\\')");
    values.push(`%${escaped}%`, `%${escaped}%`);
  }

  if (role) {
    clauses.push("role = ?");
    values.push(role);
  }

  if (cursor) {
    clauses.push("(LOWER(email) > ? OR (LOWER(email) = ? AND id > ?))");
    values.push(cursor.email, cursor.email, cursor.id);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const statement = db
    .prepare(
      `SELECT id, email, name, role, created_at, updated_at, role_updated_at, role_updated_by
       FROM users
       ${where}
       ORDER BY LOWER(email) ASC, id ASC
       LIMIT ?`
    )
    .bind(...values, PAGE_SIZE + 1);
  const result = await statement.all();
  const rows = result.results || [];
  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);
  const lastRow = page.at(-1);

  return json({
    users: page.map((row) => mapUser(row)),
    nextCursor: hasMore && lastRow ? encodeCursor(lastRow) : null
  });
}

export function onRequest(context) {
  return methodNotAllowed(["GET"]);
}

function encodeCursor(row) {
  const bytes = new TextEncoder().encode(JSON.stringify({ email: String(row.email).toLowerCase(), id: row.id }));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeCursor(value) {
  if (!value) return null;

  try {
    const normalized = String(value).replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const cursor = JSON.parse(new TextDecoder().decode(bytes));

    if (!cursor?.email || !cursor?.id || typeof cursor.email !== "string" || typeof cursor.id !== "string") {
      throw new Error("Invalid cursor");
    }

    return { email: cursor.email.toLowerCase(), id: cursor.id };
  } catch {
    throw new HttpError(400, "Cursor is invalid");
  }
}
