"use client";

import { NODE_TYPES, NODE_CATEGORIES } from "@/lib/strategy/node-types";
import { DragEvent, useState, useRef, useEffect } from "react";

export function NodePalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const onDragStart = (event: DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow-type", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  // Focus search when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 100);
    } else {
      setSearch("");
    }
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const query = search.toLowerCase().trim();
  const filteredCategories = NODE_CATEGORIES.map((category) => {
    const nodes = Object.values(NODE_TYPES).filter(
      (n) =>
        n.category === category.key &&
        (!query ||
          n.label.toLowerCase().includes(query) ||
          n.description.toLowerCase().includes(query) ||
          category.label.toLowerCase().includes(query))
    );
    return { ...category, nodes };
  }).filter((c) => c.nodes.length > 0);

  return (
    <div className="absolute top-3 left-3 z-10" ref={panelRef}>
      {/* Toggle button — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
        style={{
          background: open
            ? "linear-gradient(145deg, rgba(14, 16, 24, 0.85) 0%, rgba(20, 22, 32, 0.65) 100%)"
            : "linear-gradient(145deg, rgba(14, 16, 24, 0.75) 0%, rgba(20, 22, 32, 0.55) 100%)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          boxShadow:
            "0 4px 20px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.02) inset",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="text-edge-muted"
        >
          <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        <span className="text-[11px] font-medium text-edge-text/80">Nodes</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`text-edge-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown panel */}
      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: open ? "480px" : "0px",
          opacity: open ? 1 : 0,
          marginTop: open ? "6px" : "0px",
        }}
      >
        <div
          className="w-64 rounded-2xl overflow-hidden flex flex-col"
          style={{
            background:
              "linear-gradient(145deg, rgba(14, 16, 24, 0.85) 0%, rgba(20, 22, 32, 0.65) 100%)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            boxShadow:
              "0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.02) inset, 0 1px 0 rgba(255, 255, 255, 0.04) inset",
            maxHeight: "480px",
          }}
        >
          {/* Top accent line */}
          <div
            className="absolute top-0 left-4 right-4 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.4), rgba(168, 85, 247, 0.3), transparent)",
            }}
          />

          {/* Search bar */}
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
                className="text-edge-muted/50 flex-shrink-0"
              >
                <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
                <path d="M8.5 8.5L11.5 11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search nodes..."
                className="bg-transparent text-[11px] text-edge-text placeholder:text-edge-muted/40 outline-none w-full"
              />
            </div>
          </div>

          {/* Node list */}
          <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-3 space-y-3">
            {filteredCategories.map((category) => (
              <div key={category.key}>
                {/* Category header */}
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: category.color,
                      boxShadow: `0 0 6px ${category.color}60`,
                    }}
                  />
                  <h3
                    className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: `${category.color}cc` }}
                  >
                    {category.label}
                  </h3>
                </div>

                {/* Node items */}
                <div className="space-y-0.5">
                  {category.nodes.map((node) => (
                    <div
                      key={node.type}
                      draggable="true"
                      onDragStart={(e) => onDragStart(e, node.type)}
                      className="group flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl cursor-grab
                        transition-all duration-200
                        hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: "transparent",
                        border: "1px solid transparent",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `linear-gradient(135deg, ${node.color}10 0%, ${node.color}05 100%)`;
                        e.currentTarget.style.border = `1px solid ${node.color}20`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.border = "1px solid transparent";
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                        style={{
                          background: `${node.color}12`,
                          border: `1px solid ${node.color}18`,
                        }}
                      >
                        {node.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-medium text-edge-text/90 group-hover:text-white truncate transition-colors">
                          {node.label}
                        </div>
                        <div className="text-[9px] text-edge-muted/60 leading-tight mt-0.5 truncate">
                          {node.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {filteredCategories.length === 0 && (
              <div className="text-[11px] text-edge-muted/50 text-center py-6">
                No nodes match &ldquo;{search}&rdquo;
              </div>
            )}
          </div>

          {/* Bottom fade */}
          <div
            className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none rounded-b-2xl"
            style={{
              background:
                "linear-gradient(to top, rgba(14, 16, 24, 0.9), transparent)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
