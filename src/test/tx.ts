import type { PrismaClient } from "@prisma/client";

class RollbackSignal extends Error { constructor() { super("__rollback__"); } }

/**
 * Runs `fn` inside a Prisma transaction that is always rolled back at the end,
 * leaving the DB clean for the next test. Returns whatever fn returns.
 */
export async function inRollbackTx<T>(prisma: PrismaClient, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  let result!: T;
  await prisma.$transaction(async (tx) => {
    result = await fn(tx as unknown as PrismaClient);
    throw new RollbackSignal();
  }).catch((e) => { if (!(e instanceof RollbackSignal)) throw e; });
  return result;
}

/**
 * Wrap a tx client so nested `prisma.$transaction(cb)` calls inside services
 * pass through to the same tx (Prisma's interactive-transaction client doesn't
 * expose $transaction). Use this when injecting `tx` as the route's `prisma`
 * and the route calls a service that wraps its writes in $transaction.
 */
export function wrapTx(tx: PrismaClient): PrismaClient {
  return new Proxy(tx, {
    get(target, prop) {
      if (prop === "$transaction") {
        return (fn: (tx: PrismaClient) => Promise<unknown>) => fn(wrapTx(tx));
      }
      const val = (target as Record<string | symbol, unknown>)[prop];
      if (typeof val === "function") return val.bind(target);
      return val;
    },
  }) as PrismaClient;
}
