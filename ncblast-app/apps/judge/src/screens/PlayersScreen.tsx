import { useEffect, useRef, useState } from "react";
import type {
  MatchConfig,
  ChallongeParticipantMap,
  CachedTournament,
} from "@ncblast/shared";
import { sSave, STORAGE_KEYS as KEYS, WORKER_BASE_URL } from "@ncblast/shared";
import { S } from "../styles";
import { IC } from "../components/Icons";
import { TournamentBadge } from "../components/TournamentBadge";
import { tn } from "../utils";

type ChallongeStatus = null | "loading" | "ok" | "error";
type ChallongeSource = null | "live" | "cached";

interface ChallongeParticipantWrap {
  participant?: {
    id?: number;
    name?: string;
    display_name?: string;
    group_player_ids?: number[];
  };
}

interface CsvFallback {
  names: string[];
}

export interface PlayersScreenProps {
  players: string[];
  setPlayers: (p: string[]) => void;
  onNext: () => void;
  onBack: () => void;
  onChallongeImport?: (slug: string, pmap: ChallongeParticipantMap) => void;
  config: MatchConfig;
  toggleDark?: () => void;
  dark?: boolean;
}

function hasKey<K extends string>(o: unknown, k: K): o is Record<K, unknown> {
  return typeof o === "object" && o !== null && k in o;
}

/**
 * SCREEN 2 — PLAYERS. Manual add, file import, Challonge live import via the
 * Cloudflare Worker (which holds the API key server-side as an encrypted env
 * var), CSV fallback, cached-tournaments dropdown with delete, clear all.
 */
