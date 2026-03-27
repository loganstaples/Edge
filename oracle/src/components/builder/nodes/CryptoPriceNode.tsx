"use client";
import { memo } from "react";
import { NodeShell, useNodeConfig, selectClass, labelClass, ContextOnlyToggle } from "./NodeShell";

function CryptoPriceNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Token</label>
          <select className={selectClass} value={config.token ?? "BTC"} onChange={(e) => update("token", e.target.value)}>
            <option value="BTC">BTC — Bitcoin</option>
            <option value="ETH">ETH — Ethereum</option>
            <option value="SOL">SOL — Solana</option>
            <option value="LINK">LINK — Chainlink</option>
            <option value="AVAX">AVAX — Avalanche</option>
            <option value="DOGE">DOGE — Dogecoin</option>
            <option value="ADA">ADA — Cardano</option>
            <option value="DOT">DOT — Polkadot</option>
            <option value="MATIC">MATIC — Polygon</option>
            <option value="XRP">XRP — Ripple</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Timeframe</label>
          <select className={selectClass} value={config.timeframe ?? "1h"} onChange={(e) => update("timeframe", e.target.value)}>
            <option value="1m">1 minute</option>
            <option value="5m">5 minutes</option>
            <option value="15m">15 minutes</option>
            <option value="1h">1 hour</option>
            <option value="4h">4 hours</option>
            <option value="24h">24 hours</option>
          </select>
        </div>
        <ContextOnlyToggle checked={config.context_only ?? false} onChange={(v) => update("context_only", v)} />
        {lastOutput?.current_price != null && (
          <div className="text-[9px] space-y-0.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-edge-text font-medium text-[11px]">${lastOutput.current_price.toLocaleString()}</span>
              <span className={lastOutput.change_pct >= 0 ? "text-accent-green" : "text-accent-red"}>
                {lastOutput.change_pct >= 0 ? "+" : ""}{lastOutput.change_pct.toFixed(2)}%
              </span>
            </div>
            <div className="text-edge-muted/50 flex gap-2">
              <span>H: ${lastOutput.high_24h?.toLocaleString()}</span>
              <span>L: ${lastOutput.low_24h?.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const CryptoPriceNode = memo(CryptoPriceNodeComponent);
