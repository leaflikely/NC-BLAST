export const importChallonge = async () => {
    const raw = challongeUrl.trim();
    let slug = "";
    try {
      const url = new URL(raw.startsWith("http") ? raw : "https://"+raw);
      const cleanPath = url.pathname.replace(/\/(participants|standings|teams|matches).*$/i,"");
      const parts = cleanPath.replace(/^\/|\/$/g,"").split("/").filter(Boolean);
      const subdomain = url.hostname.split(".")[0];
      const isCommunity = subdomain !== "challonge" && subdomain !== "www";
      const pathSlug = parts[parts.length-1] || parts[0];
      slug = isCommunity ? `${subdomain}-${pathSlug}` : pathSlug;
    } catch {
      slug = raw.replace(/.*challonge\.com\//,"").replace(/\/(participants|standings).*/i,"").replace(/\/$/,"").split("/").pop();
    }
    if(!slug){ setChallongeStatus("error"); setChallongeMsg("Couldn't read a tournament slug from that URL."); return; }

    setChallongeStatus("loading"); setChallongeMsg("Checking NC BLAST server cache...");
    const API_KEY = "68330566a844961951645c6e25c48a7619d0f21c2d4b0f4a";
    const apiUrl = `https://api.challonge.com/v1/tournaments/${slug}/participants.json?api_key=${API_KEY}`;

    // ── Device-level localStorage cache (30 min TTL) ─────────────────────────
    const LC_KEY = "bx-challonge-cache-v1";
    const LC_TTL = 30 * 60 * 1000;
    const lcGet = (s) => {
      try {
        const store = JSON.parse(localStorage.getItem(LC_KEY) || "{}");
        const e = store[s];
        if(e && (Date.now() - e.fetchedAt) < LC_TTL) return e.names;
      } catch {}
      return null;
    };
    const lcSet = (s, names) => {
      try {
        const store = JSON.parse(localStorage.getItem(LC_KEY) || "{}");
        store[s] = { names, fetchedAt: Date.now() };
        Object.keys(store).forEach(k => { if(Date.now() - store[k].fetchedAt >= LC_TTL) delete store[k]; });
        localStorage.setItem(LC_KEY, JSON.stringify(store));
      } catch {}
    };

    // Device cache hit — zero network calls
    const lcHit = lcGet(slug);
    if(lcHit) {
      const merged = [...new Set([...players,...lcHit])];
      setPlayers(merged); sSave(KEYS.players, merged);
      setChallongeStatus("ok");
      setChallongeSource("cached");
      setChallongeMsg(`✓ ${lcHit.length} players loaded from NC BLAST cache for "${slug}"`);
      return;
    }

    // Helper: parse response — Cloudflare Worker returns { participants:[], fromCache:bool }
    const parseResponse = (text, raw) => {
      const wrapper = JSON.parse(text);
      let data = (!raw && wrapper && wrapper.contents !== undefined)
        ? JSON.parse(wrapper.contents) : wrapper;
      if(!data) throw new Error("Empty response");
      if(data.errors) throw new Error(Array.isArray(data.errors) ? data.errors.join(", ") : String(data.errors));
      let fromServerCache = false;
      if(data.participants !== undefined) {
        fromServerCache = data.fromCache === true;
        data = data.participants;
      }
      if(!Array.isArray(data)) throw new Error("Unexpected response format");
      return { data, fromServerCache };
    };

    const attempt = async (url, timeout=10000) => {
      const res = await fetch(url, {signal: AbortSignal.timeout(timeout)});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    };

    const withRetry = async (fn, retries=2, delayMs=800) => {
      let lastErr;
      for(let i=0; i<=retries; i++){
        try { return await fn(); }
        catch(e){ lastErr=e; if(i<retries) await new Promise(r=>setTimeout(r,delayMs*(i+1))); }
      }
      throw lastErr;
    };

    // Cloudflare Worker: 3 attempts. Public fallbacks: 1 shot each.
    const proxyConfigs = [
      { name:"cloudflare",    buildUrl:()=>`https://challonge-proxy.danny61734.workers.dev/?slug=${slug}`, raw:true, retries:2 },
      { name:"allorigins",    buildUrl:()=>`https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`, retries:0 },
      { name:"corsproxy.io",  buildUrl:()=>`https://corsproxy.io/?${encodeURIComponent(apiUrl)}`, retries:0 },
      { name:"allorigins-raw",buildUrl:()=>`https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`, retries:0 },
      { name:"cors-anywhere", buildUrl:()=>`https://cors-anywhere.herokuapp.com/${apiUrl}`, retries:0 },
    ];

    const proxyMessages = {
      "cloudflare":     ["Checking NC BLAST server cache...", "Connecting to NC BLAST server...", "Last try on NC BLAST server..."],
      "allorigins":     ["Trying backup proxy..."],
      "corsproxy.io":   ["Switching to corsproxy.io..."],
      "allorigins-raw": ["Trying alternate route..."],
      "cors-anywhere":  ["Trying final fallback..."],
    };

    let lastErr = "";
    for(const proxy of proxyConfigs){
      let proxyAttempt = 0;
      try {
        setChallongeMsg(proxyMessages[proxy.name]?.[0] || `Trying ${proxy.name}...`);
        const text = await withRetry(async () => {
          setChallongeMsg(proxyMessages[proxy.name]?.[proxyAttempt] || "Retrying...");
          proxyAttempt++;
          return attempt(proxy.buildUrl());
        }, proxy.retries, 600);
        const { data, fromServerCache } = parseResponse(text, proxy.raw);
        const names = data.map(p=>(p.participant?.display_name||p.participant?.name||"").trim()).filter(Boolean);
        if(!names.length) throw new Error("No participants found — is this tournament public with entrants added?");
        const merged = [...new Set([...players,...names])];
        setPlayers(merged); sSave(KEYS.players, merged);
        lcSet(slug, names);
        // Build participant ID map — store both full name and truncated name as keys
        const participantMap = {};
        data.forEach(p => {
          const name = (p.participant?.display_name||p.participant?.name||"").trim();
          const id = p.participant?.id;
          if(name && id) {
            participantMap[name] = id;
            participantMap[tn(name)] = id;
            // Also map group_player_ids -> participant.id so group-stage submit works
            if(Array.isArray(p.participant?.group_player_ids)) {
              p.participant.group_player_ids.forEach(gid => {
                if(gid) participantMap[`__gid__${gid}`] = id;
              });
            }
          }
        });
        if(onChallongeImport) onChallongeImport(slug, participantMap);
        setChallongeStatus("ok");
        setChallongeSource(fromServerCache ? "cached" : "live");
        setChallongeMsg(fromServerCache
          ? `✓ ${names.length} players loaded from NC BLAST cache for "${slug}"`
          : `✓ ${names.length} players imported live from Challonge for "${slug}"`
        );
        // Refresh the cached list immediately so the dropdown reflects the new entry
        refreshCachedList();
        return;
      } catch(err) {
        lastErr = err.message;
        if(err.message.includes("HTTP 403")||err.message.includes("HTTP 404")||err.message.includes("No participants")) break;
      }
    }
    setChallongeStatus("error");
    setChallongeMsg("Direct import failed. You can still get names via CSV — see below.");
    setCsvFallback({names:[]});
  };

export const loadFromCache = async (slug) => {
    setCachedOpen(false);
    setChallongeStatus("loading");
    setChallongeMsg("Loading from NC BLAST server cache...");
    try {
      const res = await fetch(`https://challonge-proxy.danny61734.workers.dev/?slug=${slug}`, {
        signal: AbortSignal.timeout(8000),
      });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if(data.errors) throw new Error(data.errors[0]);
      const participants = data.participants || [];
      const names = participants.map(p=>(p.participant?.display_name||p.participant?.name||"").trim()).filter(Boolean);
      if(!names.length) throw new Error("No participants found in cache");
      const merged = [...new Set([...players,...names])];
      setPlayers(merged); sSave(KEYS.players, merged);
      const participantMap = {};
      participants.forEach(p => {
        const name = (p.participant?.display_name||p.participant?.name||"").trim();
        const id = p.participant?.id;
        if(name && id) {
          participantMap[name] = id;
          participantMap[tn(name)] = id;
          // Also map group_player_ids -> participant.id so group-stage submit works
          if(Array.isArray(p.participant?.group_player_ids)) {
            p.participant.group_player_ids.forEach(gid => {
              if(gid) participantMap[`__gid__${gid}`] = id;
            });
          }
        }
      });
      if(onChallongeImport) onChallongeImport(slug, participantMap);
      setChallongeStatus("ok");
      setChallongeSource(data.fromCache ? "cached" : "live");
      setChallongeMsg(data.fromCache
        ? `✓ ${names.length} players loaded from NC BLAST cache for "${slug}"`
        : `✓ ${names.length} players imported live from Challonge for "${slug}"`
      );
      // Refresh list so age timers stay current after loading
      refreshCachedList();
    } catch(err) {
      setChallongeStatus("error");
      setChallongeMsg(`Failed to load: ${err.message}`);
    }
  };

export const refreshCachedList = async () => {
    try {
      const res = await fetch("https://challonge-proxy.danny61734.workers.dev/list", {
        signal: AbortSignal.timeout(8000),
      });
      if(!res.ok) throw new Error("Failed");
      const data = await res.json();
      setCachedTournaments(Array.isArray(data.tournaments) ? data.tournaments : []);
    } catch {
      setCachedTournaments(prev => Array.isArray(prev) ? prev : []);
    }
  };