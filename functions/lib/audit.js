import { createId } from "./db.js";

export function createAuditStatement(db, { userId, action, entityType, entityId, before, after, createdAt }) {
  const values = createAuditValues({ userId, action, entityType, entityId, before, after, createdAt });

  return db
    .prepare(
      `INSERT INTO audit_logs (
        id, user_id, action, entity_type, entity_id, before_json, after_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(...values);
}

export function createConditionalAuditStatement(db, audit, conditionSql, conditionBindings = []) {
  const values = createAuditValues(audit);

  return db
    .prepare(
      `INSERT INTO audit_logs (
        id, user_id, action, entity_type, entity_id, before_json, after_json, created_at
      ) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${conditionSql}`
    )
    .bind(...values, ...conditionBindings);
}

function createAuditValues({ userId, action, entityType, entityId, before, after, createdAt }) {
  return [
    createId("aud"),
    userId,
    action,
    entityType,
    entityId,
    before === undefined ? null : JSON.stringify(before),
    after === undefined ? null : JSON.stringify(after),
    createdAt || new Date().toISOString()
  ];
}
