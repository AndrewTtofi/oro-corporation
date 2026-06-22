/* =====================================================================
   Discord deploy-notification templates.
   Edit the wording / emojis / colours here — no code logic to touch.
   The message is written for a non-engineer reading it in Discord.
   ===================================================================== */

export const BRAND_COLOR = 0x2e4a8b; // indigo, matches the app

// How raw changelog/commit categories map to friendly, plain-language groups.
// Anything not matched here is treated as "behind the scenes" and only counted.
export const GROUPS = {
  new:      { key: "new",      label: "New",          emoji: "✨" },
  improved: { key: "improved", label: "Improvements", emoji: "🛠️" },
  fixed:    { key: "fixed",    label: "Fixes",        emoji: "🐛" },
};

// Changelog "### Added — …" / commit "feat:" → which friendly group.
export const CATEGORY_TO_GROUP = {
  added: "new", feature: "new", feat: "new", new: "new",
  changed: "improved", improved: "improved", improvement: "improved",
  perf: "improved", performance: "improved", refactor: "improved",
  ui: "improved", ux: "improved", design: "improved", style: "improved",
  fixed: "fixed", fix: "fixed", bugfix: "fixed", hotfix: "fixed",
  removed: "improved", deprecated: "improved",
  // these are intentionally NOT mapped (counted as "behind the scenes"):
  // chore, docs, test, ci, build, deps, security-internal
};

const MAX_ITEMS_PER_GROUP = 6;

/* ── Change-type labels ───────────────────────────────────────────────
   Each deploy is labelled (inline, as text in the post) with the change-types
   it contains. These are plain text — no Discord setup, no tag IDs, no bot.
   Edit the wording/emoji here. Order below = display order in the label line. */
export const TAGS = {
  new:      { key: "new",      label: "✨ New" },
  improved: { key: "improved", label: "🛠️ Improvement" },
  fixed:    { key: "fixed",    label: "🐛 Fix" },
  deps:     { key: "deps",     label: "📦 Dependencies" },
  security: { key: "security", label: "🔒 Security" },
  internal: { key: "internal", label: "🔧 Internal" },
};

/** Classify a changelog `###` heading into a single change-type key.
    Keyword-first (handles "Changed — Bump …" → deps, "Fixed — …" → fix),
    then falls back to the leading category word. */
export function classifyTag(heading) {
  const h = (heading || "").toLowerCase();
  if (/\b(security|vuln|cve|xss|csrf|injection)\b/.test(h)) return "security";
  if (/\b(bump|upgrade|upgraded|dependenc\w*|deps|lockfile)\b/.test(h)) return "deps";
  if (/\b(fix|fixed|bug|bugfix|hotfix|regression)\b/.test(h)) return "fixed";
  const cat = h.split(/\s+[—–-]\s+/)[0].trim().split(/\s+/)[0];
  if (["added", "feature", "feat", "new"].includes(cat)) return "new";
  if (["chore", "docs", "doc", "test", "tests", "ci", "build", "tooling"].includes(cat)) return "internal";
  if (["fixed", "fix", "bugfix", "hotfix"].includes(cat)) return "fixed";
  // changed / improved / perf / refactor / ui / removed / deprecated / …
  return "improved";
}

/** Turn the set of present change-type keys into ordered label strings. */
export function tagLabels(tagKeys) {
  const present = tagKeys instanceof Set ? tagKeys : new Set(tagKeys || []);
  return Object.keys(TAGS).filter((k) => present.has(k)).map((k) => TAGS[k].label);
}

/** Build the Discord payload for a successful deploy. */
export function deploySuccessEmbed({ company, labels, groups, internalCount, version, shortSha, actor, siteUrl, runUrl, when }) {
  // White-label: when a company name is configured, the post is branded for
  // that firm; otherwise it uses neutral platform wording.
  const who = (company || "").trim();
  // Inline change-type labels (what this deploy is), e.g. "📦 Dependencies · 🐛 Fix".
  const labelLine = labels && labels.length ? `**${labels.join("  ·  ")}**\n\n` : "";
  const sections = [];
  for (const g of Object.values(GROUPS)) {
    const items = groups[g.key] ?? [];
    if (!items.length) continue;
    const shown = items.slice(0, MAX_ITEMS_PER_GROUP);
    const extra = items.length - shown.length;
    const lines = shown.map((t) => `• ${t}`);
    if (extra > 0) lines.push(`_…and ${extra} more_`);
    sections.push(`**${g.emoji} ${g.label}**\n${lines.join("\n")}`);
  }

  if (!sections.length) {
    sections.push("We shipped a small update. Nothing user-facing to report this time.");
  }
  if (internalCount > 0) {
    sections.push(`_Plus ${internalCount} behind-the-scenes ${internalCount === 1 ? "update" : "updates"} (security, tooling, tests)._`);
  }

  let description = `${labelLine}${who ? `A new version of **${who}** is now live.` : "A new deploy is live."} Here's what changed:\n\n${sections.join("\n\n")}`;
  if (description.length > 4000) description = description.slice(0, 3990) + "\n…";

  const footerBits = [version && `${version}`, shortSha && `build ${shortSha}`, actor && `deployed by ${actor}`].filter(Boolean);

  return {
    username: who ? `${who} Updates` : "Platform Updates",
    embeds: [
      {
        title: who ? `🚀 ${who} just got an update` : "🚀 The platform just got an update",
        url: siteUrl || undefined,
        description,
        color: BRAND_COLOR,
        fields: runUrl ? [{ name: "​", value: `[View deploy log](${runUrl})`, inline: false }] : undefined,
        footer: { text: footerBits.join("  •  ") || "Deployed" },
        timestamp: when || new Date().toISOString(),
      },
    ],
  };
}

/** Minimal payload for a failed deploy (used by the workflow's failure path). */
export function deployFailedEmbed({ company, actor, runUrl, shortSha }) {
  const who = (company || "").trim();
  return {
    username: who ? `${who} Updates` : "Platform Updates",
    embeds: [
      {
        title: who ? `⚠️ ${who} deploy needs attention` : "⚠️ Platform deploy needs attention",
        description: "A deployment did not finish successfully. The site may still be on the previous version. An engineer should take a look.",
        color: 0xb42318,
        fields: runUrl ? [{ name: "​", value: `[View the failed run](${runUrl})`, inline: false }] : undefined,
        footer: { text: [shortSha && `build ${shortSha}`, actor && `triggered by ${actor}`].filter(Boolean).join("  •  ") || "Deploy failed" },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
