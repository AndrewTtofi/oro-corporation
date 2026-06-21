#!/usr/bin/env node
/* =====================================================================
   Discord deploy notification.
   Reads the latest CHANGELOG.md section, turns it into a plain-language
   summary, and posts it to a Discord webhook. Meant to run from a GitHub
   Actions workflow AFTER a successful deploy.

   Usage:
     node scripts/notify-deploy.mjs            # post the deploy summary
     node scripts/notify-deploy.mjs --dry-run  # print the payload, don't post
     node scripts/notify-deploy.mjs --failed   # post the "deploy failed" message

   Env:
     DISCORD_DEPLOY_WEBHOOK   Discord webhook URL (required to actually post)
     DEPLOY_BRAND_NAME        Brand shown in the message      (default "ORO")
     SITE_URL                 Link to the live site           (default prod IP)
     DEPLOY_ACTOR             Who triggered the deploy        (optional)
     DEPLOY_RUN_URL           Link to the CI run              (optional)
     DEPLOY_SHA               Deployed commit SHA             (optional)
   ===================================================================== */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CATEGORY_TO_GROUP, deploySuccessEmbed, deployFailedEmbed } from "./notify-deploy/templates.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FAILED = args.includes("--failed");

const BRAND = process.env.DEPLOY_BRAND_NAME || "ORO";
const SITE_URL = process.env.SITE_URL || "http://185.106.101.11";
const WEBHOOK = process.env.DISCORD_DEPLOY_WEBHOOK || "";

/* ── markdown cleanup so non-engineers get clean prose ───────────────── */
function clean(s) {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")              // [text](url) -> text
    .replace(/[`*_]/g, "")                                 // code / bold / italic markers
    .replace(/^\s*[-*]\s+/, "")                            // leading bullet
    .replace(/\s*\((?:PR\s*)?#\d+[^)]*\)\s*$/i, "")        // (PR #4), (#123), (PR #3, branch …)
    .replace(/\s*\(branch[^)]*\)\s*$/i, "")                // (branch feature/…)
    .replace(/\s+/g, " ")
    .trim();
}

/* ── read the most recent CHANGELOG section into friendly groups ──────── */
function parseChangelog() {
  const groups = { new: [], improved: [], fixed: [] };
  let internalCount = 0;
  let text = "";
  try {
    text = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  } catch {
    return { groups, internalCount };
  }

  const lines = text.split("\n");
  // Grab everything from the first "## " heading to the next "## " heading.
  const start = lines.findIndex((l) => /^##\s+/.test(l));
  if (start === -1) return { groups, internalCount };
  let end = lines.findIndex((l, i) => i > start && /^##\s+/.test(l));
  if (end === -1) end = lines.length;
  const section = lines.slice(start + 1, end);

  let curGroup = null;          // friendly group for the current ### subsection
  let curTitle = null;          // the "— Title" of the current subsection, if any
  let curBullets = [];          // bullets collected under the current subsection
  let curMapped = false;        // was the current ### category recognised?

  const flush = () => {
    if (!curMapped) {
      // Unrecognised section (chore/docs/tests/concerns) → count, don't list.
      internalCount += curBullets.length || (curTitle ? 1 : 0);
    } else if (curTitle) {
      groups[curGroup].push(clean(curTitle));
    } else {
      for (const b of curBullets) groups[curGroup].push(clean(b));
    }
    curTitle = null; curBullets = []; curMapped = false; curGroup = null;
  };

  for (const raw of section) {
    const h3 = raw.match(/^###\s+(.+)$/);
    if (h3) {
      flush();
      const heading = h3[1].trim();
      const [catPart, ...titleParts] = heading.split(/\s+[—–-]\s+/); // split on em/en/hyphen dash
      const cat = catPart.trim().toLowerCase().split(/\s+/)[0];
      curGroup = CATEGORY_TO_GROUP[cat] ?? null;
      curMapped = !!curGroup;
      curTitle = titleParts.length ? titleParts.join(" - ").trim() : null;
      continue;
    }
    if (/^\s*[-*]\s+/.test(raw)) curBullets.push(raw);
  }
  flush();

  // de-dupe while preserving order
  for (const k of Object.keys(groups)) {
    const seen = new Set();
    groups[k] = groups[k].filter((x) => x && !seen.has(x) && seen.add(x));
  }
  return { groups, internalCount };
}

function gitShort() {
  if (process.env.DEPLOY_SHA) return process.env.DEPLOY_SHA.slice(0, 7);
  try { return execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim(); } catch { return ""; }
}
function pkgVersion() {
  try { return "v" + JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version; } catch { return ""; }
}

async function post(payload) {
  if (DRY_RUN) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  if (!WEBHOOK) {
    console.log("[notify-deploy] DISCORD_DEPLOY_WEBHOOK not set — skipping post.");
    return;
  }
  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.log(`[notify-deploy] Discord responded ${res.status}: ${await res.text().catch(() => "")}`);
  else console.log("[notify-deploy] posted to Discord.");
}

async function main() {
  const shortSha = gitShort();
  const version = pkgVersion();
  const common = { brand: BRAND, actor: process.env.DEPLOY_ACTOR || "", runUrl: process.env.DEPLOY_RUN_URL || "", shortSha };

  let payload, threadName;
  if (FAILED) {
    payload = deployFailedEmbed(common);
    threadName = `${BRAND} deploy failed · ${shortSha || version}`;
  } else {
    const { groups, internalCount } = parseChangelog();
    // Fallback: if the changelog yielded nothing, use the latest commit subject.
    if (!groups.new.length && !groups.improved.length && !groups.fixed.length && internalCount === 0) {
      try { groups.improved.push(clean(execSync("git log -1 --pretty=%s", { cwd: root }).toString())); } catch { /* noop */ }
    }
    payload = deploySuccessEmbed({ ...common, groups, internalCount, version, siteUrl: SITE_URL, when: new Date().toISOString() });
    threadName = `${BRAND} update · ${shortSha || version}`;
  }

  // Forum channels require a thread_name (each deploy becomes its own post).
  payload.thread_name = threadName.slice(0, 100);
  if (process.env.DEPLOY_NOTE) payload.content = process.env.DEPLOY_NOTE;
  // Optional: auto-apply forum tags by ID (comma-separated) once they exist.
  const tagIds = (process.env.DEPLOY_TAG_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (tagIds.length) payload.applied_tags = tagIds;
  await post(payload);
}

// A notification problem must never fail the deploy pipeline.
main().catch((e) => { console.log("[notify-deploy] error (ignored):", e?.message || e); process.exit(0); });
