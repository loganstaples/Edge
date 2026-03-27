"use client";
import { memo } from "react";
import { NodeShell, useNodeConfig, selectClass, labelClass, inputClass } from "./NodeShell";

function ArbitrageDetectorNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status} isActive={data?.isActive} width="w-[250px]">
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Event Matching</label>
          <select className={selectClass} value={config.match_mode ?? "auto"} onChange={(e) => update("match_mode", e.target.value)}>
            <option value="auto">Auto-match</option>
            <option value="manual">Manual pair</option>
          </select>
        </div>
        <div className="flex gap-1.5">
          <div className="flex-1">
            <label className={labelClass}>Min Spread %</label>
            <input className={inputClass} type="number" min={0.5} max={15} step={0.5} value={config.min_spread ?? 3} onChange={(e) => update("min_spread", Number(e.target.value))} />
          </div>
          <div className="flex-1">
            <label className={labelClass}>Net of Fees</label>
            <div className="flex items-center h-[26px]">
              <label className="flex items-center gap-1 text-[10px] text-edge-muted/70">
                <input type="checkbox" checked={config.net_of_fees ?? true} onChange={(e) => update("net_of_fees", e.target.checked)} className="node-checkbox" />
                Subtract fees
              </label>
            </div>
          </div>
        </div>
        {lastOutput?.arb_spread_pct != null ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <div className="text-center">
                <div className="text-edge-dim text-[8px] uppercase">{lastOutput.arb_buy_platform}</div>
                <div className="text-accent-green font-mono font-medium">{(lastOutput.arb_buy_price * 100).toFixed(0)}¢</div>
              </div>
              <div className="text-center px-2">
                <div className={`text-[14px] font-bold font-mono ${lastOutput.arb_spread_pct >= (config.min_spread ?? 3) ? "text-accent-amber" : "text-edge-dim"}`}>
                  {lastOutput.arb_spread_pct.toFixed(1)}%
                </div>
                <div className="text-[8px] text-edge-dim">SPREAD</div>
              </div>
              <div className="text-center">
                <div className="text-edge-dim text-[8px] uppercase">{lastOutput.arb_sell_platform}</div>
                <div className="text-accent-red font-mono font-medium">{(lastOutput.arb_sell_price * 100).toFixed(0)}¢</div>
              </div>
            </div>
            {lastOutput.arb_profit_estimate != null && (
              <div className="text-[9px] text-edge-muted/50 text-center">
                Est. profit: ${lastOutput.arb_profit_estimate.toFixed(2)} per $100 deployed
              </div>
            )}
          </div>
        ) : (
          <div className="text-[10px] text-edge-dim text-center">Connect two market feeds</div>
        )}
      </div>
    </NodeShell>
  );
}

export const ArbitrageDetectorNode = memo(ArbitrageDetectorNodeComponent);
