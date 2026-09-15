// Shared identity for the four DEFENSE SYSTEMS buttons — used by the store
// (state + shared handler), the panel (buttons), and the Groq tool schema
// (voice commands), so all three stay in sync on one source of truth.
export type DefenseKey = "shield" | "power" | "signal" | "reactor";

export const DEFENSE_KEYS: readonly DefenseKey[] = ["shield", "power", "signal", "reactor"];

export const DEFENSE_LABELS: Record<DefenseKey, string> = {
  shield: "Shield",
  power: "Power Grid",
  signal: "Uplink",
  reactor: "Reactor",
};

export function isDefenseKey(value: unknown): value is DefenseKey {
  return typeof value === "string" && (DEFENSE_KEYS as readonly string[]).includes(value);
}
