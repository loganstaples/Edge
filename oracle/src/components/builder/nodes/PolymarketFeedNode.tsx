"use client";
import { memo } from "react";
import { NodeShell, useNodeConfig, inputClass, selectClass, labelClass } from "./NodeShell";

function PolymarketFeedNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Market Search</label>
          <input className={inputClass} value={config.market_search ?? ""} onChange={(e) => update("market_search", e.target.value)} placeholder="Search markets..." />
        </div>
        <div>
          <label className={labelClass}>Watch Mode</label>
          <select className={selectClass} value={config.watch_mode ?? "single"} onChange={(e) => update("watch_mode", e.target.value)}>
            <option value="single">Single market</option>
            <option value="category">Watch category</option>
          </select>
        </div>
        {config.watch_mode === "category" && (
          <div>
            <label className={labelClass}>Category</label>
            <select className={selectClass} value={config.category ?? "all"} onChange={(e) => update("category", e.target.value)}>
              <option value="all">All</option>
              <option value="politics">Politics</option>
              <option value="crypto">Crypto</option>
              <option value="sports">Sports</option>
              <option value="economics">Economics</option>
              <option value="culture">Culture</option>
              <option value="world">World</option>
            </select>
          </div>
        )}
        <div>
          <label className={labelClass}>Max Results</label>
          <input className={inputClass} type="number" min={1} max={50} value={config.max_results ?? 10} onChange={(e) => update("max_results", Number(e.target.value))} />
        </div>
        {lastOutput?.event_title && (
          <div className="text-[9px] text-edge-muted/60 space-y-0.5 max-h-[48px] overflow-hidden">
            <div className="truncate text-accent-blue">{lastOutput.event_title}</div>
            <div className="flex gap-2">
              <span>Yes: {(lastOutput.yes_price * 100).toFixed(0)}¢</span>
              <span>Vol: ${lastOutput.volume_24h?.toLocaleString() ?? "—"}</span>
              <span>Spread: {(lastOutput.spread * 100).toFixed(1)}¢</span>
            </div>
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const PolymarketFeedNode = memo(PolymarketFeedNodeComponent);
