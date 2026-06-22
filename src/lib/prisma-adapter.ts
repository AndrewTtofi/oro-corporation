import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 no longer reads the connection URL from schema.prisma; the client
// connects through a driver adapter instead. This builds the pg adapter every
// PrismaClient in the app and worker uses. Pass an explicit connection string
// for tests (which bind to a per-worker testcontainer); otherwise it falls back
// to DATABASE_URL from the environment.
export function pgAdapter(connectionString = process.env.DATABASE_URL) {
  return new PrismaPg({ connectionString });
}