export function PlayersScreen({
  players,
  setPlayers,
  onNext,
  onBack,
  onChallongeImport,
  config,
}: PlayersScreenProps) {
  const [inp, setInp] = useState("");
  const [challongeUrl, setChallongeUrl] = useState("");
  const [challongeStatus, setChallongeStatus] = useState<ChallongeStatus>(null);
  const [challongeMsg, setChallongeMsg] = useState("");
  const [challongeSource, setChallongeSource] = useState<ChallongeSource>(null);
  const [csvFallback, setCsvFallback] = useState<CsvFallback | null>(null);
  const [cachedTournaments, setCachedTournaments] = useState<
    "loading" | CachedTournament[] | null
  >(null);
  const [cachedOpen, setCachedOpen] = useState(false);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState<string | null>(
    null,
  );
  const csvRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const pRef = useRef<HTMLInputElement>(null);

  const add = () => {
    // Support pasting multiple names at once (newline or comma separated)
    const lines = inp
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;
    const next = [
      ...new Set([...players, ...lines.filter((l) => !players.includes(l))]),
    ];
    setPlayers(next);
    sSave(KEYS.players, next);
    setInp("");
  };

  const del = (i: number) => {
    const name = players[i];
    const n = players.filter((_, j) => j !== i);
    setPlayers(n);
    sSave(KEYS.players, n);
    // Remove saved combos for this player
    const saved = JSON.parse(
      localStorage.getItem(KEYS.combos) || "{}",
    ) as Record<string, unknown>;
    delete saved[name];
    sSave(KEYS.combos, saved);
  };
  const clearAll = () => {
    setPlayers([]);
    sSave(KEYS.players, []);
    sSave(KEYS.combos, {});
    setConfirmClear(false);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const txt = String(ev.target?.result || "");
      const lines = txt
        .split(/[\r\n,]+/)
        .map((l) => l.trim())
        .filter(Boolean);
      const m = [...new Set([...players, ...lines])];
      setPlayers(m);
      sSave(KEYS.players, m);
    };
    r.readAsText(f);
    e.target.value = "";
  };

  const refreshCachedList = async () => {
    try {
      const res = await fetch(`${WORKER_BASE_URL}/list`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error("Failed");
      const data: unknown = await res.json();
      if (hasKey(data, "tournaments") && Array.isArray(data.tournaments)) {
        setCachedTournaments(data.tournaments as CachedTournament[]);
      } else {
        setCachedTournaments([]);
      }
    } catch {
      setCachedTournaments((prev) => (Array.isArray(prev) ? prev : []));
    }
  };

  // Silently pre-fetch the cached list on mount so the dropdown is ready immediately
  useEffect(() => {
    refreshCachedList();
  }, []);

  const fetchCachedTournaments = async () => {
    setCachedTournaments("loading");
    setCachedOpen(false);
    try {
      const res = await fetch(`${WORKER_BASE_URL}/list`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data: unknown = await res.json();
      if (hasKey(data, "tournaments") && Array.isArray(data.tournaments)) {
        setCachedTournaments(data.tournaments as CachedTournament[]);
      } else {
        setCachedTournaments([]);
      }
      setCachedOpen(true);
    } catch {
      setCachedTournaments([]);
      setCachedOpen(true);
    }
  };

  const deleteCachedTournament = async (slug: string) => {
    setDeleteConfirmSlug(null);
    // Immediately remove from the visible list so the UI responds instantly
    setCachedTournaments((prev) =>
      Array.isArray(prev) ? prev.filter((t) => t.slug !== slug) : prev,
    );
    // Clear from device localStorage
    try {
      const store = JSON.parse(
        localStorage.getItem(KEYS.challongeCache) || "{}",
      ) as Record<string, unknown>;
      delete store[slug];
      localStorage.setItem(KEYS.challongeCache, JSON.stringify(store));
    } catch {
      /* ignore */
    }
    // Tell the Worker to delete from KV (fire and forget — UI already updated)
    try {
      await fetch(`${WORKER_BASE_URL}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      console.warn("Delete fetch failed:", (e as Error).message);
    }
    // Refresh after a short delay to confirm server state
    await new Promise((r) => setTimeout(r, 800));
    await refreshCachedList();
  };

  const loadFromCache = async (slug: string) => {
    setCachedOpen(false);
    setChallongeStatus("loading");
    setChallongeMsg("Loading from NC BLAST server cache...");
    try {
      const res = await fetch(
        `${WORKER_BASE_URL}/?slug=${encodeURIComponent(slug)}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      if (
        hasKey(data, "errors") &&
        Array.isArray(data.errors) &&
        data.errors.length
      ) {
        throw new Error(String(data.errors[0]));
      }
      const participants = (
        hasKey(data, "participants") && Array.isArray(data.participants)
          ? data.participants
          : []
      ) as ChallongeParticipantWrap[];
      const names = participants
        .map((p) =>
          (p.participant?.display_name || p.participant?.name || "").trim(),
        )
        .filter(Boolean);
      if (!names.length) throw new Error("No participants found in cache");
      // Replace roster entirely — don't merge with previous session's players
      setPlayers(names);
      sSave(KEYS.players, names);
      const participantMap: ChallongeParticipantMap = {};
      participants.forEach((p) => {
        const name = (
          p.participant?.display_name ||
          p.participant?.name ||
          ""
        ).trim();
        const id = p.participant?.id;
        if (name && id) {
          participantMap[name] = id;
          participantMap[tn(name)] = id;
          // Also map group_player_ids -> participant.id so group-stage submit works
          if (Array.isArray(p.participant?.group_player_ids)) {
            p.participant.group_player_ids.forEach((gid) => {
              if (gid) participantMap[`__gid__${gid}`] = id;
            });
          }
        }
      });
      if (onChallongeImport) onChallongeImport(slug, participantMap);
      setChallongeStatus("ok");
      const fromCache = hasKey(data, "fromCache")
        ? data.fromCache === true
        : false;
      setChallongeSource(fromCache ? "cached" : "live");
      setChallongeMsg(
        fromCache
          ? `✓ ${names.length} players loaded from NC BLAST cache for "${slug}"`
          : `✓ ${names.length} players imported live from Challonge for "${slug}"`,
      );
      // Refresh list so age timers stay current after loading
      refreshCachedList();
    } catch (err) {
      setChallongeStatus("error");
      setChallongeMsg(`Failed to load: ${(err as Error).message}`);
    }
  };

  const importChallonge = async () => {
    const raw = challongeUrl.trim();
    let slug = "";
    try {
      const url = new URL(raw.startsWith("http") ? raw : "https://" + raw);
      const cleanPath = url.pathname.replace(
        /\/(participants|standings|teams|matches).*$/i,
        "",
      );
      const parts = cleanPath
        .replace(/^\/|\/$/g, "")
        .split("/")
        .filter(Boolean);
      const subdomain = url.hostname.split(".")[0];
      const isCommunity = subdomain !== "challonge" && subdomain !== "www";
      const pathSlug = parts[parts.length - 1] || parts[0];
      slug = isCommunity ? `${subdomain}-${pathSlug}` : pathSlug;
    } catch {
      slug =
        raw
          .replace(/.*challonge\.com\//, "")
          .replace(/\/(participants|standings).*/i, "")
          .replace(/\/$/, "")
          .split("/")
          .pop() || "";
    }
    if (!slug) {
      setChallongeStatus("error");
      setChallongeMsg("Couldn't read a tournament slug from that URL.");
      return;
    }

    setChallongeStatus("loading");
    setChallongeMsg("Checking NC BLAST server cache...");
    // Challonge API key lives only on the Cloudflare Worker — never shipped to the browser.

    // ── Device-level localStorage cache (30 min TTL) ─────────────────────────
    const LC_KEY = KEYS.challongeCache;
    const LC_TTL = 30 * 60 * 1000;
    const lcGet = (s: string): string[] | null => {
      try {
        const store = JSON.parse(
          localStorage.getItem(LC_KEY) || "{}",
        ) as Record<string, { names: string[]; fetchedAt: number }>;
        const e = store[s];
        if (e && Date.now() - e.fetchedAt < LC_TTL) return e.names;
      } catch {
        /* ignore */
      }
      return null;
    };
    const lcSet = (s: string, names: string[]): void => {
      try {
        const store = JSON.parse(
          localStorage.getItem(LC_KEY) || "{}",
        ) as Record<string, { names: string[]; fetchedAt: number }>;
        store[s] = { names, fetchedAt: Date.now() };
        Object.keys(store).forEach((k) => {
          if (Date.now() - store[k].fetchedAt >= LC_TTL) delete store[k];
        });
        localStorage.setItem(LC_KEY, JSON.stringify(store));
      } catch {
        /* ignore */
      }
    };

    // Device cache hit — zero network calls
    const lcHit = lcGet(slug);
    if (lcHit) {
      // Replace roster entirely on cache hit
      setPlayers(lcHit);
      sSave(KEYS.players, lcHit);
      setChallongeStatus("ok");
      setChallongeSource("cached");
      setChallongeMsg(
        `✓ ${lcHit.length} players loaded from NC BLAST cache for "${slug}"`,
      );
      return;
    }

    // Helper: parse response — Cloudflare Worker returns { participants:[], fromCache:bool }
    const parseResponse = (
      text: string,
      raw: boolean,
    ): { data: ChallongeParticipantWrap[]; fromServerCache: boolean } => {
      const wrapper: unknown = JSON.parse(text);
      let data: unknown =
        !raw &&
        wrapper &&
        typeof wrapper === "object" &&
        "contents" in wrapper &&
        (wrapper as { contents?: string }).contents !== undefined
          ? JSON.parse((wrapper as { contents: string }).contents)
          : wrapper;
      if (!data) throw new Error("Empty response");
      if (hasKey(data, "errors") && data.errors) {
        const errs = data.errors;
        throw new Error(Array.isArray(errs) ? errs.join(", ") : String(errs));
      }
      let fromServerCache = false;
      if (hasKey(data, "participants")) {
        fromServerCache = hasKey(data, "fromCache")
          ? data.fromCache === true
          : false;
        data = data.participants;
      }
      if (!Array.isArray(data)) throw new Error("Unexpected response format");
      return { data: data as ChallongeParticipantWrap[], fromServerCache };
    };

    const attempt = async (url: string, timeout = 10000): Promise<string> => {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    };

    const withRetry = async <T,>(
      fn: () => Promise<T>,
      retries = 2,
      delayMs = 800,
    ): Promise<T> => {
      let lastErr: unknown;
      for (let i = 0; i <= retries; i++) {
        try {
          return await fn();
        } catch (e) {
          lastErr = e;
          if (i < retries)
            await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
        }
      }
      throw lastErr;
    };

    // Cloudflare Worker only — the Worker holds the Challonge API key server-side
    // and proxies all requests. Public CORS-proxy fallbacks were removed to avoid
    // ever shipping the API key in client JS.
    const proxyConfigs: Array<{
      name: string;
      buildUrl: () => string;
      raw?: boolean;
      retries: number;
    }> = [
      {
        name: "cloudflare",
        buildUrl: () => `${WORKER_BASE_URL}/?slug=${encodeURIComponent(slug)}`,
        raw: true,
        retries: 2,
      },
    ];

    const proxyMessages: Record<string, string[]> = {
      cloudflare: [
        "Checking NC BLAST server cache...",
        "Connecting to NC BLAST server...",
        "Last try on NC BLAST server...",
      ],
    };

    for (const proxy of proxyConfigs) {
      let proxyAttempt = 0;
      try {
        setChallongeMsg(
          proxyMessages[proxy.name]?.[0] || `Trying ${proxy.name}...`,
        );
        const text = await withRetry(
          async () => {
            setChallongeMsg(
              proxyMessages[proxy.name]?.[proxyAttempt] || "Retrying...",
            );
            proxyAttempt++;
            return attempt(proxy.buildUrl());
          },
          proxy.retries,
          600,
        );
        const { data, fromServerCache } = parseResponse(
          text,
          proxy.raw || false,
        );
        const names = data
          .map((p) =>
            (p.participant?.display_name || p.participant?.name || "").trim(),
          )
          .filter(Boolean);
        if (!names.length)
          throw new Error(
            "No participants found — is this tournament public with entrants added?",
          );
        // Replace roster entirely — don't carry over names from a previous event
        setPlayers(names);
        sSave(KEYS.players, names);
        lcSet(slug, names);
        // Build participant ID map — store both full name and truncated name as keys
        const participantMap: ChallongeParticipantMap = {};
        data.forEach((p) => {
          const name = (
            p.participant?.display_name ||
            p.participant?.name ||
            ""
          ).trim();
          const id = p.participant?.id;
          if (name && id) {
            participantMap[name] = id;
            participantMap[tn(name)] = id;
            // Also map group_player_ids -> participant.id so group-stage submit works
            if (Array.isArray(p.participant?.group_player_ids)) {
              p.participant.group_player_ids.forEach((gid) => {
                if (gid) participantMap[`__gid__${gid}`] = id;
              });
            }
          }
        });
        if (onChallongeImport) onChallongeImport(slug, participantMap);
        setChallongeStatus("ok");
        setChallongeSource(fromServerCache ? "cached" : "live");
        setChallongeMsg(
          fromServerCache
            ? `✓ ${names.length} players loaded from NC BLAST cache for "${slug}"`
            : `✓ ${names.length} players imported live from Challonge for "${slug}"`,
        );
        // Refresh the cached list immediately so the dropdown reflects the new entry
        refreshCachedList();
        return;
      } catch (err) {
        const msg = (err as Error).message || "";
        if (
          msg.includes("HTTP 403") ||
          msg.includes("HTTP 404") ||
          msg.includes("No participants")
        )
          break;
      }
    }
    setChallongeStatus("error");
    setChallongeMsg(
      "Direct import failed. You can still get names via CSV — see below.",
    );
    setCsvFallback({ names: [] });
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const text = String(ev.target?.result || "");
      const lines = text.split(/[\r\n]+/).filter(Boolean);
      if (!lines.length) return;
      const header = lines[0]
        .split(",")
        .map((h) => h.replace(/"/g, "").trim().toLowerCase());
      const nameCol = header.findIndex(
        (h) => h.includes("name") || h.includes("display"),
      );
      const names = lines
        .slice(1)
        .map((line) => {
          const cols = line.split(",").map((c) => c.replace(/"/g, "").trim());
          return nameCol >= 0 ? cols[nameCol] : cols[0];
        })
        .filter(Boolean);
      setCsvFallback({ names });
    };
    r.readAsText(f);
    e.target.value = "";
  };

  return (
    <div style={{ ...S.current.page, height: "100dvh", overflowY: "auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <button style={{ ...S.current.back, marginBottom: 0 }} onClick={onBack}>
          {IC.back} Format
        </button>
        <TournamentBadge config={config} />
      </div>
      <h1 style={S.current.title}>Player Roster</h1>
      <p style={S.current.sub}>Players are saved between sessions</p>

      {/* Challonge import */}
      <div
        style={{
          ...S.current.card,
          border: "2px solid #E4600040",
          background: "#FFF7ED",
          marginBottom: 12,
        }}
      >
        <h2 style={{ ...S.current.label, color: "#C2410C", marginBottom: 8 }}>
          Import from Challonge
        </h2>

        {/* Cached tournaments dropdown */}
        <div style={{ marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => {
              if (cachedOpen) {
                setCachedOpen(false);
              } else {
                fetchCachedTournaments();
              }
              refreshCachedList();
            }}
            disabled={cachedTournaments === "loading"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "9px 12px",
              borderRadius: 10,
              border: "2px solid #7C3AED30",
              background: "#F5F3FF",
              color: "#6D28D9",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "'Outfit',sans-serif",
              cursor:
                cachedTournaments === "loading" ? "not-allowed" : "pointer",
              opacity: cachedTournaments === "loading" ? 0.7 : 1,
            }}
          >
            <span>
              {cachedTournaments === "loading"
                ? "⏳ Checking server cache..."
                : "⚡ Cached Tournaments"}
            </span>
            {cachedTournaments !== "loading" && (
              <span style={{ fontSize: 10, opacity: 0.7 }}>
                {cachedOpen ? "▲ Hide" : "▼ Show"}
              </span>
            )}
          </button>
          {cachedOpen && (
            <div
              style={{
                marginTop: 4,
                border: "2px solid #7C3AED20",
                borderRadius: 10,
                background: "var(--surface)",
                overflow: "hidden",
              }}
            >
              {/* Delete confirmation modal */}
              {deleteConfirmSlug && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(15,23,42,0.5)",
                    zIndex: 400,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 24px",
                  }}
                >
                  <div
                    style={{
                      background: "var(--surface)",
                      borderRadius: 18,
                      padding: "24px 20px",
                      maxWidth: 320,
                      width: "100%",
                      boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: "var(--text-primary)",
                        marginBottom: 8,
                        textAlign: "center",
                      }}
                    >
                      Delete Cache?
                    </p>
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        textAlign: "center",
                        marginBottom: 6,
                        lineHeight: 1.5,
                      }}
                    >
                      This will remove{" "}
                      <strong style={{ color: "#DC2626" }}>
                        {deleteConfirmSlug}
                      </strong>{" "}
                      from the server cache for all devices.
                    </p>
                    <p
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        textAlign: "center",
                        marginBottom: 20,
                        lineHeight: 1.4,
                      }}
                    >
                      Players can still be imported again by pasting the
                      Challonge URL.
                    </p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmSlug(null)}
                        style={{
                          flex: 1,
                          padding: "12px 0",
                          borderRadius: 10,
                          border: "2px solid var(--border)",
                          background: "var(--surface)",
                          color: "var(--text-secondary)",
                          fontSize: 13,
                          fontWeight: 700,
                          fontFamily: "'Outfit',sans-serif",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          deleteCachedTournament(deleteConfirmSlug)
                        }
                        style={{
                          flex: 1,
                          padding: "12px 0",
                          borderRadius: 10,
                          border: "none",
                          background: "#DC2626",
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 700,
                          fontFamily: "'Outfit',sans-serif",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {Array.isArray(cachedTournaments) &&
                cachedTournaments.length === 0 && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      fontWeight: 500,
                      padding: "12px 14px",
                      margin: 0,
                      fontStyle: "italic",
                    }}
                  >
                    No tournaments currently cached. Import one via the URL
                    field below.
                  </p>
                )}
              {Array.isArray(cachedTournaments) &&
                cachedTournaments.map((t, ti) => {
                  const minsAgo = Math.floor(t.ageSeconds / 60);
                  const minsLeft = Math.max(0, 30 - minsAgo);
                  return (
                    <div
                      key={ti}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        borderTop: ti > 0 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => loadFromCache(t.slug)}
                        style={{
                          flex: 1,
                          padding: "10px 14px",
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "'Outfit',sans-serif",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "var(--text-primary)",
                          }}
                        >
                          {t.slug}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                            marginTop: 1,
                          }}
                        >
                          {t.participantCount} players · cached {minsAgo}m ago ·
                          expires in {minsLeft}m
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmSlug(t.slug)}
                        style={{
                          padding: "10px 12px",
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          color: "#DC2626",
                          opacity: 0.6,
                          flexShrink: 0,
                        }}
                        title="Delete from cache"
                      >
                        {IC.trash}
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            style={{
              ...S.current.inp,
              flex: 1,
              borderColor: "#EA580C40",
              fontSize: 12,
            }}
            placeholder="https://ncbl.challonge.com/TOURNAMENTNAME/participants"
            value={challongeUrl}
            onChange={(e) => {
              setChallongeUrl(e.target.value);
              setChallongeStatus(null);
              setCsvFallback(null);
              setChallongeSource(null);
            }}
            onKeyDown={(e) =>
              e.key === "Enter" && challongeUrl.trim() && importChallonge()
            }
          />
          <button
            onClick={importChallonge}
            disabled={!challongeUrl.trim() || challongeStatus === "loading"}
            style={{
              padding: "0 14px",
              borderRadius: 10,
              border: "none",
              background: challongeUrl.trim() ? "#EA580C" : "#CBD5E1",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "'Outfit',sans-serif",
              cursor: challongeUrl.trim() ? "pointer" : "not-allowed",
              flexShrink: 0,
            }}
          >
            {challongeStatus === "loading" ? "..." : "Import"}
          </button>
        </div>
        {challongeStatus === "ok" && (
          <p
            style={{
              fontSize: 11,
              color: "#15803D",
              fontWeight: 600,
              marginTop: 4,
            }}
          >
            ✓ {challongeMsg}
          </p>
        )}
        {challongeStatus === "ok" && challongeSource && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              marginTop: 5,
              padding: "3px 9px",
              borderRadius: 20,
              border: "1px solid",
              borderColor:
                challongeSource === "cached" ? "#7C3AED40" : "#15803D40",
              background: challongeSource === "cached" ? "#F5F3FF" : "#F0FDF4",
            }}
          >
            <span style={{ fontSize: 10 }}>
              {challongeSource === "cached" ? "⚡" : "🌐"}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: challongeSource === "cached" ? "#6D28D9" : "#15803D",
              }}
            >
              {challongeSource === "cached"
                ? "Served from NC BLAST cache"
                : "Live from Challonge API"}
            </span>
          </div>
        )}
        {challongeStatus === "error" && (
          <p
            style={{
              fontSize: 11,
              color: "#DC2626",
              fontWeight: 600,
              lineHeight: 1.5,
              marginTop: 4,
            }}
          >
            {challongeMsg}
          </p>
        )}
        {challongeStatus === "loading" && (
          <p
            style={{
              fontSize: 11,
              color: "#C2410C",
              fontWeight: 600,
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            ⏳ {challongeMsg}
          </p>
        )}
        {!challongeStatus && (
          <p style={S.current.hint}>e.g. ncbl.challonge.com/TOURNAMENT</p>
        )}

        {/* CSV fallback — shown after all proxies fail */}
        {csvFallback && (
          <div
            style={{
              marginTop: 10,
              borderTop: "1px solid #FED7AA",
              paddingTop: 10,
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#C2410C",
                marginBottom: 6,
              }}
            >
              📋 Manual CSV Fallback
            </p>
            <p
              style={{
                fontSize: 11,
                color: "#92400E",
                marginBottom: 8,
                lineHeight: 1.5,
              }}
            >
              In Challonge, go to your tournament →{" "}
              <strong>Participants</strong> tab → <strong>Export</strong> →
              download the CSV. Then upload it here:
            </p>
            <input
              type="file"
              ref={csvRef}
              accept=".csv,.txt"
              style={{ display: "none" }}
              onChange={handleCsvFile}
            />
            {csvFallback.names.length === 0 ? (
              <button
                onClick={() => csvRef.current?.click()}
                style={{ ...S.current.upBtn, marginBottom: 0 }}
              >
                📂 Upload Challonge CSV export
              </button>
            ) : (
              <div>
                <p
                  style={{
                    fontSize: 11,
                    color: "#15803D",
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  ✓ Found {csvFallback.names.length} names — copy all and paste
                  into Add Players:
                </p>
                <div style={{ position: "relative" }}>
                  <textarea
                    readOnly
                    value={csvFallback.names.join(", ")}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "2px solid #15803D40",
                      background: "#F0FDF4",
                      color: "#14532D",
                      fontSize: 11,
                      fontFamily: "'Outfit',sans-serif",
                      resize: "none",
                      height: 72,
                      outline: "none",
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(csvFallback.names.join(", "))
                        .catch(() => {});
                    }}
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: "none",
                      background: "#15803D",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: "'Outfit',sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    Copy
                  </button>
                </div>
                <button
                  onClick={() => {
                    const merged = [
                      ...new Set([...players, ...csvFallback.names]),
                    ];
                    setPlayers(merged);
                    sSave(KEYS.players, merged);
                    setChallongeStatus("ok");
                    setChallongeMsg(
                      `✓ ${csvFallback.names.length} players added from CSV`,
                    );
                    setCsvFallback(null);
                  }}
                  style={{
                    ...S.current.pri,
                    marginTop: 8,
                    fontSize: 12,
                    padding: "10px 0",
                  }}
                >
                  Add All to Roster →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual add */}
      <div style={S.current.card}>
        <h2 style={S.current.label}>Add Players</h2>
        <div style={S.current.addR}>
          <input
            style={S.current.inp}
            placeholder="Name, or paste multiple names..."
            value={inp}
            onChange={(e) => setInp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && inp.trim() && add()}
            onPaste={(e) => {
              // On paste, immediately parse and add all pasted names
              e.preventDefault();
              const pasted = e.clipboardData.getData("text");
              const lines = pasted
                .split(/[\n\r,]+/)
                .map((l) => l.trim())
                .filter(Boolean);
              if (lines.length > 1) {
                const next = [
                  ...new Set([
                    ...players,
                    ...lines.filter((l) => !players.includes(l)),
                  ]),
                ];
                setPlayers(next);
                sSave(KEYS.players, next);
              } else {
                setInp((prev) => prev + pasted);
              }
            }}
          />
          <button
            style={{ ...S.current.addB, background: "#1D4ED8" }}
            onClick={add}
          >
            {IC.plus}
          </button>
        </div>
        <p style={S.current.hint}>
          Paste multiple names separated by commas or new lines to add them all
          at once
        </p>
        <input
          type="file"
          ref={pRef}
          accept=".csv,.txt"
          style={{ display: "none" }}
          onChange={onFile}
        />
        <button style={S.current.upBtn} onClick={() => pRef.current?.click()}>
          {IC.upload} Import from File
        </button>
      </div>

      {/* Roster */}
      <div style={S.current.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <h2 style={{ ...S.current.label, margin: 0 }}>
            Roster ({players.length})
          </h2>
          {players.length > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              style={{
                background: "none",
                border: "none",
                color: "#EF4444",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'Outfit',sans-serif",
                cursor: "pointer",
                opacity: 0.7,
              }}
            >
              Clear all
            </button>
          )}
        </div>
        {players.length === 0 && <p style={S.current.empty}>No players yet</p>}
        <div style={S.current.chs}>
          {[...players]
            .sort((a, b) => a.localeCompare(b))
            .map((p) => (
              <span
                key={p}
                style={{
                  ...S.current.ptag,
                  borderColor: "#1D4ED840",
                  background: "#1D4ED80C",
                  color: "#1D4ED8",
                }}
              >
                {p}
                <button
                  style={S.current.xBtn}
                  onClick={() => del(players.indexOf(p))}
                >
                  {IC.trash}
                </button>
              </span>
            ))}
        </div>
      </div>

      <button
        style={{ ...S.current.pri, opacity: players.length >= 2 ? 1 : 0.4 }}
        disabled={players.length < 2}
        onClick={onNext}
      >
        Start Matches →
      </button>
      {players.length < 2 && (
        <p style={S.current.hint}>Need at least 2 players</p>
      )}

      {/* In-app clear all confirmation modal */}
      {confirmClear && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.5)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 18,
              padding: "24px 20px",
              maxWidth: 320,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              border: "1px solid var(--border)",
            }}
          >
            <p
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "var(--text-primary)",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              Clear Roster?
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                textAlign: "center",
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              This will remove all{" "}
              <strong style={{ color: "#EF4444" }}>
                {players.length} players
              </strong>{" "}
              from the roster. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirmClear(false)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 10,
                  border: "2px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "'Outfit',sans-serif",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={clearAll}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 10,
                  border: "none",
                  background: "#EF4444",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "'Outfit',sans-serif",
                  cursor: "pointer",
                }}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
