# CLAUDE.md — coding guide for this repo

Instructions for any LLM/agent writing code here. Read this before changing
build config, dependencies, the database layer, or CI. Deeper architecture docs
live in [`docs/wiki/`](./docs/wiki/); this file is the "don't break prod" layer.

## What this is

A **white-label** fiduciary / corporate-services client-onboarding platform.
Self-hosted as a single Docker Compose stack (`proxy`, `web`, `worker`, `db`) on
one host. Each production deployment is white-labelled for **one firm**.

> **White-label rule:** do not hard-code a product/brand name in new code.
> "ORO" is the legacy name and survives only in historical/demo data (e.g.
> `*@oro.local` seed accounts). User-facing branding comes from config/DB
> (`getBranding`, theme CSS); the deploy-notification brand comes from the
> `COMPANY_NAME` repo variable.

## Stack & versions — do not silently downgrade

| Tool | Version | Why it's pinned |
|---|---|---|
| Node | **26** (CI + `node:26-alpine` runtime) | `undici@8` (via testcontainers) needs Node ≥ 22.19 — Node 20 crashes integration tests at import (`markAsUncloneable`). Never set CI Node below 26. |
| Next.js | **16** (App Router) + React 19 | `next lint` is removed; lint is the ESLint CLI. |
| Prisma | **7** with the **pg driver adapter** | Not stock Prisma — see the Prisma section. |
| TypeScript | **6** | `baseUrl` removed from web tsconfig; worker tsconfig uses `ignoreDeprecations: "6.0"`. |
| ESLint | **9** + **flat config** (`eslint.config.mjs`) | NOT ESLint 10 — `eslint-plugin-react` (pulled by `eslint-config-next`) caps its ESLint peer at `^9.7` and crashes on ESLint 10's removed `context.getFilename()`. |
| next-auth | v5 **beta** | Beta peer ranges → see `--legacy-peer-deps` below. |

## ⚠️ CI topology — the #1 trap

The `Build Docker image` CI job — the **full production build** (`npm run
worker:build` + prod `next build` + image assembly) — runs **only on push to
`main`, NOT on pull requests**. PR e2e builds `Dockerfile.dev` (`next dev` +
`tsx`), which does **not** run `worker:build` or the prod build.

**A PR can be 100% green while the production build is broken.** This has
happened: a TS6 bump fixed `tsconfig.json` but not `tsconfig.worker.json`, so
the prod `worker:build` failed → `Build Docker image` went red on `main` →
deploys were silently **skipped** (prod stuck on the old image).

When you touch **tsconfig*, build scripts, the Dockerfile(s), or dependencies**,
validate locally before merging:

```bash
npm run typecheck
npm run worker:build
npm run lint
# prod standalone build (uses build-time placeholder env, like the Dockerfile):
DATABASE_URL=postgresql://b:b@localhost:5432/b \
AUTH_SECRET=build-placeholder-xxxxxxxxxxxxxxxxxxxx \
ENCRYPTION_KEY_B64=$(openssl rand -base64 32) \
APP_URL=http://localhost NEXT_TELEMETRY_DISABLED=1 npm run build
```

After merging a build-affecting change, watch the deploy and prod health:
`gh run watch <deploy run>` and `curl http://185.106.101.11/api/health`.

## `--legacy-peer-deps` everywhere

next-auth v5 beta's peer ranges break strict npm resolution. **Every** install
path uses `--legacy-peer-deps` (CI, `Dockerfile`, `Dockerfile.dev`). Add it to
any new install command you introduce.

## Two tsconfigs

- `tsconfig.json` — the Next.js/web app. No `baseUrl` (paths resolve relative to
  the config); `*.css` side-effect imports are declared in `src/types/assets.d.ts`.
- `tsconfig.worker.json` — the cron worker. `npm run worker:build` =
  `tsc -p tsconfig.worker.json && tsc-alias` (commonjs; keeps `baseUrl` +
  `ignoreDeprecations: "6.0"` for `tsc-alias`). Runs **only** in the Dockerfile.

Changes to compiler options or the `@/*` path alias usually need **both**.

## Prisma 7 (driver adapters)

This repo runs Prisma 7 in **driver-adapter** mode — different from typical setups:

- `prisma/schema.prisma` has **no `url`** in the `datasource`. The connection URL
  lives in **`prisma.config.ts`** (used by CLI commands: `db push` / `validate` /
  `studio`) and is supplied at runtime through the **pg adapter**.
