"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import Link from "next/link";
import type { StreamInfo } from "@/hooks/usePaymentStream";

type StrategyStatus = "draft" | "running" | "paused" | "stopped";

interface StrategyToolbarProps {
  name: string;
  status: StrategyStatus;
  isSaving?: boolean;
  isMinting?: boolean;
  turboMode: boolean;
  slowMode: boolean;
  isPublic?: boolean;
  nftMint?: string | null;
  ownerWallet?: string | null;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onDeploy: () => void;
  onPause: () => void;
  onStop?: () => void;
  onToggleTurbo: () => void;
  onToggleSlow: () => void;
  onTogglePublic?: () => void;
  stream?: StreamInfo | null;
  walletBalance?: number;
  walletConnected?: boolean;
  walletAddress?: string | null;
  onConnectWallet?: () => void;
  onDisconnectWallet?: () => void;
}

const statusConfig: Record<StrategyStatus, { label: string; color: string; bg: string; glow: string }> = {
  draft: {
    label: "Draft",
    color: "text-edge-muted",
    bg: "rgba(99, 99, 110, 0.15)",
    glow: "none",
  },
  running: {
    label: "Live",
    color: "text-accent-green",
    bg: "rgba(52, 211, 153, 0.12)",
    glow: "0 0 8px rgba(52, 211, 153, 0.3)",
  },
  paused: {
    label: "Paused",
    color: "text-accent-amber",
    bg: "rgba(251, 191, 36, 0.12)",
    glow: "none",
  },
  stopped: {
    label: "Stopped",
    color: "text-accent-red",
    bg: "rgba(248, 113, 113, 0.12)",
    glow: "none",
  },
};

