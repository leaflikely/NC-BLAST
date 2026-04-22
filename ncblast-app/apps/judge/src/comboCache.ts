import { pushCombos, getCombos, COMBO_CACHE_TTL } from "@ncblast/shared";
import type { Combo } from "@ncblast/shared";

export { COMBO_CACHE_TTL };

/** Re-exported Worker KV helpers with the names used in the source code. */
export const pushComboCacheToWorker: (playerName: string, combos: Combo[]) => Promise<void> = pushCombos;
export const fetchComboCacheFromWorker: (playerName: string) => Promise<Combo[]> = getCombos;
