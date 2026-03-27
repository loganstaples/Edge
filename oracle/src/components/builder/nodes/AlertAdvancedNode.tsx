"use client";
import { memo, useState } from "react";
import { NodeShell, useNodeConfig, selectClass, inputClass, labelClass } from "./NodeShell";

const VARIABLES = ["event_name", "edge_value", "probability", "confidence", "price", "direction", "reasoning", "timestamp"];

function AlertAdvancedNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;
  const [expanded, setExpanded] = useState(false);
  const recentAlerts = lastOutput?.aa_recent_alerts ?? [];

  const insertVariable = (varName: string) => {
    const template = config.message_template ?? "";
    update("message_template", template + `{{${varName}}}`);
  };

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status} width={expanded ? "w-[300px]" : "w-[240px]"}>
      <div className="space-y-1.5">
        {/* Channel toggles */}
        <div>
          <label className={labelClass}>Channels</label>
          <div className="flex flex-wrap gap-1.5">
            <label className="flex items-center gap-1 text-[9px] text-edge-muted/70">
              <input type="checkbox" checked={config.ch_app ?? true} onChange={(e) => update("ch_app", e.target.checked)} className="w-2.5 h-2.5" />
              In-App
            </label>
            <label className="flex items-center gap-1 text-[9px] text-edge-muted/70">
              <input type="checkbox" checked={config.ch_sms ?? false} onChange={(e) => update("ch_sms", e.target.checked)} className="w-2.5 h-2.5" />
              SMS
            </label>
            <label className="flex items-center gap-1 text-[9px] text-edge-muted/70">
              <input type="checkbox" checked={config.ch_discord ?? false} onChange={(e) => update("ch_discord", e.target.checked)} className="w-2.5 h-2.5" />
              Discord
            </label>
            <label className="flex items-center gap-1 text-[9px] text-edge-muted/70">
              <input type="checkbox" checked={config.ch_email ?? false} onChange={(e) => update("ch_email", e.target.checked)} className="w-2.5 h-2.5" />
              Email
            </label>
          </div>
        </div>

        {config.ch_sms && (
          <div>
            <label className={labelClass}>Phone</label>
            <input className={inputClass} value={config.phone ?? ""} onChange={(e) => update("phone", e.target.value)} placeholder="+1234567890" />
          </div>
        )}
        {config.ch_discord && (
          <div>
            <label className={labelClass}>Discord Webhook</label>
            <input className={inputClass} value={config.discord_webhook ?? ""} onChange={(e) => update("discord_webhook", e.target.value)} placeholder="https://discord.com/api/webhooks/..." />
          </div>
        )}
        {config.ch_email && (
          <div>
            <label className={labelClass}>Email</label>
            <input className={inputClass} value={config.email ?? ""} onChange={(e) => update("email", e.target.value)} placeholder="user@example.com" />
          </div>
        )}

        <div>
          <label className={labelClass}>Severity</label>
          <select className={selectClass} value={config.severity ?? "info"} onChange={(e) => update("severity", e.target.value)}>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* Message template */}
        <div>
          <label className={labelClass}>Message</label>
          <textarea
            className={`${inputClass} resize-none`}
            rows={expanded ? 4 : 2}
            value={config.message_template ?? ""}
            onChange={(e) => update("message_template", e.target.value)}
            onDoubleClick={() => setExpanded(!expanded)}
            placeholder="Edge alert: {{event_name}} at {{probability}}..."
          />
          <div className="flex flex-wrap gap-0.5 mt-0.5">
            {VARIABLES.map((v) => (
              <button
                key={v}
                onClick={() => insertVariable(v)}
                className="text-[8px] px-1 py-0 rounded bg-accent-green/10 text-accent-green/70 hover:bg-accent-green/20 transition-colors"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Recent alerts log */}
        {recentAlerts.length > 0 && (
          <div className="space-y-0.5 max-h-[36px] overflow-hidden" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "4px" }}>
            {recentAlerts.slice(0, 3).map((a: any, i: number) => (
              <div key={i} className="text-[8px] text-edge-muted/50 truncate flex gap-1">
                <span className={
                  a.severity === "critical" ? "text-accent-red" :
                  a.severity === "warning" ? "text-accent-amber" : "text-accent-green/60"
                }>●</span>
                <span>{a.channels?.join(", ")}</span>
                <span className="text-edge-dim">{new Date(a.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const AlertAdvancedNode = memo(AlertAdvancedNodeComponent);
