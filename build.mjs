import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const result = spawnSync(
  process.execPath,
  [
    "--max-old-space-size=400",
    fileURLToPath(new URL("./node_modules/vite/bin/vite.js", import.meta.url)),
    "build",
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NITRO_PRESET: process.env.NITRO_PRESET || "node-server",
    },
  },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
