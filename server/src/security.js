const CHROME_EXTENSION_ORIGIN = /^chrome-extension:\/\/([a-p]{32})$/;

export function isAllowedExtensionOrigin(origin, expectedExtensionId = "") {
  if (typeof origin !== "string") return false;
  const match = CHROME_EXTENSION_ORIGIN.exec(origin);
  if (!match) return false;
  return !expectedExtensionId || match[1] === expectedExtensionId;
}

export function parseExtensionId(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return "";
  if (!/^[a-p]{32}$/.test(trimmed)) throw new Error("EXTENSION_ID must be a 32-character Chrome extension ID (a–p). ");
  return trimmed;
}
