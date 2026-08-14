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

export function canAccessLibrary(user) {
  return ["admin", "editor"].includes(user?.role);
}

export function formatRole(user) {
  return {
    admin: "管理员",
    editor: "编辑者",
    viewer: "查看者"
  }[user?.role] || "查看者";
}

function createLocalFallbackUser() {
  const isLocal = LOCAL_DEVELOPMENT_HOSTS.has(window.location.hostname);
  return {
    id: "local-browser-user",
    email: isLocal ? createLocalDevelopmentEmail() : "",
    name: isLocal ? "本地测试管理员" : "当前用户",
    role: isLocal ? "admin" : "viewer",
    source: "fallback"
  };
}

function createLocalDevelopmentEmail() {
  const host = window.location.hostname.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `local-developer-${host || "pages"}@local.invalid`;
}

function normalizeUser(user, source) {
  return {
    id: String(user.id || ""),
    email: String(user.email || "").trim().toLowerCase(),
    name: String(user.name || user.email || "当前用户").trim(),
    role: ["admin", "editor", "viewer"].includes(user.role) ? user.role : "viewer",
    source
  };
}
