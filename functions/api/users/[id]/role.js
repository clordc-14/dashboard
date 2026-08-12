import { requireAdmin, requireJsonSameOriginRequest, requireKnownRole } from "../../../lib/authorization.js";
import { createId, findUserById, mapUser, requireDb } from "../../../lib/db.js";
import { HttpError, json, methodNotAllowed, readJson } from "../../../lib/http.js";

export async function onRequestPatch(context) {
  requireJsonSameOriginRequest(context.request);
  const actor = requireAdmin(context);
  const db = requireDb(context.env);
  const userId = String(context.params.id || "").trim();
  const target = await findUserById(db, userId);

  if (!target) {
    throw new HttpError(404, "User was not found");
  }

  if (target.id === actor.id) {
    throw new HttpError(409, "You cannot change your own role");
  }

  const body = await readJson(context.request);
  const nextRole = requireKnownRole(body?.role);
  const before = mapUser(target);

  if (before.role === nextRole) {
    return json({ user: before });
  }

  const now = new Date().toISOString();
  const after = {
    ...before,
    role: nextRole,
    updatedAt: now,
    roleUpdatedAt: now,
    roleUpdatedBy: actor.id
  };
  const update = db
    .prepare(
      `UPDATE users
       SET role = ?, role_updated_at = ?, role_updated_by = ?, updated_at = ?
       WHERE id = ?
         AND role <> ?
         AND NOT (
           role = 'admin'
           AND ? <> 'admin'
           AND (SELECT COUNT(*) FROM users WHERE role = 'admin') <= 1
         )`
    )
    .bind(nextRole, now, actor.id, now, target.id, nextRole, nextRole);
  const audit = db
    .prepare(
      `INSERT INTO audit_logs (
        id, user_id, action, entity_type, entity_id, before_json, after_json, created_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM users
        WHERE id = ? AND role = ? AND role_updated_at = ? AND role_updated_by = ?
      )`
    )
    .bind(
      createId("aud"),
      actor.id,
      "user.role.update",
      "user",
      target.id,
      JSON.stringify(before),
      JSON.stringify(after),
      now,
      target.id,
      nextRole,
      now,
      actor.id
    );
  const [updateResult] = await db.batch([update, audit]);

  if (!updateResult.meta?.changes) {
    if (before.role === "admin" && nextRole !== "admin") {
      throw new HttpError(409, "The last administrator cannot be demoted");
    }

    throw new HttpError(409, "Role update could not be applied");
  }

  const updated = await findUserById(db, target.id);
  return json({ user: mapUser(updated) });
}

export function onRequest(context) {
  return methodNotAllowed(["PATCH"]);
}
