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
    <main className="relative flex h-screen flex-col gap-4 p-5">
      {!soundEnabled && gateVisible && <SoundGate onEnable={handleEnableSound} />}

      <TopBar />

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <div className="col-span-12 flex min-h-0 flex-col gap-4 lg:col-span-3">
          <div className="flex-[1.2]">
            <VitalSignsPanel />
          </div>
          <div className="flex-1">
            <ResourceMonitorPanel />
          </div>
          <div className="flex-1">
            <NetworkPanel />
          </div>
        </div>

        <div className="col-span-12 flex min-h-0 flex-col items-center justify-between lg:col-span-6">
          <div className="flex w-full flex-1 items-center justify-center">
            <CoreRadar />
          </div>
          <div className="pb-4">
            <VoiceBar onToggle={toggleListening} />
          </div>
        </div>

        <div className="col-span-12 flex min-h-0 flex-col gap-4 lg:col-span-3">
          <div className="flex-1">
            <ArmorStatusPanel />
          </div>
          <div className="flex-[1.4]">
            <SystemLogPanel />
          </div>
          <div className="flex-1">
            <TerminalPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