- **Every `new PrismaClient()` must pass the adapter.** Use the shared helper:
  ```ts
  import { pgAdapter } from "@/lib/prisma-adapter";
  new PrismaClient({ adapter: pgAdapter() });
  ```
  Sites: `src/lib/db.ts` (web singleton), the workers (`src/worker/*`), and the
  test harness (`src/test/db.ts`). There is **no** `datasources`/`datasourceUrl`
  option in v7.
- The `prisma-client-js` generator still emits to `node_modules/@prisma/client`,
  so imports stay `import { ... } from "@prisma/client"` (~80 sites, unchanged).
- `prisma db push` in v7 has **no `--skip-generate`** flag — do not add it. The
  client is generated separately (`npx prisma generate` in CI / the Dockerfile).
- This repo ships **no migrations**; schema sync is `prisma db push` (deploy
  script + dev compose). `prisma.config.ts` **must** be in the runtime image —
  the prod `Dockerfile` copies it. `prisma generate` works without it.

## Versioning & changelog (release-please + Conventional Commits)

Versioning is **semantic** and **automated** — there is no manual changelog gate
and you must **not hand-edit `CHANGELOG.md`** (release-please owns it).

- Write [**Conventional Commits**](https://www.conventionalcommits.org/):
  `feat:` → minor, `fix:` → patch, `feat!:` / `BREAKING CHANGE:` → major. Also
  used: `deps:`, `ci:`, `build:`, `docs:`, `perf:`, `refactor:`, `chore:`. Scope
  is encouraged (`feat(notify): …`). **The PR title must also be a Conventional
  Commit** — squash-merge uses it as the commit subject.
- `.github/workflows/release-please.yml` runs on push to `main`, reads the
  commits since the last release, and maintains a **release PR** that bumps
  `package.json` + `CHANGELOG.md`. Merging that release PR tags `vX.Y.Z` and
  cuts a GitHub release; the tag triggers CI to build a `…:vX.Y.Z` Docker image.
- Config: `release-please-config.json` (changelog sections) +
  `.release-please-manifest.json` (current version). Baseline is **v1.0.0**.
- One-time repo setting required: **Settings → Actions → General → "Allow GitHub
  Actions to create and approve pull requests."**
- The deploy notifier (`scripts/notify-deploy.mjs`) reads `package.json`'s
  version, so deploy posts show the released version.

## Deploy & white-label

- Push to `main` → CI (incl. `build-image`) → `deploy.yml` on a **self-hosted
  runner** → prod at `http://185.106.101.11` (private target `10.50.40.100`).
  Deploy is gated on full CI success — a red `build-image` skips the deploy.
- The deploy runs `prisma db push` then `ensure-super-admin`, behind a health
  gate. Super-admin + secrets come from GitHub secrets injected into the box.
- Internal Discord deploy notifications read the firm from the `COMPANY_NAME`
  repo variable (empty → neutral "the platform" wording).

## Discord deploy notifications

`scripts/notify-deploy.mjs` (+ `scripts/notify-deploy/templates.mjs`) posts to a
Discord channel after a successful deploy. It summarises **only that deploy's
commits** — the Conventional Commits between the previously-deployed commit and
this one (CHANGELOG.md is release-please-managed and only changes on releases, so
it can't drive per-deploy summaries). It prefixes the post with **inline
change-type labels** (text,
e.g. `📦 Dependencies · 🐛 Fix`) derived from each entry's heading — no Discord
forum tags / IDs / bot token required. Branding comes from the `COMPANY_NAME`
repo variable. Wording/colours/label taxonomy live in `templates.mjs`; a notify
failure never fails the deploy. Full details:
[`docs/discord-notifications.md`](./docs/discord-notifications.md).

## Conventions

- **Authorization is server-side.** `requireRole()` runs on every API route and
  Server Action; hidden UI is not security.
- **External services sit behind provider seams** in `src/lib/providers/`
  (storage, email, calendar, notifications) — swap by env, no code change.
- **Documents are PII** — AES-256-GCM at rest, served only via authenticated app
  routes, access logged to `activity_log`.
- Match the surrounding code's style, naming, and comment density. Keep
  `CHANGELOG.md` updated in the same PR.

## Test commands

| Command | What | Needs Docker |
|---|---|---|
| `npm run test:unit` | Unit tests (no DB) | no |
| `npm run test:integration` | testcontainers Postgres | yes |
| `npm run test:e2e` | Playwright, full stack | yes |
| `npm run typecheck` | `tsc --noEmit` (web) | no |
| `npm run worker:build` | worker `tsc` + `tsc-alias` | no |
| `npm run lint` | `eslint .` (flat config) | no |
| `npx prisma generate` | regenerate the client | no |

If Docker isn't available locally, integration/e2e are validated by CI (against
a real Postgres) — push to a branch and read the CI result; don't assume.
