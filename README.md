# Paper Popup

A Chrome extension: click the toolbar icon, get a random paper's plain-language
summary in a nicely-typeset popup, click "Read the full write-up" to jump to
the blog post (or the arXiv page, if that one hasn't been published to
Blogger yet).

## Why there's a "worker" folder

This is going to be an open-source repo, so the extension code itself can
never hold your `NOTION_TOKEN` — anyone could read it straight out of the
unpacked extension. Instead, a small Cloudflare Worker holds the secret and
exposes exactly one safe endpoint that returns `{ title, text, url }` for one
random paper — nothing else about your Notion workspace is reachable.

```
                Notion (private)
                      ↑  NOTION_TOKEN (secret)
random-paper-worker.<you>.workers.dev   <-- public, but only returns
                      ↑                     title/summary/url
     popup.js  (in the open-source extension, no secrets)
```

## Deploy the worker (~5 minutes, free tier is plenty)

```bash
cd worker
npm install -g wrangler
wrangler login
wrangler secret put NOTION_TOKEN          # paste your Notion integration token
wrangler secret put NOTION_DATABASE_ID    # paste your database id
wrangler deploy
```

Share **only that one database** with your Notion integration (Notion →
database → "..." → Connections), not your whole workspace.

You'll also want a `Blog URL` property (type: URL) on your Notion database —
`pipeline.py`'s Notion push now writes the Blogger link there automatically
once a post publishes, so the extension can link out to the finished blog
post instead of the raw arXiv page.

Deploy prints your Worker's URL, something like:
`https://random-paper-worker.yourname.workers.dev`

## Point the extension at it

1. In `popup.js`, set `WORKER_URL` to that URL.
2. In `manifest.json`, update `host_permissions` to that same URL.

## Load it in Chrome

`chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select this folder.

## Notes for contributors

- The popup only ever talks to your worker, never to Notion directly.
- `worker/index.js` currently pulls up to 100 recent pages per request and
  picks one at random — fine for a database of a few hundred papers. If your
  archive grows much larger, swap that for a cached list of page IDs refreshed
  on a schedule, rather than querying Notion on every click.
