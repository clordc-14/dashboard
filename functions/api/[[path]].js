import { HttpError, jsonError } from "../lib/http.js";

// Prevent unknown /api/* paths from falling through to the static SPA entry.
// Specific API Functions take precedence over this optional catch-all route.
export function onRequest() {
  return jsonError(new HttpError(404, "API route was not found"));
}
