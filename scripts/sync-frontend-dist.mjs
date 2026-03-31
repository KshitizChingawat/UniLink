import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const frontendDist = path.join(repoRoot, "frontend", "dist");
const rootDist = path.join(repoRoot, "dist");

if (!existsSync(frontendDist)) {
  throw new Error(`Frontend dist folder not found at ${frontendDist}`);
}

if (existsSync(rootDist)) {
  rmSync(rootDist, { recursive: true, force: true });
}

mkdirSync(rootDist, { recursive: true });
cpSync(frontendDist, rootDist, { recursive: true });

console.log(`Synced frontend build from ${frontendDist} to ${rootDist}`);
