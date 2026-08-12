import { VALID_ROLES } from "./db.js";
import { HttpError } from "./http.js";

export function requireAuthenticatedUser(context) {
  const user = context.data?.currentUser;

  if (!user?.id || !user?.email || !VALID_ROLES.has(user.role)) {
    throw new HttpError(401, "Authentication is required");
  }

  return user;
}

export function requireRole(context, allowedRoles) {
  const user = requireAuthenticatedUser(context);

  if (!allowedRoles.includes(user.role)) {
    throw new HttpError(403, "You do not have permission for this action");
  }

  return user;
}

export function requireAdmin(context) {
  return requireRole(context, ["admin"]);
}

export function requireFolderManager(context) {
  return requireRole(context, ["admin", "editor"]);
}

export function requireJsonSameOriginRequest(request) {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(400, "Content-Type must be application/json");
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new HttpError(403, "Cross-origin requests are not allowed");
  }
}

export function requireKnownRole(value) {
  const role = String(value || "").trim().toLowerCase();

  if (!VALID_ROLES.has(role)) {
    throw new HttpError(400, "Role must be admin, editor, or viewer");
  }

  return role;
}
