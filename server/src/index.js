import "dotenv/config";
import { createApp } from "./app.js";

const host = "127.0.0.1";
const port = parsePort(process.env.PORT || "8787");
const app = createApp();
const server = app.listen(port, host, () => {
  console.log(`Local summarization server listening on http://${host}:${port}`);
  console.log("Private prototype: paste-only input; no LinkedIn page access.");
});

function parsePort(value) {
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

function shutdown(signal) {
  console.log(`Received ${signal}; shutting down local server.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
