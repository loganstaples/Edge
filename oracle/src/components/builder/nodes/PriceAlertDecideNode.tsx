"use client";
import { memo } from "react";
import { NodeShell, useNodeConfig, selectClass, labelClass, inputClass } from "./NodeShell";

function PriceAlertDecideNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;
  const triggered = lastOutput?.pa_triggered ?? false;

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Condition</label>
          <select className={selectClass} value={config.comparator ?? "rises_above"} onChange={(e) => update("comparator", e.target.value)}>
            <option value="rises_above">Rises above</option>
            <option value="drops_below">Drops below</option>
            <option value="crosses_either">Crosses either direction</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Target Price</label>
          <input className={inputClass} type="number" min={0.01} max={0.99} step={0.01} value={config.target ?? 0.5} onChange={(e) => update("target", Number(e.target.value))} />
        </div>
        <div>
          <label className={labelClass}>Hold For</label>
          <select className={selectClass} value={config.hold_for ?? "instant"} onChange={(e) => update("hold_for", e.target.value)}>
            <option value="instant">Instantly</option>
            <option value="60">1 minute</option>
            <option value="300">5 minutes</option>
            <option value="900">15 minutes</option>
          </select>
        </div>
        {lastOutput?.pa_current_price != null && (
          <div className="space-y-0.5">
            {/* Mini price vs threshold */}
            <div className="relative h-6 bg-white/[0.03] rounded">
              <div className="absolute left-0 right-0 border-t border-dashed border-accent-amber/40" style={{ top: `${(1 - (config.target ?? 0.5)) * 100}%` }} />
              <div className="absolute left-0 right-0 h-0.5 bg-edge-text/40" style={{ top: `${(1 - lastOutput.pa_current_price) * 100}%` }} />
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-edge-muted">Now: {(lastOutput.pa_current_price * 100).toFixed(0)}¢</span>
              <span className={triggered ? "text-accent-green font-medium" : "text-edge-dim"}>
                {triggered ? "TRIGGERED" : "Watching"}
              </span>
            </div>
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const PriceAlertDecideNode = memo(PriceAlertDecideNodeComponent);
