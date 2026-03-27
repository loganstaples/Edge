"use client";
import { memo, useState } from "react";
import { NodeShell, useNodeConfig, inputClass, selectClass, labelClass } from "./NodeShell";

function AIAnalystNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;
  const [expanded, setExpanded] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status} isActive={data?.isActive} width={expanded ? "w-[320px]" : "w-[260px]"}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Instruction</label>
          <textarea
            className={`${inputClass} resize-none`}
            rows={expanded ? 5 : 2}
            value={config.instruction ?? ""}
            onChange={(e) => update("instruction", e.target.value)}
            onDoubleClick={() => setExpanded(!expanded)}
            placeholder="Estimate the probability that..."
          />
          <div className="text-[9px] text-edge-dim mt-0.5">Double-click to {expanded ? "collapse" : "expand"}</div>
        </div>
        <div className="flex gap-1.5">
          <div className="flex-1">
            <label className={labelClass}>Model</label>
            <select className={selectClass} value={config.model ?? "claude-haiku"} onChange={(e) => update("model", e.target.value)}>
              <option value="claude-haiku">Haiku 4.5</option>
              <option value="claude-sonnet">Sonnet 4.6</option>
              <option value="claude-opus">Opus 4.6</option>
            </select>
          </div>
          <div className="flex-1">
            <label className={labelClass}>Depth</label>
            <select className={selectClass} value={config.depth ?? "balanced"} onChange={(e) => update("depth", e.target.value)}>
              <option value="fast">Fast</option>
              <option value="balanced">Balanced</option>
              <option value="thorough">Thorough</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-edge-muted/70">
          <input type="checkbox" checked={config.structured ?? true} onChange={(e) => update("structured", e.target.checked)} className="node-checkbox" />
          Structured output
        </label>
        {lastOutput?.analyst_probability != null && (
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[16px] font-bold text-edge-text">{(lastOutput.analyst_probability * 100).toFixed(0)}%</span>
              <span className={`text-[10px] font-medium ${
                lastOutput.analyst_direction === "bullish" ? "text-accent-green" :
                lastOutput.analyst_direction === "bearish" ? "text-accent-red" : "text-edge-dim"
              }`}>
                {lastOutput.analyst_direction}
              </span>
              <span className="text-[9px] text-edge-muted/60">{lastOutput.analyst_confidence}</span>
            </div>
            {lastOutput.analyst_reasoning && (
              <button onClick={() => setShowReasoning(!showReasoning)} className="text-[9px] text-accent-blue/70 hover:text-accent-blue">
                {showReasoning ? "Hide" : "Show"} reasoning
              </button>
            )}
            {showReasoning && (
              <div className="text-[9px] text-edge-muted/60 leading-relaxed">{lastOutput.analyst_reasoning}</div>
            )}
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const AIAnalystNode = memo(AIAnalystNodeComponent);
