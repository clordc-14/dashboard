import { createId } from "./db.js";

export function createAuditStatement(db, { userId, action, entityType, entityId, before, after, createdAt }) {
  return db
    .prepare(
      `INSERT INTO audit_logs (
        id, user_id, action, entity_type, entity_id, before_json, after_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      createId("aud"),
      userId,
      action,
      entityType,
      entityId,
      before === undefined ? null : JSON.stringify(before),
      after === undefined ? null : JSON.stringify(after),
      createdAt || new Date().toISOString()
    );
}
