"use client";
import { memo } from "react";
import { NodeShell, useNodeConfig, selectClass, labelClass } from "./NodeShell";

function ConsensusNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;
  const weights = config.weights ?? [50, 50];

  const updateWeight = (index: number, value: number) => {
    const newWeights = [...weights];
    newWeights[index] = value;
    update("weights", newWeights);
  };

  const inputCount = config.input_count ?? 2;

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status} isActive={data?.isActive}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Mode</label>
          <select className={selectClass} value={config.consensus_mode ?? "weighted_avg"} onChange={(e) => update("consensus_mode", e.target.value)}>
            <option value="weighted_avg">Weighted Average</option>
            <option value="majority">Majority Rules</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Inputs</label>
          <select className={selectClass} value={inputCount} onChange={(e) => {
            const count = Number(e.target.value);
            update("input_count", count);
            const w = Array(count).fill(Math.round(100 / count));
            update("weights", w);
          }}>
            <option value={2}>2 inputs</option>
            <option value={3}>3 inputs</option>
            <option value={4}>4 inputs</option>
            <option value={5}>5 inputs</option>
          </select>
        </div>
        {config.consensus_mode !== "majority" && (
          <div className="space-y-0.5">
            <label className={labelClass}>Weights</label>
            {Array.from({ length: inputCount }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[9px] text-edge-dim w-3">{i + 1}</span>
                <input
                  type="range" min={0} max={100} value={weights[i] ?? Math.round(100 / inputCount)}
                  onChange={(e) => updateWeight(i, Number(e.target.value))}
                  className="flex-1 h-1 accent-accent-purple"
                />
                <span className="text-[9px] text-edge-muted w-6 text-right">{weights[i] ?? Math.round(100 / inputCount)}%</span>
              </div>
            ))}
          </div>
        )}
        {lastOutput?.consensus_probability != null && (
          <div className="space-y-0.5">
            {/* Dot visualization */}
            <div className="relative h-3 bg-white/[0.03] rounded-full">
              {(lastOutput._input_probabilities ?? []).map((p: number, i: number) => (
                <div
                  key={i}
                  className="absolute top-0.5 w-2 h-2 rounded-full bg-accent-purple/50"
                  style={{ left: `${p * 100}%`, transform: "translateX(-50%)" }}
                />
              ))}
              <div
                className="absolute top-0 w-3 h-3 rounded-full bg-accent-purple shadow-sm"
                style={{ left: `${lastOutput.consensus_probability * 100}%`, transform: "translateX(-50%)" }}
              />
            </div>
            <div className="flex items-baseline gap-2 text-[10px]">
              <span className="font-medium text-edge-text">{(lastOutput.consensus_probability * 100).toFixed(0)}%</span>
              <span className="text-edge-muted/50">conf: {(lastOutput.consensus_confidence * 100).toFixed(0)}%</span>
              {lastOutput.consensus_disagreement && <span className="text-accent-amber text-[9px]">split</span>}
            </div>
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const ConsensusNode = memo(ConsensusNodeComponent);
