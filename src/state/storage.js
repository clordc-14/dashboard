export const STORAGE_KEY = "sinopharm-new-drug-dashboard-v1";

export function saveDashboardState(state) {
  const serialized = JSON.stringify(state);
  sessionStorage.setItem(STORAGE_KEY, serialized);
}

export function loadDashboardState() {
  const serialized = sessionStorage.getItem(STORAGE_KEY);
  if (!serialized) return null;

  try {
    return JSON.parse(serialized);
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearDashboardState() {
  sessionStorage.removeItem(STORAGE_KEY);
}
