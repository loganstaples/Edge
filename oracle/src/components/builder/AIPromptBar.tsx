"use client";

import { useState, useCallback, useEffect, useRef, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import React from "react";

interface AIPromptBarProps {
  onStrategyGenerated: (nodes: any[], connections: any[], name?: string) => void;
  isLoading: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

// idle     → no color border, just subtle static border
// active   → full bright color border + glow (instant on focus)
// settled  → dimmer color border (after brief moment)
// leaving  → rotating + fading out (the sexy fizzle on blur)
// loading  → rotating at full brightness (loading bar on submit)
type BorderState = "idle" | "active" | "settled" | "leaving" | "loading";

const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", desc: "Fast" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", desc: "Balanced" },
  { id: "claude-opus-4-6", label: "Opus 4.6", desc: "Best" },
] as const;

export function AIPromptBar({ onStrategyGenerated, isLoading, inputRef }: AIPromptBarProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borderState, setBorderState] = useState<BorderState>("idle");
  const [flashKey, setFlashKey] = useState(0);
  const [selectedModel, setSelectedModel] = useState<(typeof MODELS)[number]["id"]>(MODELS[1].id);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const modelMenuOpenRef = useRef(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  const stateRef = useRef<BorderState>("idle");
  const focusedRef = useRef(false);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    stateRef.current = borderState;
  }, [borderState]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  // Close model menu on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        modelMenuRef.current && !modelMenuRef.current.contains(e.target as HTMLElement) &&
        modelBtnRef.current && !modelBtnRef.current.contains(e.target as HTMLElement)
      ) {
        setModelMenuOpen(false);
      }
    };
    if (modelMenuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelMenuOpen]);

  // Fade out when menu closes if textarea isn't focused
  const prevMenuOpen = useRef(false);
  useEffect(() => {
    const wasOpen = prevMenuOpen.current;
    prevMenuOpen.current = modelMenuOpen;
    if (wasOpen && !modelMenuOpen && !focusedRef.current && stateRef.current === "settled") {
      clearTimers();
      setBorderState("leaving");
      timersRef.current.push(
        setTimeout(() => setBorderState("idle"), 1600)
      );
    }
  }, [modelMenuOpen]);

  const toggleModelMenu = useCallback(() => {
    if (modelMenuOpen) {
      setModelMenuOpen(false);
      return;
    }
    if (modelBtnRef.current) {
      const rect = modelBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.top - 4, right: window.innerWidth - rect.right });
    }
    setModelMenuOpen(true);
  }, [modelMenuOpen]);

  const isSubmitting = isLoading || loading;
  const submittingRef = useRef(false);
  submittingRef.current = isSubmitting;
  modelMenuOpenRef.current = modelMenuOpen;

  // --- Focus: fade straight to settled color ---
  const handleFocus = useCallback(() => {
    focusedRef.current = true;
    clearTimers();
    if (stateRef.current === "loading") return; // don't interrupt loading
    setBorderState("settled");
  }, []);

  // --- Blur: rotating fizzle-out ---
  const handleBlur = useCallback((e: React.FocusEvent) => {
    focusedRef.current = false;
    clearTimers();
    if (stateRef.current === "loading" || submittingRef.current) return;
    // If clicking the model button or the portal menu, stay highlighted
    const related = e.relatedTarget as HTMLElement | null;
    if (
      related &&
      (modelBtnRef.current?.contains(related) || modelMenuRef.current?.contains(related))
    ) return;
    // Defer slightly so modelMenuOpen state can settle
    timersRef.current.push(
      setTimeout(() => {
        if (modelMenuOpenRef.current) return;
        setBorderState("leaving");
        timersRef.current.push(
          setTimeout(() => setBorderState("idle"), 1600)
        );
      }, 0)
    );
  }, []);

  // --- Loading state transitions ---
  const prevSubmitting = useRef(false);
  useEffect(() => {
    const wasSubmitting = prevSubmitting.current;
    prevSubmitting.current = isSubmitting;

    // Started submitting → enter loading
    if (isSubmitting && !wasSubmitting) {
      if (stateRef.current === "settled" || stateRef.current === "active" || stateRef.current === "idle" || stateRef.current === "leaving") {
        clearTimers();
        setFlashKey((k) => k + 1);
        setBorderState("loading");
      }
    }

    // Finished submitting → settle or fizzle out
    if (!isSubmitting && wasSubmitting && stateRef.current === "loading") {
      clearTimers();
      if (focusedRef.current) {
        setBorderState("settled");
      } else {
        setFlashKey((k) => k + 1);
        setBorderState("leaving");
        timersRef.current.push(
          setTimeout(() => setBorderState("idle"), 1400)
        );
      }
    }
  }, [isSubmitting]);

  const handleSubmit = async () => {
    if (!prompt.trim() || isSubmitting) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/generate-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), model: selectedModel }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate strategy");
      }

      const data = await res.json();
      const { nodes, connections } = data;

      if (!nodes || !connections) {
        throw new Error("Invalid response from AI");
      }

      onStrategyGenerated(nodes, connections, data.name);
      setPrompt("");
      // Reset textarea height back to default after clearing
      if (inputRef?.current) {
        inputRef.current.style.height = "auto";
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasInput = prompt.trim().length > 0;
  const isFocused = borderState === "settled" || borderState === "active" || borderState === "loading";

  // --- Visual properties per state ---
  const bp = (() => {
    switch (borderState) {
      case "active":
        return {
          opacity: 1,
          rotate: false,
          transition: "opacity 0.15s ease-in",
          glow: "0 0 20px rgba(129, 140, 248, 0.2), 0 0 50px rgba(167, 139, 250, 0.1)",
        };
      case "settled":
        return {
          opacity: 0.7,
          rotate: false,
          transition: "opacity 0.2s ease-in",
          glow: "0 0 16px rgba(129, 140, 248, 0.15)",
        };
      case "leaving":
        return {
          opacity: 0,
          rotate: "fizzle",
          transition: "opacity 1.4s cubic-bezier(0.16, 1, 0.3, 1)",
          glow: "0 0 12px rgba(129, 140, 248, 0.1)",
        };
      case "loading":
        return {
          opacity: 0.85,
          rotate: true,
          transition: "opacity 0.3s ease-in",
          glow: "0 0 20px rgba(129, 140, 248, 0.2), 0 0 50px rgba(167, 139, 250, 0.1)",
        };
      default:
        return {
          opacity: 0,
          rotate: false,
          transition: "opacity 0.3s ease-out",
          glow: "none",
        };
    }
  })();

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4 pointer-events-auto">
      <div
        className="relative rounded-2xl p-[1.5px] overflow-hidden"
        style={{
          boxShadow: `${bp.glow}${bp.glow !== "none" ? ", " : ""}0 8px 32px rgba(0, 0, 0, 0.4)`,
          transition: "box-shadow 0.5s ease",
        }}
      >
        {/* Conic gradient border */}
        <div
          key={flashKey}
          className={`absolute inset-[-100%] ${bp.rotate === "fizzle" ? "animate-border-fizzle" : bp.rotate ? "animate-border-rotate" : ""}`}
          style={{
            background:
              "conic-gradient(from 0deg, #818cf8, #9b8afb, #a78bfa, #8ba8f8, #60bfe6, #22d3ee, #2bd4b0, #34d399, #7ac77a, #b8c456, #fbbf24, #f59064, #f87171, #e47ab4, #a78bfa, #818cf8)",
            opacity: bp.opacity,
            transition: bp.transition,
          }}
        />

        {/* Static subtle border — visible only when idle */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            border: "1.5px solid rgba(255, 255, 255, 0.06)",
            opacity: borderState === "idle" ? 1 : 0,
            transition: "opacity 0.5s ease",
          }}
        />

        {/* Card body */}
        <div
          className="relative rounded-[14px]"
          style={{
            background:
              "linear-gradient(135deg, rgba(17, 17, 19, 0.95) 0%, rgba(22, 22, 24, 0.88) 100%)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          {/* Inner glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-12 pointer-events-none rounded-t-[14px]"
            style={{
              background:
                "radial-gradient(ellipse at 50% -20%, rgba(129, 140, 248, 0.06) 0%, transparent 70%)",
            }}
          />

          <div className="px-4 pt-3.5 pb-2.5 flex flex-col">
            {/* Textarea */}
            <div className="relative">
              <textarea
                ref={inputRef}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  // Auto-resize
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                }}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder="Describe a trading strategy..."
                disabled={isSubmitting}
                rows={1}
                className={`w-full bg-transparent text-sm focus:outline-none focus:ring-0 border-none outline-none disabled:opacity-50 resize-none overflow-y-auto transition-colors duration-200 ${isFocused ? "ai-placeholder-bright" : "ai-placeholder-dim"}`}
                style={{ boxShadow: "none", WebkitAppearance: "none", color: isFocused ? "#fafafa" : "rgba(250, 250, 250, 0.5)" }}
              />
            </div>

            {/* Model selector + Submit button — pinned bottom-right */}
            <div className="flex justify-end items-center gap-1.5 mt-1">
              {/* Model selector */}
              <div className="relative">
                <button
                  ref={modelBtnRef}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={toggleModelMenu}
                  disabled={isSubmitting}
                  className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium rounded-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: modelMenuOpen
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(255, 255, 255, 0.04)",
                    color: isFocused
                      ? "rgba(255, 255, 255, 0.55)"
                      : "rgba(255, 255, 255, 0.25)",
                    border: modelMenuOpen
                      ? "1px solid rgba(255, 255, 255, 0.12)"
                      : "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  {MODELS.find((m) => m.id === selectedModel)?.label}
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" style={{ opacity: 0.5 }}>
                    <path d="M1.5 5L4 2.5L6.5 5" />
                  </svg>
                </button>
              </div>

              {/* Drop-up menu (portaled to body to escape overflow-hidden) */}
              {modelMenuOpen && menuPos && createPortal(
                <div
                  ref={modelMenuRef}
                  className="fixed z-50 w-44 rounded-xl overflow-hidden"
                  style={{
                    top: menuPos.top,
                    right: menuPos.right,
                    transform: "translateY(-100%)",
                    background:
                      "linear-gradient(145deg, rgba(17, 17, 19, 0.97) 0%, rgba(22, 22, 24, 0.93) 100%)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    boxShadow:
                      "0 -8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.02) inset",
                  }}
                >
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelectedModel(m.id);
                        setModelMenuOpen(false);
                        inputRef?.current?.focus();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors duration-150 hover:bg-white/[0.06]"
                    >
                      <div className="flex flex-col">
                        <span className="text-[11px] font-medium" style={{ color: selectedModel === m.id ? "#ffffff" : "rgba(255,255,255,0.7)" }}>
                          {m.label}
                        </span>
                        <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {m.desc}
                        </span>
                      </div>
                      {selectedModel === m.id && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="rgba(129, 140, 248, 0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2 6 5 9 10 3" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>,
                document.body
              )}

              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !hasInput}
                className="flex-shrink-0 px-3.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all duration-200 disabled:cursor-not-allowed"
                style={{
                  background:
                    hasInput && !isSubmitting
                      ? "rgba(255, 255, 255, 0.95)"
                      : isFocused
                        ? "rgba(255, 255, 255, 0.12)"
                        : "rgba(255, 255, 255, 0.06)",
                  color:
                    hasInput && !isSubmitting
                      ? "#09090b"
                      : isFocused
                        ? "rgba(255, 255, 255, 0.68)"
                        : "rgba(255, 255, 255, 0.25)",
                  border:
                    hasInput && !isSubmitting
                      ? "1px solid rgba(255, 255, 255, 0.9)"
                      : isFocused
                        ? "1px solid rgba(255, 255, 255, 0.15)"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                {isSubmitting ? "Building..." : "Build"}
              </button>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[11px] text-accent-red/80 mt-2">{error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
