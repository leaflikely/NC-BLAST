import type { MatchConfig } from "@ncblast/shared";

export interface TournamentBadgeProps {
  config?: MatchConfig | null;
}

/** Small purple "Tournament Mode" badge — only shown when config.tm is true. */
export function TournamentBadge({ config }: TournamentBadgeProps) {
  if (!config?.tm) return null;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: "#7C3AED",
        color: "#fff",
        borderRadius: 20,
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.5,
        fontFamily: "'Outfit',sans-serif",
      }}
    >
      🏆 Tournament Mode
    </div>
  );
}
