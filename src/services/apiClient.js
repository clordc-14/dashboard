export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function getCurrentUser() {
  return requestJson("/api/auth/me");
}

export function listUsers({ query = "", role = "", cursor = "" } = {}) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (role) params.set("role", role);
  if (cursor) params.set("cursor", cursor);
  const suffix = params.size ? `?${params.toString()}` : "";
  return requestJson(`/api/users${suffix}`);
}

export function updateUserRole(userId, role) {
  return requestJson(`/api/users/${encodeURIComponent(userId)}/role`, {
    method: "PATCH",
    body: { role }
  });
}

export function listFolders(parentId = null) {
  const suffix = parentId ? `?${new URLSearchParams({ parentId }).toString()}` : "";
  return requestJson(`/api/folders${suffix}`);
}

export function createFolder({ parentId = null, name }) {
  return requestJson("/api/folders", {
    method: "POST",
    body: { parentId, name }
  });
}

export function renameFolder(id, name) {
  return requestJson(`/api/folders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { name }
  });
}

export function deleteFolder(id) {
  return requestJson(`/api/folders/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: {}
  });
}

export function listFiles(folderId) {
  const normalizedFolderId = String(folderId || "").trim();

  if (!normalizedFolderId) {
    return Promise.reject(new ApiError(400, "请选择有效的文件夹。"));
  }

  return requestJson(`/api/files?${new URLSearchParams({ folderId: normalizedFolderId }).toString()}`);
}

export function uploadFile(folderId, file) {
  return requestFormData("/api/files/upload", { folderId, file });
}

export function getFile(id) {
  return requestJson(`/api/files/${encodeURIComponent(id)}`);
}

export function uploadFileVersion(id, file) {
  return requestFormData(`/api/files/${encodeURIComponent(id)}/version`, { file });
}

export function archiveFile(id) {
  return requestJson(`/api/files/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: {}
  });
}

async function requestJson(url, options = {}) {
  const hasBody = options.body !== undefined;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(hasBody ? { "Content-Type": "application/json" } : {})
    },
    body: hasBody ? JSON.stringify(options.body) : undefined
  });

  return readResponse(response);
}

async function requestFormData(url, fields) {
  const formData = new FormData();

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: formData
  });

  return readResponse(response);
}

async function readResponse(response) {
  if (response.status === 204) return null;

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(response.status, "服务返回了无法识别的响应。");
  }

  if (!response.ok) {
    throw new ApiError(response.status, payload?.error?.message || `请求失败（${response.status}）`, payload?.error?.details);
  }

  return payload;
}
