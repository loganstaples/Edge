"use client";
import { memo } from "react";
import { NodeShell, useNodeConfig, inputClass, selectClass, labelClass, ContextOnlyToggle } from "./NodeShell";

function CalendarTimerNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;
  const days = config.days ?? ["Mon", "Tue", "Wed", "Thu", "Fri"];

  const toggleDay = (day: string) => {
    const current = [...days];
    const idx = current.indexOf(day);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(day);
    update("days", current);
  };

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status} isActive={data?.isActive}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Mode</label>
          <select className={selectClass} value={config.mode ?? "interval"} onChange={(e) => update("mode", e.target.value)}>
            <option value="interval">Interval</option>
            <option value="scheduled">Scheduled</option>
            <option value="one_shot">One-shot</option>
          </select>
        </div>
        {config.mode === "interval" || !config.mode ? (
          <div>
            <label className={labelClass}>Every</label>
            <select className={selectClass} value={config.interval ?? "300"} onChange={(e) => update("interval", e.target.value)}>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="300">5 minutes</option>
              <option value="900">15 minutes</option>
              <option value="3600">1 hour</option>
              <option value="14400">4 hours</option>
              <option value="86400">24 hours</option>
            </select>
          </div>
        ) : config.mode === "scheduled" ? (
          <>
            <div>
              <label className={labelClass}>Time</label>
              <input className={inputClass} type="time" value={config.scheduled_time ?? "09:00"} onChange={(e) => update("scheduled_time", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Days</label>
              <div className="flex gap-0.5">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleDay(d)}
                    className={`text-[9px] px-1 py-0.5 rounded transition-colors ${
                      days.includes(d) ? "bg-accent-blue/30 text-accent-blue" : "bg-white/[0.04] text-edge-dim"
                    }`}
                  >
                    {d.slice(0, 2)}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div>
            <label className={labelClass}>Fire At</label>
            <input className={inputClass} type="datetime-local" value={config.fire_at ?? ""} onChange={(e) => update("fire_at", e.target.value)} />
          </div>
        )}
        <ContextOnlyToggle checked={config.context_only ?? false} onChange={(v) => update("context_only", v)} />
        {lastOutput?.fired_at && (
          <div className="text-[9px] text-edge-muted/60">
            Last: {new Date(lastOutput.fired_at).toLocaleTimeString()}
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const CalendarTimerNode = memo(CalendarTimerNodeComponent);
