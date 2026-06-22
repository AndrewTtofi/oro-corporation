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
     DEPLOY_COMPANY           White-label firm name shown in the message
                              (optional; empty → neutral "platform" wording)
     PREV_DEPLOY_SHA          Previous deploy's commit; posts only the
                              CHANGELOG delta since it (optional)
     SITE_URL                 Link to the live site           (default prod IP)
     DEPLOY_ACTOR             Who triggered the deploy        (optional)
     DEPLOY_RUN_URL           Link to the CI run              (optional)
     DEPLOY_SHA               Deployed commit SHA             (optional)
   ===================================================================== */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CATEGORY_TO_GROUP, classifyTag, classifyCommit, commitDescription, TAG_TO_GROUP, tagLabels, deploySuccessEmbed, deployFailedEmbed } from "./notify-deploy/templates.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FAILED = args.includes("--failed");

const SITE_URL = process.env.SITE_URL || "http://185.106.101.11";
// White-label: the firm/company this deployment is branded for. Empty → neutral
// "platform" wording. Set via the COMPANY_NAME repo variable in notify.yml.
const COMPANY = (process.env.DEPLOY_COMPANY || "").trim();
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

/* ── turn a block of changelog lines into friendly groups + present tags ─ */
function parseSectionLines(section) {
  const groups = { new: [], improved: [], fixed: [] };
  const tagKeys = new Set();          // forum-tag keys present in this block
  let internalCount = 0;

  let curGroup = null;          // friendly display group for the current ### subsection
  let curTitle = null;          // the "— Title" of the current subsection, if any
  let curBullets = [];          // bullets collected under the current subsection
  let curMapped = false;        // was the current ### category recognised for display?

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
      tagKeys.add(classifyTag(heading));    // tags are finer-grained than display groups
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
  return { groups, internalCount, tagKeys };
}

/* ── the most recent CHANGELOG section (## Unreleased) ─────────────────── */
function parseChangelogFull() {
  let text = "";
  try { text = readFileSync(join(root, "CHANGELOG.md"), "utf8"); } catch { return parseSectionLines([]); }
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^##\s+/.test(l));
  if (start === -1) return parseSectionLines([]);
  let end = lines.findIndex((l, i) => i > start && /^##\s+/.test(l));
  if (end === -1) end = lines.length;
  return parseSectionLines(lines.slice(start + 1, end));
}

/* ── ONLY this deploy's changes, derived from the COMMITS in the range ───
   This is the primary source: each deploy summarises the Conventional Commits
   between the previously-deployed commit and this one. (CHANGELOG.md is owned
   by release-please and only changes on releases, so it can't drive per-deploy
   summaries.) Returns null when the range yields no commits. */
function parseCommitsDelta(prevSha, headSha) {
  if (!prevSha || !headSha) return null;
  let raw = "";
  try {
    raw = execSync(
      `git log ${prevSha}..${headSha} --no-merges --pretty=format:%s`,
      { cwd: root, stdio: ["ignore", "pipe", "ignore"] }
    ).toString();
  } catch { return null; }
  const subjects = raw.split("\n").map((s) => s.trim()).filter(Boolean);
  if (!subjects.length) return null;

  const groups = { new: [], improved: [], fixed: [] };
  const tagKeys = new Set();
  let internalCount = 0;
  for (const subj of subjects) {
    const tag = classifyCommit(subj);
    tagKeys.add(tag);
    const group = TAG_TO_GROUP[tag];
    const desc = clean(commitDescription(subj));
    if (group && desc) groups[group].push(desc);
    else internalCount += 1;
  }
  // de-dupe while preserving order
  for (const k of Object.keys(groups)) {
    const seen = new Set();
    groups[k] = groups[k].filter((x) => x && !seen.has(x) && seen.add(x));
  }
  return { groups, internalCount, tagKeys };
}

/* ── ONLY this deploy's CHANGELOG additions (delta since the last deploy) ─
   Diffs CHANGELOG.md between the previously-deployed commit and this one and
   parses just the added (`+`) lines, so each post shows only what that deploy
   shipped. Returns null when the range is unknown/empty so the caller can fall
   back to the full section. */
function parseChangelogDelta(prevSha, headSha) {
  if (!prevSha || !headSha) return null;
  let diff = "";
  try {
    diff = execSync(
      `git diff ${prevSha}..${headSha} -- CHANGELOG.md`,
      { cwd: root, stdio: ["ignore", "pipe", "ignore"] }
    ).toString();
  } catch { return null; }
  const added = diff
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1));
  // Need at least one recognisable heading or bullet to trust the delta.
  if (!added.some((l) => /^###\s+/.test(l) || /^\s*[-*]\s+/.test(l))) return null;
  return parseSectionLines(added);
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
  const common = { company: COMPANY, actor: process.env.DEPLOY_ACTOR || "", runUrl: process.env.DEPLOY_RUN_URL || "", shortSha };
  const who = COMPANY || "Platform";

  let payload, threadName;
  if (FAILED) {
    payload = deployFailedEmbed(common);
    threadName = `${who} deploy failed · ${shortSha || version}`;
  } else {
    // Summarise THIS deploy from its commits (primary). Fall back to the
    // CHANGELOG delta, then the latest changelog section, if there are no
    // commits in range (e.g. the very first run).
    const prev = process.env.PREV_DEPLOY_SHA;
    const head = process.env.DEPLOY_SHA || shortSha;
    const { groups, internalCount, tagKeys } =
      parseCommitsDelta(prev, head) ?? parseChangelogDelta(prev, head) ?? parseChangelogFull();
    // Fallback: if nothing parsed at all, use the latest commit subject.
    if (!groups.new.length && !groups.improved.length && !groups.fixed.length && internalCount === 0) {
      try { groups.improved.push(clean(execSync("git log -1 --pretty=%s", { cwd: root }).toString())); } catch { /* noop */ }
    }
    // Inline change-type labels for this deploy (e.g. "📦 Dependencies · 🐛 Fix").
    const labels = tagLabels(tagKeys);
    payload = deploySuccessEmbed({ ...common, labels, groups, internalCount, version, siteUrl: SITE_URL, when: new Date().toISOString() });
    threadName = `${who} update · ${shortSha || version}`;
  }

  // Forum channels require a thread_name (each deploy becomes its own post).
  payload.thread_name = threadName.slice(0, 100);
  if (process.env.DEPLOY_NOTE) payload.content = process.env.DEPLOY_NOTE;
  await post(payload);
}

// A notification problem must never fail the deploy pipeline.
main().catch((e) => { console.log("[notify-deploy] error (ignored):", e?.message || e); process.exit(0); });
