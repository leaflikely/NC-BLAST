import { useEffect, useState, type CSSProperties } from "react";

export interface JudgeInputProps {
  value: string;
  onCommit: (v: string) => void;
  onClear?: () => void;
  style?: CSSProperties;
  placeholder?: string;
}

/**
 * JUDGE INPUT — local state so parent re-renders don't blur it.
 * Commits on blur or Enter; clears local state when parent clears value externally.
 */
export function JudgeInput({
  value,
  onCommit,
  onClear: _onClear,
  style,
  placeholder,
}: JudgeInputProps) {
  const [local, setLocal] = useState(value || "");
  // Sync if parent clears it externally
  useEffect(() => {
    if (!value) setLocal("");
  }, [value]);
  return (
    <input
      autoFocus
      style={style}
      placeholder={placeholder || "Enter judge name..."}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local.trim()) onCommit(local.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && local.trim()) {
          onCommit(local.trim());
        }
      }}
    />
  );
}
