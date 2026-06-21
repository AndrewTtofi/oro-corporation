# Deploy notifications (Discord)

After a successful production deploy, a GitHub Actions workflow posts a plain-language
"what changed" summary to the Discord **#deploys** forum. It is written for non-engineers.

## How it works

- `.github/workflows/notify.yml` runs when the **deploy-oro** workflow finishes successfully.
- It runs `scripts/notify-deploy.mjs`, which reads the top section of `CHANGELOG.md`,
  groups it into **✨ New / 🛠️ Improvements / 🐛 Fixes**, and posts a Discord embed.
- Wording, emojis, and colour live in `scripts/notify-deploy/templates.mjs` — edit there.
- The webhook is the repo secret `DISCORD_DEPLOY_WEBHOOK`. A notification failure never
  affects the deploy (separate workflow; the script always exits 0).
- The forum is a **forum channel**, so each deploy creates its own post (`thread_name`).

## Forum tags to create

In Discord: **Edit Channel → Tags** on the forum. Create these (name + emoji):

| Emoji | Tag name | Use it for |
|------|----------|-----------|
| 🚀 | Deploy | Automated "we shipped an update" posts (the notifier uses this) |
| ✨ | New feature | A noticeable new capability |
| 🛠️ | Improvement | Something existing got better/faster |
| 🐛 | Fix | A bug was fixed |
| ⚠️ | Incident | Something is broken or degraded right now |
| ✅ | Resolved | A prior incident is fixed |
| 🔧 | Maintenance | Planned/scheduled work (possible brief downtime) |
| 📢 | Announcement | Human announcement (policy, dates, decisions) |
| 🔴 | Action needed | A reader must do something |
| ❓ | Question | Asking the team something |

The notifier can auto-apply the **🚀 Deploy** tag. To enable it: after creating the tag,
right-click the forum → Copy the tag ID (or ask an engineer to read it via the API), and
set the repo variable/secret `DEPLOY_TAG_IDS` to that ID (comma-separated for several).

## Reading the forum (for everyone)

- **Most posts are automatic 🚀 Deploy summaries.** They tell you what changed. No action needed.
- **⚠️ Incident / 🔴 Action needed** posts are the ones to actually read and act on.
- Green/indigo = normal update. Red = a problem.
- **Ask questions by replying inside a post's thread** — keep each topic in its own thread.
- Only start a new post for a real announcement or question, and apply a tag.
- The footer shows the version, build, and who deployed, plus a link to the deploy log.
