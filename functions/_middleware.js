import { authenticateRequest } from "./lib/auth.js";
import { requireLibraryUser } from "./lib/authorization.js";
import { jsonError } from "./lib/http.js";

export async function onRequest(context) {
  const { pathname } = new URL(context.request.url);
  const isLibraryPage = pathname === "/files" || pathname === "/files.html";

  if (!pathname.startsWith("/api/") && !isLibraryPage) {
    return context.next();
  }

  try {
    context.data.currentUser = await authenticateRequest(context);
    if (isLibraryPage) requireLibraryUser(context);
    return await context.next();
  } catch (error) {
    return jsonError(error);
  }
}
