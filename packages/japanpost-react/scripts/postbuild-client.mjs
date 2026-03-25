import fs from "node:fs/promises";
import path from "node:path";

const packageDir = path.resolve(import.meta.dirname, "..");
const clientEntryPath = path.join(packageDir, "dist", "client.es.js");
const useClientDirective = '"use client";\n';

const clientEntrySource = await fs.readFile(clientEntryPath, "utf8");

if (!clientEntrySource.startsWith(useClientDirective)) {
  await fs.writeFile(
    clientEntryPath,
    `${useClientDirective}${clientEntrySource}`,
    "utf8",
  );
}
