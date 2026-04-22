import { splitPartName } from "../utils";

export interface PartLabelProps {
  name: string;
  size?: number | null;
  keepDash?: boolean;
}

/**
 * Render a part name in a button: multi-line if 2+ words, sized to fill space.
 * Mirrors the source `PartLabel` component.
 */
export function PartLabel({ name, size, keepDash }: PartLabelProps) {
  const words = splitPartName(name, keepDash);
  if (words.length === 1) {
    return <span style={{ fontSize: size || 13, fontWeight: 800, lineHeight: 1.1, textAlign: "center" }}>{name}</span>;
  }
  return (
    <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, lineHeight: 1.1, textAlign: "center" }}>
      {words.map((w, i) => (<span key={i} style={{ fontSize: size || 13, fontWeight: 800 }}>{w}</span>))}
    </span>
  );
}
