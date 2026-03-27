"use client";
import { memo } from "react";
import { NodeShell, useNodeConfig, selectClass, labelClass, inputClass } from "./NodeShell";

function HistoryTrackerNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;
  const history = lastOutput?.history_values ?? [];

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Track Field</label>
          <input className={inputClass} value={config.track_field ?? "ai_probability"} onChange={(e) => update("track_field", e.target.value)} placeholder="ai_probability" />
        </div>
        <div className="flex gap-1.5">
          <div className="flex-1">
            <label className={labelClass}>Depth</label>
            <select className={selectClass} value={config.depth ?? 25} onChange={(e) => update("depth", Number(e.target.value))}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex-1">
            <label className={labelClass}>Window</label>
            <select className={selectClass} value={config.time_window ?? "1h"} onChange={(e) => update("time_window", e.target.value)}>
              <option value="5m">5 min</option>
              <option value="15m">15 min</option>
              <option value="1h">1 hour</option>
              <option value="4h">4 hours</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
            </select>
          </div>
        </div>
        {history.length > 0 && (
          <div className="space-y-0.5">
            {/* Mini sparkline chart */}
            <div className="h-8 flex items-end gap-px">
              {(() => {
                const min = Math.min(...history);
                const max = Math.max(...history);
                const range = max - min || 1;
                return history.slice(-20).map((v: number, i: number) => (
                  <div
                    key={i}
                    className="flex-1 bg-accent-purple/40 rounded-t-sm min-h-[1px]"
                    style={{ height: `${((v - min) / range) * 100}%` }}
                  />
                ));
              })()}
            </div>
            <div className="flex justify-between text-[9px] text-edge-muted/50">
              <span>{lastOutput.history_trend ?? "—"}</span>
              <span>avg: {lastOutput.history_avg?.toFixed(2) ?? "—"}</span>
              <span>streak: {lastOutput.history_streak ?? 0}</span>
            </div>
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const HistoryTrackerNode = memo(HistoryTrackerNodeComponent);
