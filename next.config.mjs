import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this project (a stray package-lock.json exists in a parent dir).
  turbopack: {
    root: __dirname,
  },
  // Don't auto-generate AGENTS.md / CLAUDE.md in the repo.
  agentRules: false,
  // Keep the edge-tts (WebSocket) lib out of the bundle so it runs as a native node module.
  serverExternalPackages: ["msedge-tts"],
};

export default nextConfig;
