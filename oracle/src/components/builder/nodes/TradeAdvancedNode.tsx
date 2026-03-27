"use client";
import { memo, useMemo } from "react";
import { NodeShell, useNodeConfig, selectClass, inputClass, labelClass } from "./NodeShell";

function TradeAdvancedNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;
  const recentTrades: any[] = useMemo(() => lastOutput?.ta_recent_trades ?? [], [lastOutput?.ta_recent_trades]);

  // Determine flash state from most recent trade
  const flash = useMemo(() => {
    if (!recentTrades.length) return null;
    const latest = recentTrades[recentTrades.length - 1];
    // Only flash if the trade happened in the last 5 seconds
    const tradeAge = Date.now() - new Date(latest.timestamp).getTime();
    if (tradeAge > 5000) return null;
    return latest.direction === "sell" ? "sell" as const : "buy" as const;
  }, [recentTrades]);

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status} isActive={data?.isActive} flash={flash} width="w-[260px]">
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          <div className="flex-1">
            <label className={labelClass}>Platform</label>
            <select className={selectClass} value={config.platform ?? "auto"} onChange={(e) => update("platform", e.target.value)}>
              <option value="auto">Auto</option>
              <option value="polymarket">Polymarket</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>
          <div className="flex-1">
            <label className={labelClass}>Direction</label>
            <select className={selectClass} value={config.direction ?? "auto"} onChange={(e) => update("direction", e.target.value)}>
              <option value="auto">Auto</option>
              <option value="buy_yes">Buy Yes</option>
              <option value="buy_no">Buy No</option>
              <option value="sell">Sell to close</option>
            </select>
          </div>
        </div>
        <div className="flex gap-1.5">
          <div className="flex-1">
            <label className={labelClass}>Order Type</label>
            <select className={selectClass} value={config.order_type ?? "market"} onChange={(e) => update("order_type", e.target.value)}>
              <option value="market">Market</option>
              <option value="limit">Limit</option>
            </select>
          </div>
          {config.order_type === "limit" && (
            <div className="flex-1">
              <label className={labelClass}>Limit Price</label>
              <input className={inputClass} type="number" min={0.01} max={0.99} step={0.01} value={config.limit_price ?? 0.5} onChange={(e) => update("limit_price", Number(e.target.value))} />
            </div>
          )}
        </div>
        <div>
          <label className={labelClass}>Mode</label>
          <select className={selectClass} value={config.mode ?? "simulate"} onChange={(e) => update("mode", e.target.value)}>
            <option value="simulate">Simulate</option>
            <option value="live">Live Trading</option>
          </select>
        </div>

        {/* Position rules */}
        <div className="pt-1 mt-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <label className={labelClass}>Position Rules</label>
          <div className="space-y-0.5">
            <label className="flex items-center gap-1 text-[9px] text-edge-muted/70">
              <input type="checkbox" checked={config.only_new ?? true} onChange={(e) => update("only_new", e.target.checked)} className="node-checkbox" />
              Only enter if no position
            </label>
            <label className="flex items-center gap-1 text-[9px] text-edge-muted/70">
              <input type="checkbox" checked={config.auto_close ?? false} onChange={(e) => update("auto_close", e.target.checked)} className="node-checkbox" />
              Close when edge turns negative
            </label>
            <label className="flex items-center gap-1 text-[9px] text-edge-muted/70">
              <input type="checkbox" checked={config.scale_in ?? false} onChange={(e) => update("scale_in", e.target.checked)} className="node-checkbox" />
              Scale in on growing edge
            </label>
          </div>
          <div className="flex gap-1.5 mt-1">
            <div className="flex-1">
              <label className={labelClass}>Max Position $</label>
              <input className={inputClass} type="number" min={1} value={config.max_position ?? 100} onChange={(e) => update("max_position", Number(e.target.value))} />
            </div>
          </div>
        </div>

        {/* Live position & P&L display */}
        {lastOutput?.ta_position_qty != null && lastOutput.ta_position_qty > 0 && (
          <div className="pt-1 mt-0.5 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="flex justify-between text-[10px]">
              <span className="text-edge-muted">Position</span>
              <span className="text-edge-text font-mono">{lastOutput.ta_position_qty} @ {lastOutput.ta_avg_entry?.toFixed(2)}¢</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-edge-muted">Unrealized</span>
              <span className={`font-mono ${lastOutput.ta_unrealized_pnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                {lastOutput.ta_unrealized_pnl >= 0 ? "+" : ""}${lastOutput.ta_unrealized_pnl?.toFixed(2)} ({lastOutput.ta_unrealized_pct?.toFixed(1)}%)
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-edge-muted">Realized</span>
              <span className={`font-mono ${(lastOutput.ta_realized_pnl ?? 0) >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                {(lastOutput.ta_realized_pnl ?? 0) >= 0 ? "+" : ""}${(lastOutput.ta_realized_pnl ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Recent trades log */}
        {recentTrades.length > 0 && (
          <div className="space-y-0.5 max-h-[40px] overflow-hidden">
            {recentTrades.slice(0, 3).map((t: any, i: number) => (
              <div key={i} className={`text-[8px] truncate ${t.direction === "buy" ? "text-accent-green/70" : "text-accent-red/70"}`}>
                {t.direction?.toUpperCase()} {t.side} @ {t.price?.toFixed(2)}¢ · {new Date(t.timestamp).toLocaleTimeString()}
              </div>
            ))}
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const TradeAdvancedNode = memo(TradeAdvancedNodeComponent);