export function StrategyToolbar({ name, status, isSaving, isMinting, turboMode, slowMode, isPublic, nftMint, ownerWallet, onNameChange, onSave, onDeploy, onPause, onStop, onToggleTurbo, onToggleSlow, onTogglePublic, stream, walletBalance = 0, walletConnected, walletAddress, onConnectWallet, onDisconnectWallet }: StrategyToolbarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitName = () => {
    const trimmed = editValue.trim();
    if (trimmed) onNameChange(trimmed);
    else setEditValue(name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") commitName();
    if (e.key === "Escape") {
      setEditValue(name);
      setIsEditing(false);
    }
  };

  const sc = statusConfig[status];

  return (
    <header className="h-14 bg-edge-bg/80 backdrop-blur-sm sticky top-0 z-40 border-b border-edge-border">
      <div className="flex items-center justify-between h-full px-6">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-1">
          <Link
            href="/dashboard"
            className="text-sm font-semibold tracking-widest text-white px-2.5 py-3"
          >
            EDGE
          </Link>

          <div className="w-px h-5 bg-edge-border mx-1" />

          <nav className="flex items-center">
            <Link
              href="/"
              className="relative px-3 py-3 text-sm text-white"
            >
              Builder
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-white rounded-full" />
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-3 text-sm text-edge-muted hover:text-edge-text-2 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/marketplace"
              className="px-3 py-3 text-sm text-edge-muted hover:text-edge-text-2 transition-colors"
            >
              Marketplace
            </Link>
          </nav>
        </div>

        {/* Center: Strategy name + status */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5">
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={handleKeyDown}
              className="bg-edge-surface border border-edge-border-2 text-edge-text rounded-lg px-2.5 py-1 text-sm font-medium
                focus:outline-none focus:border-white/20 w-56"
            />
          ) : (
            <button
              onClick={() => { setEditValue(name); setIsEditing(true); }}
              className="group flex items-center gap-1.5 text-sm font-medium text-edge-text hover:text-white transition-colors"
              title="Click to rename"
            >
              <span>{name}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-edge-dim group-hover:text-edge-muted transition-colors"
              >
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
          )}

          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-mono uppercase tracking-wider ${sc.color} ${status === "running" ? "animate-pulse-soft" : ""}`}
            style={{
              background: sc.bg,
              boxShadow: sc.glow,
            }}
          >
            {status === "running" && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-50" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-green" />
              </span>
            )}
            {sc.label}
          </div>

          {/* NFT ownership badge */}
          {nftMint && (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-mono uppercase tracking-wider"
              style={{ background: "rgba(167, 139, 250, 0.12)", color: "#a78bfa" }}
              title={`NFT: ${nftMint}`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              NFT
            </div>
          )}
          {isMinting && (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-mono uppercase tracking-wider animate-pulse-soft"
              style={{ background: "rgba(167, 139, 250, 0.12)", color: "#a78bfa" }}
            >
              Minting...
            </div>
          )}

          {/* Public/Private toggle */}
          {ownerWallet && walletAddress === ownerWallet && (
            <button
              onClick={onTogglePublic}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-mono uppercase tracking-wider transition-colors hover:opacity-80"
              style={{
                background: isPublic ? "rgba(52, 211, 153, 0.12)" : "rgba(99, 99, 110, 0.15)",
                color: isPublic ? "#34d399" : "#63636e",
              }}
              title={isPublic ? "Strategy is public — click to make private" : "Strategy is private — click to make public"}
            >
              {isPublic ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
              {isPublic ? "Public" : "Private"}
            </button>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Stream indicator */}
          {stream && stream.status !== "stopped" && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-edge-border" style={{ background: "rgba(255,255,255,0.03)" }}>
              <span className="relative flex h-1.5 w-1.5">
                {stream.status === "active" && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-40" />
                )}
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${stream.status === "paused" ? "bg-accent-amber" : "bg-accent-green"}`} />
              </span>
              <span className="text-xs font-mono text-white">{stream.totalStreamed.toFixed(4)}</span>
              <span className="text-xs text-edge-dim">USDC</span>
            </div>
          )}

          {/* Wallet button */}
          {walletConnected ? (
            <button
              onClick={onDisconnectWallet}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-edge-border text-edge-text-2 bg-edge-surface hover:border-edge-border-2 transition-colors"
              title={walletAddress || ""}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
              <span className="font-mono">{walletAddress?.slice(0, 4)}...{walletAddress?.slice(-4)}</span>
              <span className="text-edge-dim">{walletBalance.toFixed(2)}</span>
            </button>
          ) : (
            <button
              onClick={onConnectWallet}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-edge-border text-edge-muted hover:text-white hover:border-edge-border-2 transition-colors"
            >
              Connect Wallet
            </button>
          )}

          <div className="w-px h-5 bg-edge-border" />

          {status === "running" && (
            <div className="flex items-center rounded-lg border border-edge-border overflow-hidden">
              <button
                onClick={onToggleSlow}
                className={`px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                  slowMode
                    ? "text-accent-purple bg-accent-purple/12 border-r border-accent-purple/20"
                    : "text-edge-muted hover:text-edge-text-2 border-r border-edge-border"
                }`}
                title="Slow mode — step through nodes visually"
              >
                Slow
              </button>
              <button
                onClick={onToggleTurbo}
                className={`px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                  turboMode
                    ? "text-accent-cyan bg-accent-cyan/12"
                    : slowMode
                      ? "text-edge-dim"
                      : "text-edge-muted hover:text-edge-text-2"
                }`}
                disabled={slowMode}
                title="Turbo mode — faster tick polling"
              >
                Turbo
              </button>
            </div>
          )}
          {status === "running" && (
            <>
              <button
                onClick={onPause}
                className="px-2.5 py-1.5 text-xs font-medium text-accent-amber rounded-lg border border-accent-amber/20 bg-accent-amber/10 hover:bg-accent-amber/15 transition-colors"
              >
                Pause
              </button>
              <button
                onClick={onStop}
                className="px-2.5 py-1.5 text-xs font-medium text-accent-red rounded-lg border border-accent-red/20 bg-accent-red/10 hover:bg-accent-red/15 transition-colors"
              >
                Stop
              </button>
            </>
          )}
          <button
            onClick={onSave}
            disabled={isSaving || isMinting}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-edge-border text-edge-text-2 bg-edge-surface hover:border-edge-border-2 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isMinting ? "Minting…" : isSaving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={onDeploy}
            className="px-3 py-1.5 text-xs font-medium text-accent-green rounded-lg border border-accent-green/20 bg-accent-green/10 hover:bg-accent-green/15 transition-colors"
          >
            Deploy
          </button>
        </div>
      </div>
    </header>
  );
}
