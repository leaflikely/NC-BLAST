// NC BLAST simulator: plumbing.
// - serves the app files from this repo on a local address (like Cloudflare Pages does)
// - opens browser windows ("devices") whose outside requests are answered by the FakeWorker
// - watches each device for crashes and error messages

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf", ".ico": "image/x-icon",
  ".webp": "image/webp", ".mp3": "audio/mpeg", ".wav": "audio/wav",
};

// Serves the repo the way Cloudflare Pages does: "/" -> index.html, "/overlay" -> overlay.html.
function startServer(port = 0) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p === "/") p = "/index.html";
      let file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end("not found"); }
        res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(port, "127.0.0.1", () => resolve({ server, url: "http://127.0.0.1:" + server.address().port }));
  });
}

function loadPlaywright() {
  const tries = ["playwright", "/opt/npm-tools/node_modules/playwright"];
  for (const t of tries) { try { return require(t); } catch (_) {} }
  throw new Error("Playwright is not installed. Run:  npm install --no-save playwright  (then  npx playwright install chromium)");
}

// Every outside address the app talks to. Anything matching is answered by the fake;
// nothing matching ever leaves this computer.
const OUTSIDE = /^https?:\/\/(?!127\.0\.0\.1|localhost)/;

// Opens one device (its own browser profile, so its own localStorage/sessionStorage).
async function openDevice(browser, fw, who, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 412, height: 915 },   // a typical phone
    deviceScaleFactor: 1,
    hasTouch: !!opts.touch,
    serviceWorkers: "block",   // so every request goes through the fake below, never around it
  });
  const siteHost = opts.siteHost || null;
  const dev = { who, ctx, page: null, errors: [], consoleErrors: [] };
  await ctx.route(OUTSIDE, async route => {
    const r = route.request();
    // The app's own pages and files (when testing the live site) load normally.
    // Everything else (Challonge, the Workers, Google Sheets) is answered by the fake.
    if (siteHost && new URL(r.url()).host === siteHost) return route.continue();
    let ans;
    try {
      ans = fw.handle({ method: r.method(), url: r.url(), body: r.postData(), who });
    } catch (e) {
      fw.find("bug", who, "Simulator error while answering " + r.url(), String(e && e.stack || e).slice(0, 300));
      ans = { status: 500, json: { error: "simulator error" } };
    }
    if (ans.delay) await new Promise(res => setTimeout(res, ans.delay));
    const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS" };
    try {
      if (ans.json !== undefined) await route.fulfill({ status: ans.status, headers, contentType: "application/json", body: JSON.stringify(ans.json) });
      else await route.fulfill({ status: ans.status, headers, contentType: ans.contentType || "text/plain", body: ans.text || "" });
    } catch (_) { /* page closed while answering */ }
  });
  const page = await ctx.newPage();
  dev.page = page;
  page.on("pageerror", e => dev.errors.push(String(e && e.message || e).slice(0, 400)));
  page.on("console", m => {
    if (m.type() !== "error") return;
    const t = m.text();
    // A 404 from a route the fake does not know is already counted in fw.unknown.
    if (/Failed to load resource/.test(t)) return;
    dev.consoleErrors.push(t.slice(0, 400));
  });
  page.on("dialog", d => { dev.lastDialog = d.message(); d.accept().catch(() => {}); });
  return dev;
}

module.exports = { startServer, loadPlaywright, openDevice, ROOT };
