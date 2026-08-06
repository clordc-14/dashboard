import { authenticateRequest } from "./lib/auth.js";
import { jsonError } from "./lib/http.js";

export async function onRequest(context) {
  const { pathname } = new URL(context.request.url);

  if (!pathname.startsWith("/api/")) {
    return context.next();
  }

  try {
    context.data.currentUser = await authenticateRequest(context);
    return await context.next();
  } catch (error) {
    return jsonError(error);
  }
}
