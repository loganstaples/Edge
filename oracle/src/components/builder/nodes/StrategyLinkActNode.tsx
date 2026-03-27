"use client";
import { memo, useEffect, useState } from "react";
import { NodeShell, useNodeConfig, selectClass, labelClass, inputClass } from "./NodeShell";

function StrategyLinkActNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;
  const [strategies, setStrategies] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/strategies")
      .then((r) => r.json())
      .then((data) => setStrategies(data?.strategies ?? []))
      .catch(() => {});
  }, []);

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Target Strategy</label>
          <select className={selectClass} value={config.target_strategy_id ?? ""} onChange={(e) => update("target_strategy_id", e.target.value)}>
            <option value="">Select strategy...</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Command</label>
          <select className={selectClass} value={config.command ?? "signal"} onChange={(e) => update("command", e.target.value)}>
            <option value="pause">Pause</option>
            <option value="resume">Resume</option>
            <option value="adjust_sizing">Adjust Sizing</option>
            <option value="signal">Send Signal</option>
          </select>
        </div>
        {config.command === "adjust_sizing" && (
          <div>
            <label className={labelClass}>Size Multiplier</label>
            <input className={inputClass} type="number" min={0.1} max={5} step={0.1} value={config.size_multiplier ?? 1} onChange={(e) => update("size_multiplier", Number(e.target.value))} />
          </div>
        )}
        {config.command === "signal" && (
          <div>
            <label className={labelClass}>Signal Value</label>
            <input className={inputClass} value={config.signal_value ?? ""} onChange={(e) => update("signal_value", e.target.value)} placeholder="Custom signal..." />
          </div>
        )}
        {lastOutput?.sla_target_name && (
          <div className="pt-1 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-edge-text font-medium truncate">{lastOutput.sla_target_name}</span>
              <span className={`px-1 py-0 rounded text-[8px] ${
                lastOutput.sla_target_status === "running" ? "bg-accent-green/20 text-accent-green" : "bg-edge-dim/20 text-edge-dim"
              }`}>
                {lastOutput.sla_target_status}
              </span>
            </div>
            {lastOutput.sla_last_command && (
              <div className="text-[8px] text-edge-dim">
                Last: {lastOutput.sla_last_command} · {new Date(lastOutput.sla_command_time).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const StrategyLinkActNode = memo(StrategyLinkActNodeComponent);
