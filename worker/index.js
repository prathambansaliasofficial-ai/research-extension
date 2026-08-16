/**
 * random-paper-worker
 *
 * Public proxy for the "Paper Popup" Chrome extension. The extension itself
 * is open source, so it can never hold NOTION_TOKEN directly — anyone could
 * read it straight out of the unpacked extension files. This Worker holds
 * the secret instead (as a Cloudflare Worker "secret", never committed to
 * git) and exposes exactly one safe, read-only endpoint: a random paper's
 * title, plain-text summary, and links. Nothing else from your Notion
 * database is ever exposed.
 *
 * Deploy (one-time):
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. wrangler secret put NOTION_TOKEN         (paste your Notion integration token)
 *   4. wrangler secret put NOTION_DATABASE_ID   (paste your database id)
 *   5. wrangler deploy
 * You'll get a URL like https://random-paper-worker.<you>.workers.dev — put
 * that in the extension's popup.js as WORKER_URL.
 *
 * Your Notion integration only needs read access to the one database — share
 * just that database with the integration, not your whole workspace.
 */

const NOTION_VERSION = "2022-06-28";
const MAX_SUMMARY_WORDS = 1000;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      const page = await pickRandomPage(env);
      if (!page) {
        return json({ error: "No papers found in the database yet." }, 404);
      }
      const summary = await pageToSummary(env, page);
      return json(summary, 200);
    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  },
};

async function notionFetch(env, path, options = {}) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Notion API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/** Grabs a page of results (cheap: one query) and picks one at random.
 *  Fine for databases up to a few hundred pages; for a much larger archive,
 *  swap this for a cached/paginated random-id picker. */
async function pickRandomPage(env) {
  const data = await notionFetch(env, `/databases/${env.NOTION_DATABASE_ID}/query`, {
    method: "POST",
    body: JSON.stringify({ page_size: 100, sorts: [{ timestamp: "created_time", direction: "descending" }] }),
  });
  const results = data.results || [];
  if (results.length === 0) return null;
  return results[Math.floor(Math.random() * results.length)];
}

async function pageToSummary(env, page) {
  const props = page.properties || {};
  const title = props.Title?.title?.map((t) => t.plain_text).join("") || "Untitled paper";
  const arxivUrl = props.Link?.url || null;
  const blogUrl = props["Blog URL"]?.url || null;

  const blocks = await notionFetch(env, `/blocks/${page.id}/children?page_size=100`);
  const text = blocksToPlainText(blocks.results || [], MAX_SUMMARY_WORDS);

  return {
    title,
    text,
    // Prefer the published blog post (matches the site's own styling); fall
    // back to the arXiv page if Blogger hasn't published this one (yet).
    url: blogUrl || arxivUrl,
  };
}

function blocksToPlainText(blocks, maxWords) {
  const parts = [];
  let wordCount = 0;

  for (const block of blocks) {
    const type = block.type;
    const richText = block[type]?.rich_text;
    if (!richText) continue;
    const line = richText.map((t) => t.plain_text).join("").trim();
    if (!line) continue;

    if (type === "heading_2" || type === "heading_3") {
      parts.push(`\n${line}\n`);
    } else if (type === "paragraph" || type === "callout") {
      parts.push(line);
    } else {
      continue;
    }

    wordCount += line.split(/\s+/).length;
    if (wordCount >= maxWords) break;
  }

  return parts.join("\n\n").trim();
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
