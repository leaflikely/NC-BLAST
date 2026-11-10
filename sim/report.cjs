// NC BLAST simulator: writes the run report (report.html to read, report.json for tools).
const fs = require("fs");
const path = require("path");

const esc = s => String(s === undefined || s === null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function group(findings) {
  const g = new Map();
  findings.forEach(f => {
    const k = f.level + "|" + f.what;
    if (!g.has(k)) g.set(k, { level: f.level, what: f.what, items: [] });
    g.get(k).items.push(f);
  });
  const order = { bug: 0, warn: 1, info: 2 };
  return [...g.values()].sort((a, b) => (order[a.level] - order[b.level]) || (b.items.length - a.items.length));
}

function writeReport(dir, r) {
  fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(r, null, 2));
  const groups = group(r.findings);
  const count = l => groups.filter(g => g.level === l).length;          // distinct problems
  const times = l => r.findings.filter(f => f.level === l).length;      // how often they happened
  const label = { bug: "Bug", warn: "Check", info: "Note" };
  const matches = r.robots.flatMap(x => x.matches.map(m => ({ ...m, who: x.who })));
  const delays = r.robots.flatMap(x => x.overlayDelays || []);
  const refreshes = r.robots.reduce((a, x) => a + (x.refreshes || 0), 0);
  const avg = matches.length ? Math.round(matches.reduce((a, m) => a + m.ms, 0) / matches.length / 1000) : 0;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BLAST Sim Report</title>
<style>
:root{--bg:#f7f7f5;--card:#fff;--ink:#1d1d1b;--mute:#6b6b66;--line:#e4e3de;--bug:#c2410c;--warn:#a16207;--info:#475569;--ok:#15803d}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--card:#1e1e1c;--ink:#ecebe6;--mute:#9a9992;--line:#2e2e2b;--bug:#fb923c;--warn:#facc15;--info:#94a3b8;--ok:#4ade80}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:920px;margin:0 auto;padding:24px 16px 60px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 10px}
.sub{color:var(--mute);margin:0 0 18px}.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}.tile b{display:block;font-size:24px}.tile span{color:var(--mute);font-size:13px}
.f{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:0 0 10px;padding:12px 14px}
.f summary{cursor:pointer;list-style:none;display:flex;gap:10px;align-items:baseline}.f summary::-webkit-details-marker{display:none}
.tag{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:2px 7px;border-radius:99px;border:1px solid currentColor;flex:none}
.bug{color:var(--bug)}.warn{color:var(--warn)}.info{color:var(--info)}.n{color:var(--mute);margin-left:auto;flex:none}
.f ul{margin:10px 0 0;padding-left:18px;color:var(--mute);font-size:13px;word-break:break-word}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:13px}
th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--line)}th{color:var(--mute);font-weight:600}
.stuck{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--bug);border-radius:10px;padding:12px 14px;margin-bottom:10px}
.stuck img{max-width:240px;border:1px solid var(--line);border-radius:6px;margin-top:8px}code{font-size:12px}
.ok{color:var(--ok);font-weight:600}.wrap{overflow-x:auto}
</style></head><body><main>
<h1>BLAST simulator report</h1>
<p class="sub">${esc(r.event.name)} · ${r.event.players} players · ${r.robots.length} robot judges · seed ${r.options.seed} · ${esc(r.site || "")} · ${esc(r.startedAt.replace("T", " ").slice(0, 19))} UTC · ${r.seconds}s</p>
<div class="tiles">
<div class="tile"><b>${r.event.complete}/${r.event.matches}</b><span>matches played</span></div>
<div class="tile"><b>${r.event.rounds}</b><span>Swiss rounds</span></div>
<div class="tile"><b class="${count("bug") ? "bug" : "ok"}">${count("bug")}</b><span>bugs (seen ${times("bug")}×)</span></div>
<div class="tile"><b class="${count("warn") ? "warn" : "ok"}">${count("warn")}</b><span>checks to look at (seen ${times("warn")}×)</span></div>
<div class="tile"><b>${avg}s</b><span>avg robot match</span></div>
<div class="tile"><b>${refreshes}</b><span>mid-match refreshes</span></div>
<div class="tile"><b>${delays.length ? (delays.reduce((a, b) => a + b, 0) / delays.length / 1000).toFixed(1) + "s" : "–"}</b><span>overlay catch-up (${delays.length} checks)</span></div>
<div class="tile"><b>${r.requests}</b><span>requests answered</span></div>
</div>
${r.failures.length ? `<h2>Robots that got stuck</h2>` + r.failures.map(f => `<div class="stuck"><b>Station ${esc(f.who)}</b>: ${esc(f.error)}<br><span class="sub">Screen: ${esc(f.screen)}</span><br><span class="sub">Last steps: ${esc(f.lastSteps.join(" → "))}</span><br><img src="${esc(f.shot)}" alt="screen when stuck"></div>`).join("") : ""}
<h2>Findings</h2>
${groups.length ? groups.map(g => `<details class="f"${g.level === "bug" ? " open" : ""}><summary><span class="tag ${g.level}">${label[g.level]}</span><span>${esc(g.what)}</span><span class="n">${g.items.length}×</span></summary><ul>${g.items.slice(0, 12).map(i => `<li>Station ${esc(i.who)}: ${esc(i.detail)}</li>`).join("")}${g.items.length > 12 ? `<li>…and ${g.items.length - 12} more (see report.json)</li>` : ""}</ul></details>`).join("") : `<p class="ok">Nothing found.</p>`}
${r.overlayShot ? `<h2>Stream overlay (channel 1, station A) at the end</h2><img src="${esc(r.overlayShot)}" alt="overlay" style="max-width:100%;border:1px solid var(--line);border-radius:8px;background:#000">` : ""}
<h2>Matches</h2>
<div class="wrap"><table><tr><th>Station</th><th>Match</th><th>Sets</th><th>Battles</th><th>Undos</th><th>Time</th></tr>
${matches.map(m => `<tr><td>${esc(m.who)}</td><td>${esc(m.name)}</td><td>${esc(m.exp)}</td><td>${m.battles}</td><td>${m.undos}</td><td>${Math.round(m.ms / 1000)}s</td></tr>`).join("")}
</table></div>
<p class="sub" style="margin-top:20px">Bug = something the robots proved wrong. Check = worth a look, may be fine. Note = information. Re-run the same choices with <code>node sim/run.cjs --seed ${r.options.seed} --rounds ${r.options.rounds}</code>.</p>
</main></body></html>`;
  const file = path.join(dir, "report.html");
  fs.writeFileSync(file, html);
  return file;
}

module.exports = { writeReport };
