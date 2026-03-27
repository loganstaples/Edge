"use client";
import { memo } from "react";
import { NodeShell, useNodeConfig, selectClass, labelClass, inputClass } from "./NodeShell";

function CooldownGateNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Cooldown Period</label>
          <select className={selectClass} value={config.period ?? "300"} onChange={(e) => update("period", e.target.value)}>
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
            <option value="300">5 minutes</option>
            <option value="900">15 minutes</option>
            <option value="3600">1 hour</option>
            <option value="14400">4 hours</option>
            <option value="86400">24 hours</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Max Triggers / Window</label>
          <input className={inputClass} type="number" min={1} max={100} value={config.max_triggers ?? 3} onChange={(e) => update("max_triggers", Number(e.target.value))} />
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-edge-muted/70">
          <input type="checkbox" checked={config.reset_on_reversal ?? false} onChange={(e) => update("reset_on_reversal", e.target.checked)} className="w-3 h-3 rounded bg-white/[0.04] border border-white/[0.06]" />
          Reset on direction change
        </label>
        {lastOutput != null && (
          <div className="flex items-center gap-2">
            {/* Circular cooldown indicator */}
            <div className="relative w-8 h-8 flex-shrink-0">
              <svg viewBox="0 0 32 32" className="w-full h-full -rotate-90">
                <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
                <circle
                  cx="16" cy="16" r="13" fill="none"
                  stroke={lastOutput.cg_status === "passing" ? "#4ade80" : lastOutput.cg_status === "blocked" ? "#f87171" : "#fbbf24"}
                  strokeWidth="2"
                  strokeDasharray={`${(lastOutput.cg_cooldown_pct ?? 0) * 81.68} 81.68`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-edge-muted">
                {lastOutput.cg_remaining ?? 0}
              </div>
            </div>
            <div className="text-[9px] space-y-0.5">
              <div className={`font-medium ${
                lastOutput.cg_status === "passing" ? "text-accent-green" :
                lastOutput.cg_status === "blocked" ? "text-accent-red" : "text-accent-amber"
              }`}>
                {lastOutput.cg_status === "passing" ? "Passing" : lastOutput.cg_status === "blocked" ? "Blocked" : "Cooling down"}
              </div>
              <div className="text-edge-dim">{lastOutput.cg_triggers_remaining ?? "?"} triggers left</div>
            </div>
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const CooldownGateNode = memo(CooldownGateNodeComponent);
