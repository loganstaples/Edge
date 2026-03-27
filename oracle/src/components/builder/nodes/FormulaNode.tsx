"use client";
import { memo, useState } from "react";
import { NodeShell, useNodeConfig, inputClass, labelClass } from "./NodeShell";

function FormulaNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;
  const [expanded, setExpanded] = useState(false);

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Formula</label>
          <textarea
            className={`${inputClass} resize-none font-mono text-[10px]`}
            rows={expanded ? 4 : 2}
            value={config.formula ?? ""}
            onChange={(e) => update("formula", e.target.value)}
            onDoubleClick={() => setExpanded(!expanded)}
            placeholder="(a + b) / 2"
          />
          <div className="text-[9px] text-edge-dim mt-0.5">
            +, -, *, /, min, max, avg, abs, round, if/then/else
          </div>
        </div>
        {lastOutput?.formula_result != null && (
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-mono font-bold text-edge-text">
              {typeof lastOutput.formula_result === "number" ? lastOutput.formula_result.toFixed(4) : lastOutput.formula_result}
            </span>
          </div>
        )}
        {lastOutput?.formula_error && (
          <div className="text-[9px] text-accent-red truncate">{lastOutput.formula_error}</div>
        )}
      </div>
    </NodeShell>
  );
}

export const FormulaNode = memo(FormulaNodeComponent);
