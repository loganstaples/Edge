"use client";
import { memo, useEffect, useState } from "react";
import { NodeShell, useNodeConfig, selectClass, labelClass, ContextOnlyToggle } from "./NodeShell";

function StrategyLinkNodeComponent({ id, type, data, selected }: any) {
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
    <NodeShell id={id} type={type} selected={selected} status={data?.status} isActive={data?.isActive}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Linked Strategy</label>
          <select className={selectClass} value={config.strategy_id ?? ""} onChange={(e) => update("strategy_id", e.target.value)}>
            <option value="">Select strategy...</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <ContextOnlyToggle checked={config.context_only ?? false} onChange={(v) => update("context_only", v)} />
        {lastOutput?.linked_strategy_name && (
          <div className="text-[9px] space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-edge-text font-medium truncate">{lastOutput.linked_strategy_name}</span>
              <span className={`px-1 py-0 rounded text-[8px] ${
                lastOutput.linked_status === "running" ? "bg-accent-green/20 text-accent-green" : "bg-edge-dim/20 text-edge-dim"
              }`}>
                {lastOutput.linked_status}
              </span>
            </div>
            <div className="text-edge-muted/60 flex gap-2">
              <span className={lastOutput.linked_signal === "bullish" ? "text-accent-green" : lastOutput.linked_signal === "bearish" ? "text-accent-red" : "text-edge-dim"}>
                {lastOutput.linked_signal}
              </span>
              <span>PnL: {lastOutput.linked_pnl >= 0 ? "+" : ""}{lastOutput.linked_pnl?.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const StrategyLinkNode = memo(StrategyLinkNodeComponent);
