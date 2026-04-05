import { Resend } from "resend";

function readEnvValue(key: string) {
  const fromProcess = process.env[key];
  if (typeof fromProcess === "string" && fromProcess.trim()) return fromProcess.trim();

  const fromImportMeta = (import.meta as any)?.env?.[key];
  if (typeof fromImportMeta === "string" && fromImportMeta.trim()) return fromImportMeta.trim();

  return "";
}

export function getMailConfig() {
  const apiKey = readEnvValue("RESEND_API_KEY");
  const rawFrom = readEnvValue("EMAIL_FROM");
  const from = rawFrom && rawFrom.includes("<") ? rawFrom : rawFrom ? `Astra <${rawFrom}>` : "";

  return {
    apiKey,
    rawFrom,
    from,
    hasApiKey: Boolean(apiKey),
    hasEmailFrom: Boolean(rawFrom),
  };
}

export function createResendClient() {
  const config = getMailConfig();
  return {
    config,
    resend: config.apiKey ? new Resend(config.apiKey) : null,
  };
}
