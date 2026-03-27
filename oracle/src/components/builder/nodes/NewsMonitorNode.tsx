"use client";
import { memo } from "react";
import { NodeShell, useNodeConfig, useFieldOverrides, OverridePill, inputClass, selectClass, labelClass, ContextOnlyToggle } from "./NodeShell";

function NewsMonitorNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;
  const overrides = useFieldOverrides(id, type);

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status} isActive={data?.isActive}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Keywords</label>
          {overrides.keywords ? (
            <OverridePill {...overrides.keywords} />
          ) : (
            <input className={inputClass} value={config.keywords ?? ""} onChange={(e) => update("keywords", e.target.value)} placeholder="Federal Reserve, Bitcoin ETF..." />
          )}
        </div>
        <div>
          <label className={labelClass}>Source Tier</label>
          <select className={selectClass} value={config.source_tier ?? "all_major"} onChange={(e) => update("source_tier", e.target.value)}>
            <option value="top">Top outlets only</option>
            <option value="all_major">All major sources</option>
            <option value="everything">Everything</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Refresh</label>
          <select className={selectClass} value={config.refresh ?? "60"} onChange={(e) => update("refresh", e.target.value)}>
            <option value="realtime">Real-time</option>
            <option value="30">Every 30s</option>
            <option value="60">Every 1m</option>
            <option value="300">Every 5m</option>
          </select>
        </div>
        <ContextOnlyToggle checked={config.context_only ?? false} onChange={(v) => update("context_only", v)} />
        {lastOutput?.headline && (
          <div className="text-[9px] text-edge-muted/60 space-y-0.5 max-h-[48px] overflow-hidden">
            <div className="truncate text-accent-blue">{lastOutput.headline}</div>
            <div className="truncate">{lastOutput.source_name} · tier {lastOutput.source_tier}</div>
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const NewsMonitorNode = memo(NewsMonitorNodeComponent);
