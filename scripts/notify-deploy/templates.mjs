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

/** Build the Discord payload for a successful deploy. */
export function deploySuccessEmbed({ brand, groups, internalCount, version, shortSha, actor, siteUrl, runUrl, when }) {
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

  let description = `A new version of **${brand}** is now live. Here's what changed:\n\n${sections.join("\n\n")}`;
  if (description.length > 4000) description = description.slice(0, 3990) + "\n…";

  const footerBits = [version && `${version}`, shortSha && `build ${shortSha}`, actor && `deployed by ${actor}`].filter(Boolean);

  return {
    username: `${brand} Updates`,
    embeds: [
      {
        title: `🚀 ${brand} just got an update`,
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
export function deployFailedEmbed({ brand, actor, runUrl, shortSha }) {
  return {
    username: `${brand} Updates`,
    embeds: [
      {
        title: `⚠️ ${brand} deploy needs attention`,
        description: "A deployment did not finish successfully. The site may still be on the previous version. An engineer should take a look.",
        color: 0xb42318,
        fields: runUrl ? [{ name: "​", value: `[View the failed run](${runUrl})`, inline: false }] : undefined,
        footer: { text: [shortSha && `build ${shortSha}`, actor && `triggered by ${actor}`].filter(Boolean).join("  •  ") || "Deploy failed" },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
