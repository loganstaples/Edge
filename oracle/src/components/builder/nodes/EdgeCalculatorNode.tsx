"use client";
import { memo } from "react";
import { NodeShell, useNodeConfig, selectClass, labelClass, inputClass } from "./NodeShell";

function EdgeCalculatorNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;
  const edgePct = lastOutput?.ec_edge_pct;
  const aboveThreshold = edgePct != null && Math.abs(edgePct) >= (config.min_edge ?? 5);

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status} isActive={data?.isActive} width="w-[240px]">
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          <div className="flex-1">
            <label className={labelClass}>Min Edge %</label>
            <input className={inputClass} type="number" min={1} max={30} step={0.5} value={config.min_edge ?? 5} onChange={(e) => update("min_edge", Number(e.target.value))} />
          </div>
          <div className="flex-1">
            <label className={labelClass}>Decay Half-life</label>
            <select className={selectClass} value={config.decay_halflife ?? "60"} onChange={(e) => update("decay_halflife", e.target.value)}>
              <option value="5">5 min</option>
              <option value="15">15 min</option>
              <option value="60">1 hour</option>
              <option value="240">4 hours</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Position Sizing</label>
          <select className={selectClass} value={config.sizing_mode ?? "fixed"} onChange={(e) => update("sizing_mode", e.target.value)}>
            <option value="fixed">Fixed ($)</option>
            <option value="percentage">Percentage</option>
            <option value="kelly">Kelly Criterion</option>
            <option value="proportional">Proportional to Edge</option>
          </select>
        </div>
        {config.sizing_mode === "fixed" && (
          <div>
            <label className={labelClass}>Trade Size ($)</label>
            <input className={inputClass} type="number" min={1} value={config.fixed_size ?? 25} onChange={(e) => update("fixed_size", Number(e.target.value))} />
          </div>
        )}
        {config.sizing_mode === "percentage" && (
          <div>
            <label className={labelClass}>% of Balance</label>
            <input className={inputClass} type="number" min={0.1} max={100} step={0.5} value={config.pct_size ?? 5} onChange={(e) => update("pct_size", Number(e.target.value))} />
          </div>
        )}
        {edgePct != null ? (
          <div className="text-center space-y-0.5">
            <div className={`text-[18px] font-bold font-mono ${
              !aboveThreshold ? "text-edge-dim" :
              edgePct > 0 ? "text-accent-green" : "text-accent-red"
            }`}>
              {edgePct > 0 ? "+" : ""}{edgePct.toFixed(1)}%
            </div>
            {lastOutput.ec_suggested_size != null && aboveThreshold && (
              <div className="text-[10px] text-edge-muted">
                Size: ${lastOutput.ec_suggested_size.toFixed(2)} · {lastOutput.ec_direction}
              </div>
            )}
            {!aboveThreshold && (
              <div className="text-[9px] text-edge-dim">Below {config.min_edge ?? 5}% threshold</div>
            )}
          </div>
        ) : (
          <div className="text-[10px] text-edge-dim text-center">Needs probability + market price</div>
        )}
      </div>
    </NodeShell>
  );
}

export const EdgeCalculatorNode = memo(EdgeCalculatorNodeComponent);
