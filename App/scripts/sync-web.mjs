import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appRoot = path.resolve(__dirname, "..");
const srcDist = path.resolve(appRoot, "..", "frontend", "dist");
const destWww = path.resolve(appRoot, "www");

function rmSafe(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

if (!fs.existsSync(srcDist)) {
  console.error(`[sync-web] Missing frontend build output at: ${srcDist}`);
  process.exit(1);
}

rmSafe(destWww);
copyDir(srcDist, destWww);
console.log(`[sync-web] Copied ${srcDist} -> ${destWww}`);

