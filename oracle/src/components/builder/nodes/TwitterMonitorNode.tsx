"use client";
import { memo } from "react";
import { NodeShell, useNodeConfig, useFieldOverrides, OverridePill, inputClass, selectClass, labelClass, ContextOnlyToggle } from "./NodeShell";

function TwitterMonitorNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;
  const overrides = useFieldOverrides(id, type);

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Keywords</label>
          {overrides.keywords ? (
            <OverridePill {...overrides.keywords} />
          ) : (
            <input className={inputClass} value={config.keywords ?? ""} onChange={(e) => update("keywords", e.target.value)} placeholder="Bitcoin, Fed rate..." />
          )}
        </div>
        <div>
          <label className={labelClass}>Handles</label>
          <input className={inputClass} value={config.handles ?? ""} onChange={(e) => update("handles", e.target.value)} placeholder="@WhiteHouse, @elonmusk..." />
        </div>
        <div className="flex gap-1.5">
          <div className="flex-1">
            <label className={labelClass}>Min Followers</label>
            <select className={selectClass} value={config.min_followers ?? "1000"} onChange={(e) => update("min_followers", e.target.value)}>
              <option value="0">Any</option>
              <option value="100">100+</option>
              <option value="1000">1K+</option>
              <option value="10000">10K+</option>
              <option value="100000">100K+</option>
              <option value="1000000">1M+</option>
            </select>
          </div>
          <div className="flex-1">
            <label className={labelClass}>Language</label>
            <select className={selectClass} value={config.language ?? "en"} onChange={(e) => update("language", e.target.value)}>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-1 text-[10px] text-edge-muted/70">
            <input type="checkbox" checked={config.verified_only ?? false} onChange={(e) => update("verified_only", e.target.checked)} className="w-3 h-3 rounded bg-white/[0.04] border border-white/[0.06]" />
            Verified only
          </label>
          <label className="flex items-center gap-1 text-[10px] text-edge-muted/70">
            <input type="checkbox" checked={config.exclude_retweets ?? true} onChange={(e) => update("exclude_retweets", e.target.checked)} className="w-3 h-3 rounded bg-white/[0.04] border border-white/[0.06]" />
            No RTs
          </label>
        </div>
        <ContextOnlyToggle checked={config.context_only ?? false} onChange={(v) => update("context_only", v)} />
        {lastOutput?.tweet_text && (
          <div className="text-[9px] text-edge-muted/60 space-y-0.5 max-h-[48px] overflow-hidden">
            <div className="truncate text-accent-blue">@{lastOutput.author_handle}</div>
            <div className="truncate">{lastOutput.tweet_text}</div>
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const TwitterMonitorNode = memo(TwitterMonitorNodeComponent);
