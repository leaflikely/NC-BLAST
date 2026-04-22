import { useEffect, useState } from "react";
import type { MatchConfig, Parts, LogEntry, ChallongeParticipantMap, SubmissionQueueItem } from "@ncblast/shared";
import { sGet, sSave, STORAGE_KEYS as KEYS, SHEETS_URL, WORKER_BASE_URL } from "@ncblast/shared";
import { FormatScreen } from "./screens/FormatScreen";
import { PlayersScreen } from "./screens/PlayersScreen";
import { MatchScreen } from "./screens/MatchScreen";
import type { DownloadCsvMeta, SendSheetsMeta } from "./screens/MatchScreen";
import { LibraryManager } from "./components/LibraryManager";
import { useScale } from "./hooks/useScale";
import { useDarkMode } from "./hooks/useDarkMode";
import { useRefreshGuard } from "./hooks/useRefreshGuard";
import { mergeWithDefaults } from "./data/parts";
import { makeS, S } from "./styles";
import { comboStr } from "./utils";
import { enqueue, remove as removeFromQueue, list as listQueue } from "./submitQueue";

type Screen = "format" | "players" | "match";

/**
 * MAIN APP — BeyJudgeApp. Hosts the screen router, dark mode, library modal,
 * scale hook, Challonge context, and the Sheets/CSV/offline-queue handlers.
 */
