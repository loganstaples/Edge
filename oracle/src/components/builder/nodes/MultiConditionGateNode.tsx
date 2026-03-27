"use client";
import { memo } from "react";
import { NodeShell, useNodeConfig, selectClass, labelClass } from "./NodeShell";

function MultiConditionGateNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;
  const inputCount = config.input_count ?? 2;
  const inputStates: boolean[] = lastOutput?.mcg_input_states ?? Array(inputCount).fill(false);
  const satisfied = lastOutput?.mcg_satisfied ?? false;

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status} isActive={data?.isActive}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Mode</label>
          <select className={selectClass} value={config.gate_mode ?? "all"} onChange={(e) => update("gate_mode", e.target.value)}>
            <option value="all">All must agree (AND)</option>
            <option value="any">Any is enough (OR)</option>
            <option value="majority">Majority</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Inputs</label>
          <select className={selectClass} value={inputCount} onChange={(e) => update("input_count", Number(e.target.value))}>
            <option value={2}>2 inputs</option>
            <option value={3}>3 inputs</option>
            <option value={4}>4 inputs</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Trigger Timeout</label>
          <select className={selectClass} value={config.timeout ?? "none"} onChange={(e) => update("timeout", e.target.value)}>
            <option value="none">None</option>
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
            <option value="300">5 minutes</option>
          </select>
        </div>
        {/* Input status circles */}
        <div className="flex items-center gap-3 justify-center py-1">
          {Array.from({ length: inputCount }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div className={`w-4 h-4 rounded-full border-2 transition-colors ${
                inputStates[i]
                  ? "bg-accent-amber border-accent-amber shadow-sm shadow-accent-amber/30"
                  : "bg-transparent border-white/10"
              }`} />
              <span className="text-[8px] text-edge-dim">{i + 1}</span>
            </div>
          ))}
        </div>
        <div className={`text-[10px] text-center font-medium ${satisfied ? "text-accent-green" : "text-edge-dim"}`}>
          {satisfied ? "Gate OPEN" : "Waiting..."}
        </div>
      </div>
    </NodeShell>
  );
}

export const MultiConditionGateNode = memo(MultiConditionGateNodeComponent);
