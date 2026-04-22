import { useState } from "react";
import type { Parts, MatchConfig } from "@ncblast/shared";
import { S } from "../styles";
import { IC } from "../components/Icons";
import { GUIDE_SECTIONS, CHANGELOG } from "../data/content";

export interface FormatScreenProps {
  config: MatchConfig;
  setConfig: (c: MatchConfig) => void;
  parts: Parts;
  onNext: () => void;
  onOpenLib: () => void;
  dark: boolean;
  toggleDark: () => void;
}

/**
 * SCREEN 1 — FORMAT. Pick point limit, best-of, tournament/ranked mode,
 * tournament name, library access, changelog/guide, dark mode toggle.
 */
export function FormatScreen({ config, setConfig, parts, onNext, onOpenLib, dark, toggleDark }: FormatScreenProps) {
  const [showChangelog,setShowChangelog] = useState(false);
  const [showGuide,setShowGuide] = useState(false);
  const total=parts.blades.length+parts.ratchets.length+parts.bits.length;
  const hasLib=total>0;

  return (
    <>
    {showChangelog&&(
      <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.7)",zIndex:300,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 16px",overflowY:"auto"}}>
        <div style={{background:"var(--surface)",borderRadius:18,padding:"24px 20px",maxWidth:480,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <h2 style={{margin:0,fontSize:20,fontWeight:900,color:"var(--text-primary)"}}>NC BLAST</h2>
              <p style={{margin:0,fontSize:11,color:"var(--text-faint)"}}>Development Changelog</p>
            </div>
            <button onClick={()=>setShowChangelog(false)} style={{background:"var(--surface3)",border:"none",borderRadius:10,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"var(--text-muted)",fontSize:18}}>{IC.x}</button>
          </div>
          {[...CHANGELOG].reverse().map((ver,vi)=>(
            <div key={vi} style={{marginBottom:20,paddingBottom:20,borderBottom:vi<CHANGELOG.length-1?"1px solid var(--border)":"none"}}>
              <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:8}}>
                <span style={{background:"#EA580C",color:"#fff",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:6,letterSpacing:0.5}}>v{ver.v}</span>
                <span style={{fontSize:14,fontWeight:800,color:"var(--text-primary)"}}>{ver.label}</span>
              </div>
              <ul style={{margin:0,paddingLeft:16,display:"flex",flexDirection:"column",gap:3}}>
                {ver.items.map((item,ii)=>(
                  <li key={ii} style={{fontSize:11,color:"var(--text-secondary)",lineHeight:1.5}}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
          <button onClick={()=>setShowChangelog(false)} style={{...S.current.pri,marginTop:4}}>Close</button>
        </div>
      </div>
    )}
    {showGuide&&(
      <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.7)",zIndex:300,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 16px",overflowY:"auto"}}>
        <div style={{background:"var(--surface)",borderRadius:18,padding:"24px 20px",maxWidth:480,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <h2 style={{margin:0,fontSize:20,fontWeight:900,color:"var(--text-primary)"}}>NC BLAST Guide</h2>
              <p style={{margin:0,fontSize:11,color:"var(--text-faint)"}}>How to use NC BLAST</p>
            </div>
            <button onClick={()=>setShowGuide(false)} style={{background:"var(--surface3)",border:"none",borderRadius:10,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"var(--text-muted)",fontSize:18}}>{IC.x}</button>
          </div>
          {GUIDE_SECTIONS.map((sec,si)=>(
            <div key={si} style={{marginBottom:20,paddingBottom:20,borderBottom:si<GUIDE_SECTIONS.length-1?"1px solid var(--border)":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{fontSize:18}}>{sec.icon}</span>
                <span style={{fontSize:14,fontWeight:800,color:"var(--text-primary)"}}>{sec.title}</span>
              </div>
              <p style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.7,margin:0}}>{sec.body}</p>
            </div>
          ))}
          <button onClick={()=>setShowGuide(false)} style={{...S.current.pri,marginTop:4}}>Close</button>
        </div>
      </div>
    )}
    <div style={{...S.current.page,height:"100dvh",overflowY:"auto"}}>
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:32,marginBottom:4}}>⚔️</div>
        <h1 style={S.current.logo}>NC <span style={{color:"#EA580C"}}>BLAST</span></h1>
        <p style={S.current.sub}>NorCal Battle Log and Stat Tracker</p>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginTop:4}}>
          <button onClick={()=>setShowGuide(true)} style={{background:"none",border:"none",color:"var(--text-faint)",fontSize:11,fontWeight:600,fontFamily:"'Outfit',sans-serif",cursor:"pointer",textDecoration:"underline"}}>Guide & Intro</button>
          <span style={{color:"var(--text-disabled)",fontSize:11}}>·</span>
          <button onClick={()=>setShowChangelog(true)} style={{background:"none",border:"none",color:"var(--text-faint)",fontSize:11,fontWeight:600,fontFamily:"'Outfit',sans-serif",cursor:"pointer",textDecoration:"underline"}}>v{CHANGELOG[CHANGELOG.length-1].v} — Changelog</button>
        </div>
      </div>
      <button onClick={onOpenLib} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"12px 14px",borderRadius:12,border:hasLib?"2px solid #15803D40":"2px dashed #EA580C",background:hasLib?"#15803D08":"#FFF7ED",cursor:"pointer",marginBottom:14,textAlign:"left"}}>
        <span style={{color:hasLib?"#15803D":"#EA580C"}}>{IC.db}</span>
        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:hasLib?"#15803D":"#EA580C"}}>{hasLib?`Library: ${parts.blades.length} blades · ${parts.ratchets.length} ratchets · ${parts.bits.length} bits`:"No parts loaded — tap to set up"}</div><div style={{fontSize:11,color:"var(--text-muted)",marginTop:1}}>{hasLib?"Tap to manage":"Import your Beyblade X parts first"}</div></div>
      </button>
      <div style={S.current.card}>
        <h2 style={S.current.label}>Match Type</h2>
        <div style={S.current.row}>{([[4,"4 Pts."],[5,"5 Pts."],[7,"7 Pts."],[0,"No Limit"]] as Array<[number,string]>).map(([v,l])=>(<button key={v} style={{...S.current.chip,...(config.pts===v?S.current.chipOn:{})}} onClick={()=>setConfig({...config,pts:v})}>{l}</button>))}</div>
        <div style={{...S.current.row,marginTop:8}}><button style={{...S.current.chip,...(config.pts>7?S.current.chipOn:{})}} onClick={()=>{const n=prompt("Custom point limit:"); if(n&&!isNaN(+n)&&+n>0)setConfig({...config,pts:+n});}}>{config.pts>7?config.pts+" Pts.":"Custom"}</button></div>
        <h2 style={{...S.current.label,marginTop:20}}>Sets</h2>
        <div style={S.current.row}>{[1,3,5].map(v=>(<button key={v} style={{...S.current.chip,...S.current.chipW,...(config.bo===v?S.current.chipBl:{})}} onClick={()=>setConfig({...config,bo:v})}>{v===1?"Best-of-1":`Best-of-${v}`}</button>))}</div>
        <h2 style={{...S.current.label,marginTop:20}}>Tournament Mode</h2>
        <div style={S.current.row}>{[false,true].map(v=>(<button key={String(v)} style={{...S.current.chip,...(config.tm===v?(v?{background:"#7C3AED",borderColor:"#7C3AED",color:"#fff"}:S.current.chipOn):{})}} onClick={()=>setConfig({...config,tm:v})}>{v?"On":"Off"}</button>))}</div>
        {config.tm&&(
          <div style={{marginTop:12}}>
            <input
              style={{...S.current.inp,width:"100%",borderColor:"#7C3AED60"}}
              placeholder="Tournament name..."
              value={config.tournamentName||""}
              onChange={e=>setConfig({...config,tournamentName:e.target.value})}
            />
            {!config.tournamentName?.trim()&&<p style={{...S.current.hint,color:"#7C3AED",marginTop:4}}>Enter tournament name to continue</p>}
          </div>
        )}

      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:600,color:"var(--text-muted)"}}>Dark Mode</span>
        <button onClick={toggleDark} style={{width:44,height:24,borderRadius:12,border:"none",background:dark?"#2563EB":"var(--border2)",cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
          <span style={{position:"absolute",top:2,left:dark?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
        </button>
      </div>
      <button style={{...S.current.pri,opacity:(hasLib&&(!config.tm||config.tournamentName?.trim()))?1:0.4}} disabled={!hasLib||(config.tm&&!config.tournamentName?.trim())} onClick={onNext}>Next: Players →</button>
      {!hasLib&&<p style={S.current.hint}>Set up your parts library first</p>}
    </div>
    </>
  );
}
