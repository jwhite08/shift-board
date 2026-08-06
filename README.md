# Shift Location Board

A centralized, web-hosted board showing which office each floating staff member
is working at for the AM/PM shift, along with the phone extension at their
workstation. Staff update their own location from a simple no-login page; the
board refreshes for everyone automatically.

Built to run entirely on Netlify:
- **Static frontend** — `public/index.html` (staff board) and `public/admin.html` (roster management)
- **Netlify Functions** — `netlify/functions/config.js` and `schedule.js`
- **Netlify Blobs** — built-in Netlify storage, no external database or account needed

---

## 1. One-time setup

You need:
- A Netlify account (free tier is fine)
- Node.js 18+ installed on your machine
- The Netlify CLI: `npm install -g netlify-cli`

Unzip this project, then from inside the folder:

```bash
npm install
```

## 2. Choose a deploy method

### Option A — Netlify CLI (fastest, no Git required)

```bash
netlify login
netlify init          # creates a new Netlify site, or links to an existing one
netlify deploy --prod
```

`netlify init` will ask a couple of questions (site name, team). Accept the
defaults for build command (none needed) and publish directory (`public`) —
they're already set in `netlify.toml`.

### Option B — Connect a Git repository (recommended if you'll keep editing this)

1. Push this folder to a new GitHub/GitLab repo.
2. In the Netlify dashboard: **Add new site → Import an existing project** → pick the repo.
3. Netlify reads `netlify.toml` automatically (publish dir `public`, functions dir `netlify/functions`) — no build command needed.
4. Every future `git push` auto-deploys.

## 3. Set the admin passcode

The `/admin.html` page (where you manage locations, extensions, and staff) is
protected by a passcode stored as an environment variable — never hard-coded.

In the Netlify dashboard: **Site settings → Environment variables → Add a variable**
- Key: `ADMIN_PASSCODE`
- Value: something only you/your IT team know

Then trigger a redeploy (**Deploys → Trigger deploy → Deploy site**) so the
function picks up the new variable.

> Netlify Blobs itself requires no setup or extra environment variables — it's
> automatically available to functions on any deployed Netlify site.

## 4. Add your real locations, extensions, and staff

Visit `https://YOUR-SITE.netlify.app/admin.html`, enter the passcode, and:
- Delete the two "EXAMPLE" locations and add your real offices/ASCs
- For each location, add one row per workstation with its label (e.g. "Front Desk 2") and extension
- Add your staff roster

Click **Save changes**. This is a one-time setup — your team won't need this
page day-to-day, only when a workstation, extension, or staff member changes.

## 5. Share the board

Send staff the main URL: `https://YOUR-SITE.netlify.app/`
No login needed — they pick their name, choose AM or PM, choose their
location and workstation, and hit Save. Good candidates:
- Pin it as a browser tab/homepage on shared floating workstations
- Add it to your intranet or a Teams tab
- Bookmark it on staff phones

## Notes on privacy

The board shows staff names, their current office, and a phone extension —
not clinical or patient information. That said, since it's staff-identifying
information, consider Netlify's built-in **Site protection → Password
protection** (Site settings → Access control, available on paid plans) if you
want the whole board restricted to people on your network, in addition to the
admin passcode already protecting the roster-editing page.

## How the data is structured (for reference)

- `config` blob: `{ locations: [{ id, name, workstations: [{ id, label, extension }] }], staff: [{ id, name }] }`
- `schedule-YYYY-MM-DD` blob per day: `{ AM: { staffId: { locationId, workstationId } }, PM: { ... } }`

Assignments are keyed by date, so the board naturally resets each day and
staff can also plan ahead (e.g., set tomorrow's AM location this afternoon) by
navigating the date arrows on the board.
