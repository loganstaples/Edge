"use client";
import { memo } from "react";
import { NodeShell, useNodeConfig, inputClass, selectClass, labelClass } from "./NodeShell";

function OnChainActivityNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const lastOutput = data?.lastOutput;

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status}>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>Mode</label>
          <select className={selectClass} value={config.mode ?? "whale_alerts"} onChange={(e) => update("mode", e.target.value)}>
            <option value="watch_wallet">Watch wallet</option>
            <option value="whale_alerts">Whale alerts</option>
          </select>
        </div>
        {config.mode === "watch_wallet" ? (
          <div>
            <label className={labelClass}>Wallet Address</label>
            <input className={inputClass} value={config.wallet_address ?? ""} onChange={(e) => update("wallet_address", e.target.value)} placeholder="0x..." />
          </div>
        ) : (
          <>
            <div>
              <label className={labelClass}>Min Value (USD)</label>
              <select className={selectClass} value={config.min_value ?? "1000000"} onChange={(e) => update("min_value", e.target.value)}>
                <option value="100000">$100K+</option>
                <option value="500000">$500K+</option>
                <option value="1000000">$1M+</option>
                <option value="5000000">$5M+</option>
                <option value="10000000">$10M+</option>
                <option value="50000000">$50M+</option>
                <option value="100000000">$100M+</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Chain</label>
              <select className={selectClass} value={config.chain ?? "all"} onChange={(e) => update("chain", e.target.value)}>
                <option value="all">All chains</option>
                <option value="ethereum">Ethereum</option>
                <option value="bitcoin">Bitcoin</option>
                <option value="solana">Solana</option>
              </select>
            </div>
          </>
        )}
        {lastOutput?.tx_hash && (
          <div className="text-[9px] text-edge-muted/60 space-y-0.5 max-h-[48px] overflow-hidden">
            <div className="flex gap-1 items-baseline">
              <span className="text-accent-green font-medium">${(lastOutput.dollar_value ?? 0).toLocaleString()}</span>
              <span className="text-edge-dim">{lastOutput.token}</span>
            </div>
            <div className="truncate">{lastOutput.from_address?.slice(0, 8)}...→{lastOutput.to_address?.slice(0, 8)}...</div>
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const OnChainActivityNode = memo(OnChainActivityNodeComponent);
