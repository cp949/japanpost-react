import fs from "node:fs/promises";
import path from "node:path";

const packageDir = path.resolve(import.meta.dirname, "..");
const distDir = path.join(packageDir, "dist");

await fs.mkdir(distDir, { recursive: true });
await fs.writeFile(
  path.join(distDir, "client.es.js"),
  `"use client";

export * from "./index.es.js";
`,
);
await fs.writeFile(
  path.join(distDir, "client.d.ts"),
  `export * from "./index";
`,
);
