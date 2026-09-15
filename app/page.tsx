"use client";

import { useState } from "react";
import ArmorStatusPanel from "@/components/hud/ArmorStatusPanel";
import CoreRadar from "@/components/hud/CoreRadar";
import NetworkPanel from "@/components/hud/NetworkPanel";
import ResourceMonitorPanel from "@/components/hud/ResourceMonitorPanel";
import SystemLogPanel from "@/components/hud/SystemLogPanel";
import TerminalPanel from "@/components/hud/TerminalPanel";
import TopBar from "@/components/hud/TopBar";
import VitalSignsPanel from "@/components/hud/VitalSignsPanel";
import VoiceBar from "@/components/hud/VoiceBar";
import { pushLog } from "@/lib/logBus";
import { pickBootLine } from "@/lib/persona";
import { useJarvisStore } from "@/lib/store";
import { useMetrics } from "@/lib/useMetrics";
import { useVoicePipeline } from "@/lib/useVoicePipeline";

function SoundGate({ onEnable }: { onEnable: () => void }) {
  return (
    <button
      onClick={onEnable}
      className="absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-full border px-4 py-1.5 text-[10px] uppercase tracking-[0.12em] text-cyan transition hover:bg-cyan/10"
      style={{ borderColor: "var(--panel-border)", background: "var(--panel)" }}
    >
      Enable Audio
    </button>
  );
}

export default function Page() {
  const { toggleListening, playBoot } = useVoicePipeline();
  const soundEnabled = useJarvisStore((s) => s.soundEnabled);
  const enableSound = useJarvisStore((s) => s.enableSound);
  const [gateVisible, setGateVisible] = useState(true);

  useMetrics();

  function handleEnableSound() {
    enableSound();
    setGateVisible(false);
    pushLog("System integrity check complete.");
    playBoot(pickBootLine());
  }

  return (
    // Below md (768px) the page is a normal scrolling single column with a
    // fixed mic bar at the bottom; at md+ it's the fixed-viewport HUD grid.
    <main className="relative flex min-h-screen flex-col gap-4 p-4 pb-28 md:h-screen md:overflow-hidden md:p-5 md:pb-5">
      {!soundEnabled && gateVisible && <SoundGate onEnable={handleEnableSound} />}

      <TopBar />

      <div className="flex min-w-0 flex-1 flex-col gap-4 md:grid md:min-h-0 md:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 md:col-span-3 md:min-h-0">
          <div className="md:flex-[1.2]">
            <VitalSignsPanel />
          </div>
          <div className="md:flex-1">
            <ResourceMonitorPanel />
          </div>
          <div className="md:flex-1">
            <NetworkPanel />
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-center gap-4 md:col-span-6 md:min-h-0 md:justify-between">
          <div className="w-full md:flex md:flex-1 md:items-center md:justify-center">
            <CoreRadar />
          </div>
          {/* Mic control is docked at md+; below md it moves to the fixed
              bottom bar so it stays reachable while the page scrolls. */}
          <div className="hidden pb-4 md:flex">
            <VoiceBar onToggle={toggleListening} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:col-span-3 md:min-h-0">
          <div className="md:flex-1">
            <ArmorStatusPanel />
          </div>
          <div className="md:flex-[1.4]">
            <SystemLogPanel />
          </div>
          <div className="md:flex-1">
            <TerminalPanel />
          </div>
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:hidden"
        style={{ borderColor: "var(--panel-border)", background: "var(--panel)" }}
      >
        <VoiceBar onToggle={toggleListening} />
      </div>
    </main>
  );
}
