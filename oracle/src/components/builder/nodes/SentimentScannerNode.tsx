"use client";
import { memo } from "react";
import { NodeShell, useNodeConfig, selectClass, labelClass } from "./NodeShell";

function SentimentScannerNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;
  const score = lastOutput?.scanner_sentiment_score;

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Domain</label>
          <select className={selectClass} value={config.domain ?? "general"} onChange={(e) => update("domain", e.target.value)}>
            <option value="general">General</option>
            <option value="crypto">Crypto</option>
            <option value="political">Political</option>
            <option value="financial">Financial</option>
            <option value="sports">Sports</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Aggregation</label>
          <select className={selectClass} value={config.aggregation ?? "per_item"} onChange={(e) => update("aggregation", e.target.value)}>
            <option value="per_item">Per item</option>
            <option value="5m">Last 5 minutes</option>
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last hour</option>
          </select>
        </div>
        {score != null && (
          <div className="space-y-1">
            {/* Sentiment gauge */}
            <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-accent-red/30 via-edge-dim/20 to-accent-green/30">
              <div
                className="absolute top-0 w-1.5 h-full rounded-full bg-edge-text shadow-sm transition-all"
                style={{ left: `${((score + 100) / 200) * 100}%`, transform: "translateX(-50%)" }}
              />
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-accent-red/60">-100</span>
              <span className={`font-mono font-medium ${score > 20 ? "text-accent-green" : score < -20 ? "text-accent-red" : "text-edge-muted"}`}>
                {score > 0 ? "+" : ""}{score.toFixed(0)}
              </span>
              <span className="text-accent-green/60">+100</span>
            </div>
            {lastOutput.scanner_volume_count != null && (
              <div className="text-[9px] text-edge-muted/50">
                {lastOutput.scanner_volume_count} items · mag: {lastOutput.scanner_magnitude?.toFixed(0) ?? "—"}
              </div>
            )}
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const SentimentScannerNode = memo(SentimentScannerNodeComponent);
