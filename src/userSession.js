const LOCAL_DEVELOPMENT_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export async function loadCurrentUser() {
  try {
    const response = await fetch("/api/auth/me", {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`身份接口返回 ${response.status}`);
    const payload = await response.json();
    if (!payload?.user?.email) throw new Error("身份接口未返回用户信息");
    return normalizeUser(payload.user, "remote");
  } catch {
    return createLocalFallbackUser();
  }
}

export function isAdministrator(user) {
  return user?.role === "admin";
}

export function formatRole(user) {
  return isAdministrator(user) ? "管理员" : "用户";
}

function createLocalFallbackUser() {
  const isLocal = LOCAL_DEVELOPMENT_HOSTS.has(window.location.hostname);
  return {
    id: "local-browser-user",
    email: isLocal ? "dev@example.com" : "",
    name: isLocal ? "本地测试管理员" : "当前用户",
    role: isLocal ? "admin" : "viewer",
    source: "fallback"
  };
}

function normalizeUser(user, source) {
  return {
    id: String(user.id || ""),
    email: String(user.email || "").trim().toLowerCase(),
    name: String(user.name || user.email || "当前用户").trim(),
    role: user.role === "admin" ? "admin" : "viewer",
    source
  };
}
