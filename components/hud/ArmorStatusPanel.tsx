"use client";

import Panel from "./Panel";
import { ARMOR_TAG } from "@/lib/config";
import { useDecorativeDrift } from "@/lib/decorative";
import { DEFENSE_KEYS, DEFENSE_LABELS, type DefenseKey } from "@/lib/defenseSystems";
import { useJarvisStore } from "@/lib/store";

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z" />
    </svg>
  );
}
function ReactorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" strokeLinejoin="round" />
    </svg>
  );
}
function SignalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 18h2v-4H4v4zM9 18h2v-8H9v8zM14 18h2v-12h-2v12zM19 18h2v-16h-2v16z" />
    </svg>
  );
}
function PowerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 2v8" strokeLinecap="round" />
      <path d="M6 6a8 8 0 1 0 12 0" strokeLinecap="round" />
    </svg>
  );
}
const ICONS: Record<DefenseKey, () => JSX.Element> = {
  shield: ShieldIcon,
  power: PowerIcon,
  signal: SignalIcon,
  reactor: ReactorIcon,
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="hud-label">{label}</span>
        <span className="hud-value text-[13px]">{Math.round(value)}%</span>
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ background: "var(--grid-line)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: "var(--cyan)", boxShadow: "1px 0 6px 1px rgba(var(--cyan-rgb),0.7)" }}
        />
      </div>
    </div>
  );
}

export default function ArmorStatusPanel() {
  const powerCore = useDecorativeDrift(98, 92, 100, 0.4, 2600); // decorative
  const structural = useDecorativeDrift(100, 96, 100, 0.15, 3000); // decorative
  const defenseSystems = useJarvisStore((s) => s.defenseSystems);
  const setDefenseSystem = useJarvisStore((s) => s.setDefenseSystem);

  return (
    <Panel tag={ARMOR_TAG} redactedLabel="SUIT TELEMETRY // LOCKED" className="h-full">
      <Stat label="Power Core" value={powerCore} />
      <Stat label="Structural" value={structural} />

      <div className="mt-2 hud-label">Defense Systems</div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {DEFENSE_KEYS.map((key) => {
          const Icon = ICONS[key];
          const on = defenseSystems[key];
          return (
            <button
              key={key}
              // Same handler a voice command hits — button and voice can
              // never fall out of sync.
              onClick={() => setDefenseSystem(key, !on)}
              aria-pressed={on}
              aria-label={DEFENSE_LABELS[key]}
              className="flex aspect-square items-center justify-center rounded-[2px] border transition"
              style={{
                borderColor: on ? "var(--cyan)" : "var(--panel-border)",
                color: on ? "var(--cyan)" : "var(--cyan-dim)",
                boxShadow: on ? "0 0 8px rgba(var(--cyan-rgb),0.5)" : "none",
              }}
            >
              <Icon />
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
