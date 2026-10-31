import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectDir = resolve(serverDir, "..");
const extensionDir = join(projectDir, "extension");
const manifest = JSON.parse(readFileSync(join(extensionDir, "manifest.json"), "utf8"));
const outputDir = join(projectDir, "dist");
const tempDir = join(outputDir, "extension-package");
const zipPath = join(outputDir, `linkedin-tldr-v${manifest.version}-chrome-store.zip`);

if (manifest.manifest_version !== 3) throw new Error("Chrome Web Store packages must use Manifest V3.");
if (!existsSync(join(extensionDir, "icons", "icon128.png"))) throw new Error("Missing 128x128 extension icon.");
if (manifest.permissions.some((permission) => ["tabs", "scripting", "activeTab"].includes(permission))) {
  throw new Error("Unexpected broad page-access permission. Review before packaging.");
}
if (manifest.host_permissions.some((permission) => permission.includes("linkedin.com") || permission === "<all_urls>")) {
  throw new Error("This project is paste-only. Remove LinkedIn or broad host permissions before packaging.");
}

mkdirSync(outputDir, { recursive: true });
rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });
cpSync(extensionDir, tempDir, { recursive: true });
rmSync(zipPath, { force: true });
try {
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: tempDir, stdio: "inherit" });
} catch (error) {
  throw new Error("Could not create the extension ZIP. Install the system 'zip' utility and retry.", { cause: error });
}
writeFileSync(join(outputDir, "RELEASE-INFO.txt"), [
  `LinkedIn TL;DR extension package v${manifest.version}`,
  "",
  `Package: dist/${zipPath.split("/").pop()}`,
  "Manifest: Manifest V3",
  "Permissions: storage; http://127.0.0.1:8787/*",
  "LinkedIn page access: none",
  "",
  "Important: the extension requires its companion local Node.js server and at least one provider API key configured in the local backend. Provider keys never ship with the extension.",
  "This is a developer/reviewer candidate, not a one-click consumer release.",
  "Before public publication, host the privacy policy and support page, add real extension screenshots,",
  "finalize developer contact details, and confirm the Chrome Web Store review/testing experience."
].join("\n") + "\n");
rmSync(tempDir, { recursive: true, force: true });
console.log(`Created ${zipPath}`);