export function BeyJudgeApp() {
  const sc = useScale();
  S.current = makeS(sc); // update module-level S so all components see it
  const [dark, toggleDark] = useDarkMode();
  const [screen,setScreen] = useState<Screen>("format");
  const [config,setConfig] = useState<MatchConfig>({pts:4,bo:3,tm:false,tournamentName:""});
  const [parts,setParts] = useState<Parts>({blades:[],ratchets:[],bits:[]});
  const [players,setPlayers] = useState<string[]>([]);
  const [libOpen,setLibOpen] = useState(false);
  // Block refresh when a match is actively in progress
  useRefreshGuard(screen === "match");
  const [judge,setJudge] = useState("");
  const [sheetsStatus,setSheetsStatus] = useState<null | "success" | "error" | "queued">(null);
  const [challongeSlug,setChallongeSlug] = useState("");
  const [challongeParticipants,setChallongeParticipants] = useState<ChallongeParticipantMap>({});

  useEffect(()=>{
    const saved=sGet(KEYS.parts, {} as Partial<Parts>);
    const merged=mergeWithDefaults(saved);
    setParts(merged); sSave(KEYS.parts,merged);
    setPlayers(sGet(KEYS.players, [] as string[]));
    // Restore last Challonge tournament context
    const savedMap = sGet(KEYS.challongeMap, {} as { slug?: string; participants?: ChallongeParticipantMap });
    if(savedMap.slug) setChallongeSlug(savedMap.slug);
    if(savedMap.participants) setChallongeParticipants(savedMap.participants);
  },[]);

  // Download CSV to device — always available, never sends to sheets
  const handleDownloadCSV = (roundLog: LogEntry[], meta: DownloadCsvMeta): void => {
    let csv="Round,Set,Shuffle,Judge,Tournament,Winner,WinnerCombo,FinishType,Points,Penalty,P1,P1Side,P1Score,P1Combo,P2,P2Side,P2Score,P2Combo,Timestamp\n";
    roundLog.forEach(r=>{csv+=`${r.round},${r.set},${r.shuffle},"${r.judge||""}","${meta.config?.tournamentName||""}","${r.scorer}","${r.winnerCombo}",${r.type},${r.points},${r.penalty?1:0},"${r.p1Name}",${r.p1Side||""},"${r.p1Score}","${comboStr(r.p1Combo)}","${r.p2Name}",${r.p2Side||""},"${r.p2Score}","${comboStr(r.p2Combo)}",${r.time}\n`;});
    const blob=new Blob([csv],{type:"text/csv"}); const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=`ncblast_${meta.p1||"p1"}_vs_${meta.p2||"p2"}_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  // Send to Google Sheets only — no CSV download
  const handleSendSheets = async (roundLog: LogEntry[], meta: SendSheetsMeta): Promise<void> => {
    const flagged = meta.flagged || false;
    const comment = meta.comment || "";
    // Sheet 1: existing summary rows
    const rows: unknown[][] = roundLog.map(r=>[
      r.time,
      r.judge||"",
      meta.config?.tournamentName||"",
      `${r.p1Name} vs ${r.p2Name}`,
      r.p1Name, r.p1Side||"", r.p2Name, r.p2Side||"",
      r.set, r.shuffle, r.round,
      r.scorer, r.winnerCombo,
      r.typeName, r.points,
      r.penalty?1:0,
      r.p1Score, r.p2Score,
      comboStr(r.p1Combo), comboStr(r.p2Combo)
    ]);

    // Sheet 2: one row per battle with specific battle-level detail
    const battleRows: unknown[][] = roundLog.map(r=>{
      // Format time as PST XX:XXam/pm
      const d = new Date(r.time);
      const pst = new Date(d.toLocaleString("en-US",{timeZone:"America/Los_Angeles"}));
      const h = pst.getHours(); const m = pst.getMinutes();
      const ampm = h>=12?"pm":"am";
      const h12 = h%12||12;
      const mm = String(m).padStart(2,"0");
      const mo = String(pst.getMonth()+1).padStart(2,"0");
      const dy = String(pst.getDate()).padStart(2,"0");
      const yr = pst.getFullYear();
      const dateTime = `${mo}/${dy}/${yr} ${h12}:${mm}${ampm}`;

      // Win condition: e.g. "XTR+3", "OVR+2", "OF+2", "LER+1"
      const winCondition = r.penalty
        ? `${r.type===("OF2")||r.type===("OF3")?"OF":"LER"}+${r.points}`
        : `${r.type}+${r.points}`;

      const winnerIsP1 = r.scorerIdx===0;
      const winnerName = winnerIsP1 ? r.p1Name : r.p2Name;
      const loserName  = winnerIsP1 ? r.p2Name : r.p1Name;
      const winnerCombo = r.winnerCombo;
      const loserCombo  = winnerIsP1 ? comboStr(r.p2Combo) : comboStr(r.p1Combo);

      return [
        dateTime,
        r.judge||"",
        r.p1Name, r.p1Side||"", comboStr(r.p1Combo),
        r.p2Name, r.p2Side||"", comboStr(r.p2Combo),
        winnerName, winnerCombo,
        winCondition,
        loserCombo, loserName
      ];
    });

    try {
      // Write-ahead: persist to outbox FIRST, then try to submit.
      const queueId = enqueue({ kind: "sheets", type: "sheets", payload: {rows, battleRows, flagged, comment} });
      const resp = await fetch(SHEETS_URL, {
        method:"POST",
        body: JSON.stringify({rows, battleRows, flagged, comment}),
        signal: AbortSignal.timeout(10000),
      });
      const result: unknown = await resp.json();
      const ok = typeof result === "object" && result !== null && "status" in result && (result as { status: unknown }).status === "ok";
      if (ok) {
        removeFromQueue(queueId);
        setSheetsStatus("success");
      } else {
        // Leave queued — retry loop will pick it up.
        setSheetsStatus("queued");
      }
    } catch(_err) {
      // Timeout or network failure — item already persisted, retry loop will pick it up.
      setSheetsStatus("queued");
    }
  };

  // Retry queued submissions when network reconnects (and once on mount).
  useEffect(() => {
    const flush = async (): Promise<void> => {
      // Process items serially to avoid double-submits if multiple tabs are open.
      const queue: SubmissionQueueItem[] = listQueue();
      for (const item of queue) {
        if (!item.id) continue;
        const kind = item.kind ?? (item.type === "sheets" ? "sheets" : undefined);
        try {
          if (kind === "sheets") {
            const resp = await fetch(SHEETS_URL, {
              method: "POST",
              body: JSON.stringify(item.payload),
              signal: AbortSignal.timeout(10000),
            });
            const result: unknown = await resp.json();
            const ok = resp.ok && typeof result === "object" && result !== null && "status" in result && (result as { status: unknown }).status === "ok";
            if (ok) {
              removeFromQueue(item.id);
              console.log(`[submitQueue] flushed sheets item ${item.id}`);
            }
          } else if (kind === "challonge") {
            const resp = await fetch(`${WORKER_BASE_URL}/submit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item.payload),
              signal: AbortSignal.timeout(10000),
            });
            // Only remove on confirmed HTTP 2xx (and no Challonge-reported errors).
            if (resp.ok) {
              const data: unknown = await resp.json().catch((): unknown => null);
              const hasErrors = typeof data === "object" && data !== null && "errors" in data && Array.isArray((data as { errors: unknown }).errors) && ((data as { errors: unknown[] }).errors).length > 0;
              if (!hasErrors) {
                removeFromQueue(item.id);
                console.log(`[submitQueue] flushed challonge item ${item.id}`);
              }
            }
          }
        } catch {
          // Leave item queued for next flush.
        }
      }
    };
    // Fire once on mount in case items are sitting from a prior session/crash.
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);


  return (
    <div style={{background:"var(--bg)",minHeight:"100vh",fontFamily:"'Outfit',sans-serif"}}>
      {libOpen&&<LibraryManager parts={parts} setParts={setParts} onClose={()=>setLibOpen(false)}/>}
      {screen==="format"&&<FormatScreen config={config} setConfig={setConfig} parts={parts} onNext={()=>setScreen("players")} onOpenLib={()=>setLibOpen(true)} dark={dark} toggleDark={toggleDark}/>}
      {screen==="players"&&<PlayersScreen players={players} setPlayers={setPlayers} onNext={()=>setScreen("match")} onBack={()=>setScreen("format")} toggleDark={toggleDark} dark={dark} config={config} onChallongeImport={(slug,pmap)=>{setChallongeSlug(slug);setChallongeParticipants(pmap);sSave(KEYS.challongeMap,{slug,participants:pmap});}}/>}
      {screen==="match"&&<MatchScreen config={config} parts={parts} players={players} judge={judge} setJudge={setJudge} sheetsStatus={sheetsStatus} setSheetsStatus={setSheetsStatus} onBack={()=>setScreen("players")} onMainMenu={()=>setScreen("format")} onDownloadCSV={handleDownloadCSV} onSendSheets={handleSendSheets} onOpenLib={()=>setLibOpen(true)} dark={dark} toggleDark={toggleDark} challongeSlug={challongeSlug} challongeParticipants={challongeParticipants}/>}
    </div>
  );
}
