// NC BLAST robot judges, in the browser: the page's buttons and messages.
const { runEvent } = require("./run-web.cjs");
const mm = require("../mm.cjs");

const $ = id => document.getElementById(id);
const logEl = () => $("log");
function log(msg) {
  const t = new Date().toLocaleTimeString();
  logEl().textContent += `[${t}] ${msg}\n`;
  logEl().scrollTop = logEl().scrollHeight;
}

let stopFns = [];
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

async function start() {
  const link = $("link").value.trim();
  const o = {
    judges: Math.max(1, Math.min(8, parseInt($("judges").value, 10) || 8)),
    rounds: Math.max(1, parseInt($("rounds").value, 10) || 1),
    players: 32, seed: parseInt($("seed").value, 10) || 1,
    undoRate: 0.05, refreshRate: 0.02, overlay: true, overlayEvery: 1,
    roundWait: Math.max(60, (parseFloat($("wait").value) || 10) * 60),
    onStop: fn => stopFns.push(fn),
  };
  $("go").disabled = true; $("stop").disabled = false; $("done").hidden = true; stopFns = [];
  $("grid").innerHTML = ""; logEl().textContent = "";
  try {
    if (link) {
      if (!$("ok").checked) { log("Tick the box to confirm results will be written to MatchMason for real."); $("go").disabled = false; $("stop").disabled = true; return; }
      const id = mm.parseMmId(link);
      if (!id) throw new Error("That is not a MatchMason event link or ID (expected matchmason.com/t/<id>).");
      o.workerBase = (new URLSearchParams(location.search).get("worker") || mm.REAL_WORKER).replace(/\/+$/, "");   // ?worker= is only for testing
      o.mmEvent = await mm.loadMmEvent(o.workerBase, id, o.judges);
      const ev = o.mmEvent;
      log(`REAL MatchMason: "${ev.name}", ${ev.players.length} players, ${ev.judges.length} robot judges, ${ev.matches.length} open match(es) in round ${ev.round}.`);
      log("Results are being written to this MatchMason event for real. Starting in 5 seconds.");
      await new Promise(r => setTimeout(r, 5000));
    } else {
      log(`Practice run on a pretend bracket: ${o.players} players, ${o.judges} judges, ${o.rounds} round(s). Nothing real is touched.`);
    }
    log("Keep this tab open and in front. Chrome slows down tabs you are not looking at.");
    const { result, files } = await runEvent(o, log);
    const bugs = [...new Set(result.findings.filter(f => f.level === "bug").map(f => f.what))];
    const warns = [...new Set(result.findings.filter(f => f.level === "warn").map(f => f.what))];
    log(`Done in ${result.seconds}s: ${result.event.complete}/${result.event.matches} matches played, ${bugs.length} kind(s) of bug, ${warns.length} kind(s) of check.`);
    bugs.forEach(w => log("  BUG   " + w)); warns.forEach(w => log("  CHECK " + w));
    const html = files.get(result.reportFile), json = files.get("report/report.json");
    $("done").hidden = false;
    $("open").onclick = () => window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank");
    $("dl").onclick = () => download("blast-report.html", html, "text/html");
    $("dlj").onclick = () => download("blast-report.json", json, "application/json");
    window.__lastResult = result;
  } catch (e) {
    log("Stopped: " + (e && e.message || e));
  }
  $("go").disabled = false; $("stop").disabled = true;
}

document.addEventListener("DOMContentLoaded", () => {
  $("go").onclick = start;
  $("stop").onclick = () => { stopFns.forEach(f => f()); log("Stopping: the robots finish their current step and stop."); };
  $("link").addEventListener("input", () => { $("okrow").hidden = !$("link").value.trim(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && !$("go").disabled === false) log("This tab is in the background: Chrome may be slowing the robots down."); });
  window.addEventListener("beforeunload", e => { if ($("go").disabled) { e.preventDefault(); e.returnValue = ""; } });
});
