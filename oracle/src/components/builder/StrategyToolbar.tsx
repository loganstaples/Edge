"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import Link from "next/link";

type StrategyStatus = "draft" | "running" | "paused" | "stopped";

interface StrategyToolbarProps {
  name: string;
  status: StrategyStatus;
  isSaving?: boolean;
  turboMode: boolean;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onDeploy: () => void;
  onPause: () => void;
  onToggleTurbo: () => void;
}

const statusConfig: Record<StrategyStatus, { label: string; color: string; bg: string; glow: string }> = {
  draft: {
    label: "Draft",
    color: "text-edge-muted",
    bg: "rgba(90, 95, 122, 0.15)",
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

export function StrategyToolbar({ name, status, isSaving, turboMode, onNameChange, onSave, onDeploy, onPause, onToggleTurbo }: StrategyToolbarProps) {
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
    <div
      className="relative flex items-center justify-between px-4 py-0 border-b border-edge-border/50"
      style={{
        background: "linear-gradient(180deg, rgba(14, 16, 24, 0.85) 0%, rgba(10, 12, 18, 0.95) 100%)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {/* Gradient top line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.3), transparent)",
        }}
      />

      {/* Left: Logo + Nav */}
      <div className="flex items-center gap-1">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-2.5 py-3 rounded-lg group transition-colors"
        >
          <span className="text-base font-semibold tracking-tight bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent">
            EDGE
          </span>
        </Link>

        <div className="w-px h-5 bg-edge-border/60 mx-1" />

        <nav className="flex items-center">
          <Link
            href="/"
            className="relative px-3 py-3 text-[13px] font-medium text-edge-text"
          >
            Builder
            <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-accent-blue to-accent-purple rounded-full" />
          </Link>
          <Link
            href="/dashboard"
            className="px-3 py-3 text-[13px] text-edge-muted hover:text-edge-text-2 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/marketplace"
            className="px-3 py-3 text-[13px] text-edge-muted hover:text-edge-text-2 transition-colors"
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
            className="bg-edge-surface-2/80 border border-edge-border-2 text-edge-text rounded-lg px-2.5 py-1 text-sm font-medium
              focus:outline-none focus:border-accent-blue/50 w-56 backdrop-blur-sm"
            style={{
              boxShadow: "0 0 0 1px rgba(129, 140, 248, 0.1), 0 2px 8px rgba(0, 0, 0, 0.3)",
            }}
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
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest ${sc.color} ${status === "running" ? "animate-pulse-soft" : ""}`}
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
      </div>

      {/* Right: Actions + connection status */}
      <div className="flex items-center gap-2">
        {status === "running" && (
          <button
            onClick={onToggleTurbo}
            className="group relative px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200"
            style={{
              background: turboMode
                ? "linear-gradient(135deg, rgba(34, 211, 238, 0.1) 0%, rgba(34, 211, 238, 0.05) 100%)"
                : "transparent",
              borderColor: turboMode ? "rgba(34, 211, 238, 0.3)" : "rgba(26, 29, 46, 0.8)",
              boxShadow: turboMode ? "0 0 12px rgba(34, 211, 238, 0.15)" : "none",
            }}
          >
            <span className={turboMode ? "text-accent-cyan" : "text-edge-muted group-hover:text-edge-text-2"}>
              {turboMode ? "⚡ Turbo" : "⚡"}
            </span>
          </button>
        )}
        {status === "running" && (
          <button
            onClick={onPause}
            className="px-2.5 py-1.5 text-xs font-medium text-accent-amber rounded-lg border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(251, 191, 36, 0.03) 100%)",
              borderColor: "rgba(251, 191, 36, 0.25)",
            }}
          >
            Pause
          </button>
        )}
        <button
          onClick={onSave}
          disabled={isSaving}
          className="px-2.5 py-1.5 text-xs font-medium text-edge-text-2 rounded-lg border border-edge-border hover:border-edge-border-2 hover:text-edge-text transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, rgba(20, 22, 32, 0.6) 0%, rgba(14, 16, 24, 0.4) 100%)",
          }}
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onDeploy}
          className="px-3 py-1.5 text-xs font-semibold text-accent-green rounded-lg border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, rgba(52, 211, 153, 0.1) 0%, rgba(52, 211, 153, 0.04) 100%)",
            borderColor: "rgba(52, 211, 153, 0.3)",
            boxShadow: "0 0 12px rgba(52, 211, 153, 0.08)",
          }}
        >
          Deploy
        </button>
      </div>
    </div>
  );
}
