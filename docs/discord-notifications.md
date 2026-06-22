# Deploy notifications (Discord)

After a successful production deploy, a GitHub Actions workflow posts a
plain-language "what changed" summary to Discord. It is written for non-engineers.

## How it works

- `.github/workflows/notify.yml` runs when the **Deploy to production** workflow finishes
  successfully. It resolves the previous successful deploy's commit and runs
  `scripts/notify-deploy.mjs`.
- The script posts **only that deploy's changes** — it reads the Conventional
  Commits between the previously-deployed commit (`PREV_DEPLOY_SHA`) and the
  current one and groups them. (CHANGELOG.md is release-please-managed and only
  changes on releases, so commits — not the changelog — drive per-deploy
  summaries.) On the very first run, or if the range is empty, it falls back to
  the changelog delta, then the top section.
- Entries are grouped into **✨ New / 🛠️ Improvements / 🐛 Fixes** in the body.
- The post is prefixed with **inline change-type labels** — plain text such as
  `📦 Dependencies · 🐛 Fix` — derived from each entry's heading. These need **no
  Discord setup**: no forum tags, no tag IDs, no bot token. Label keys:
  `new` ✨, `improved` 🛠️, `fixed` 🐛, `deps` 📦, `security` 🔒, `internal` 🔧.
- Wording, emojis, colour, and the label taxonomy live in
  `scripts/notify-deploy/templates.mjs` — edit there.
- The webhook is the repo secret `DISCORD_DEPLOY_WEBHOOK`. A notification failure
  never affects the deploy (separate workflow; the script always exits 0).
- If the channel is a **forum**, each deploy still becomes its own post via
  `thread_name`.

## White-label branding (`COMPANY_NAME`)

This is white-label software, so the notification has no hard-coded product name.
Set the **`COMPANY_NAME`** GitHub Actions *variable* to the firm this deployment
is for:

```bash
gh variable set COMPANY_NAME --body "Acme Trust"
```

- Set → posts read **"A new version of *Acme Trust* is now live"**, username and
  thread use the firm name.
- Unset → neutral wording: **"The platform just got an update."**

## Configuration summary

| Name | Type | Purpose |
|---|---|---|
| `DISCORD_DEPLOY_WEBHOOK` | secret | Discord webhook URL (required to post) |
| `COMPANY_NAME` | variable | White-label firm name (optional) |
| `SITE_URL` | env in `notify.yml` | Link to the live site |

There is intentionally **no** forum-tag / tag-ID configuration: change-types are
shown inline as text, so nothing needs to be created in Discord.

## Local preview

```bash
# print the payload without posting:
PREV_DEPLOY_SHA=<old-sha> DEPLOY_SHA=<new-sha> DEPLOY_COMPANY="Acme Trust" \
  node scripts/notify-deploy.mjs --dry-run
```

## Reading the channel

- Posts are automatic deploy summaries — the label line tells you at a glance
  what kind of change shipped (Dependencies, Fix, New, …). Green/indigo = normal.
- The footer shows version, build, and who deployed, plus a link to the deploy log.
