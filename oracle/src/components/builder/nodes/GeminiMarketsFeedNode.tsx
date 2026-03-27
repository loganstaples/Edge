"use client";
import { memo } from "react";
import { NodeShell, useNodeConfig, useFieldOverrides, OverridePill, inputClass, selectClass, labelClass, ContextOnlyToggle } from "./NodeShell";

function GeminiMarketsFeedNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;
  const overrides = useFieldOverrides(id, type);

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status} isActive={data?.isActive}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Event Search</label>
          {overrides.event_search ? (
            <OverridePill {...overrides.event_search} />
          ) : (
            <input className={inputClass} value={config.event_search ?? ""} onChange={(e) => update("event_search", e.target.value)} placeholder="Search events..." />
          )}
        </div>
        <div>
          <label className={labelClass}>Watch Mode</label>
          <select className={selectClass} value={config.watch_mode ?? "single"} onChange={(e) => update("watch_mode", e.target.value)}>
            <option value="single">Single event</option>
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
        <div className="flex gap-1.5">
          <div className="flex-1">
            <label className={labelClass}>Max Results</label>
            <input className={inputClass} type="number" min={1} max={50} value={config.max_results ?? 10} onChange={(e) => update("max_results", Number(e.target.value))} />
          </div>
          <div className="flex-1">
            <label className={labelClass}>Alert Δ%</label>
            <input className={inputClass} type="number" min={0} step={0.5} value={config.alert_threshold ?? 5} onChange={(e) => update("alert_threshold", Number(e.target.value))} />
          </div>
        </div>
        <ContextOnlyToggle checked={config.context_only ?? false} onChange={(v) => update("context_only", v)} />
        {lastOutput?.event_title && (
          <div className="text-[9px] text-edge-muted/60 space-y-0.5 max-h-[48px] overflow-hidden">
            <div className="truncate text-accent-blue">{lastOutput.event_title}</div>
            <div className="flex gap-2">
              <span>{(lastOutput.contract_price * 100).toFixed(0)}¢</span>
              <span>Bid: {(lastOutput.bid_price * 100).toFixed(0)}¢</span>
              <span>Ask: {(lastOutput.ask_price * 100).toFixed(0)}¢</span>
              {lastOutput.significant_move && <span className="text-accent-amber">⚡</span>}
            </div>
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const GeminiMarketsFeedNode = memo(GeminiMarketsFeedNodeComponent);
