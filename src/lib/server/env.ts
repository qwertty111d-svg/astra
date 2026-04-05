export function readEnv(key: string, fallback = "") {
  const fromProcess = process.env[key];
  if (typeof fromProcess === "string" && fromProcess.trim()) {
    return fromProcess.trim();
  }

  const fromImportMeta = (import.meta as any)?.env?.[key];
  if (typeof fromImportMeta === "string" && fromImportMeta.trim()) {
    return fromImportMeta.trim();
  }

  return fallback;
}

export function getRequiredEnv(key: string) {
  const value = readEnv(key);
  if (!value) {
    throw new Error(`[ENV] Missing required environment variable: ${key}`);
  }
  return value;
}

export function getSiteUrl() {
  return readEnv("PUBLIC_SITE_URL") || readEnv("SITE_URL") || "https://astraboost.ru";
}
