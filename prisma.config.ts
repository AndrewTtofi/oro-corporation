import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 moved the connection URL out of schema.prisma and no longer
// auto-loads .env. This URL is used only by the CLI / schema-engine commands
// (`prisma db push`, `prisma validate`, `prisma studio`). The application and
// worker connect at runtime through the pg driver adapter (see src/lib/db.ts).
//
// In CI, Docker and prod, DATABASE_URL is set directly in the environment. For
// local dev we still want `.env` to work, so load it here (dependency-free)
// only when the variable isn't already provided.
const envPath = path.join(process.cwd(), ".env");
if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
    if (match) {
      process.env.DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, "");
      break;
    }
  }
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
