import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PrismaClient } from "@prisma/client";
import { pgAdapter } from "@/lib/prisma-adapter";
import { execSync } from "node:child_process";

let container: StartedPostgreSqlContainer | undefined;
let prismaClient: PrismaClient | undefined;

/**
 * Boots a Postgres container once per vitest worker, runs `prisma db push` to
 * sync the schema, and returns a singleton PrismaClient bound to that container.
 * Subsequent calls within the same worker reuse the same client.
 */
export async function getTestPrisma(): Promise<PrismaClient> {
  if (prismaClient) return prismaClient;
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const url = container.getConnectionUri();
  execSync("npx prisma db push --accept-data-loss --schema=./prisma/schema.prisma", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
  prismaClient = new PrismaClient({ adapter: pgAdapter(url) });
  return prismaClient;
}

export async function stopTestPrisma() {
  await prismaClient?.$disconnect();
  await container?.stop();
  prismaClient = undefined;
  container = undefined;
}
