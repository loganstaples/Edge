"use client";
import { NODE_TYPES } from "@/lib/strategy/node-types";

interface MenuItem {
  label: string;
  types: string[]; // node types to create (1 for single, 2 for combo)
}

const SUGGESTIONS: Record<string, MenuItem[]> = {
  data: [
    { label: "AI Estimate", types: ["ai_estimate"] },
    { label: "AI + Edge Calc", types: ["ai_estimate", "edge_calc"] },
    { label: "Sentiment", types: ["sentiment"] },
    { label: "Gate", types: ["gate"] },
    { label: "Trade", types: ["trade"] },
  ],
  ai: [
    { label: "Edge Calc", types: ["edge_calc"] },
    { label: "Gate", types: ["gate"] },
    { label: "Trade", types: ["trade"] },
    { label: "Alert", types: ["alert"] },
  ],
  logic: [
    { label: "Trade", types: ["trade"] },
    { label: "Alert", types: ["alert"] },
    { label: "Cooldown", types: ["cooldown"] },
    { label: "Time Window", types: ["time_window"] },
  ],
  action: [],
};

interface DragFromPortMenuProps {
  position: { x: number; y: number };
  sourceCategory: string;
  onSelect: (nodeTypes: string[]) => void;
  onClose: () => void;
}

export function DragFromPortMenu({ position, sourceCategory, onSelect, onClose }: DragFromPortMenuProps) {
  const items = SUGGESTIONS[sourceCategory] ?? [];
  if (items.length === 0) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50" onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()} />
      {/* Menu */}
      <div
        className="fixed z-50 bg-edge-surface border border-edge-border rounded-lg shadow-xl py-1.5 min-w-[160px]"
        style={{ left: position.x, top: position.y }}
      >
        <div className="px-3 py-1 text-[10px] text-edge-dim uppercase tracking-wider">
          Add next step
        </div>
        {items.map((item) => {
          const def = NODE_TYPES[item.types[0]];
          return (
            <button
              key={item.label}
              onClick={() => { onSelect(item.types); onClose(); }}
              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-edge-surface-2 transition-colors"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: def?.color ?? '#888', boxShadow: `0 0 6px ${def?.color ?? '#888'}60` }} />
              <span className="text-xs text-edge-text">{item.label}</span>
              {item.types.length > 1 && (
                <span className="text-[9px] text-accent-blue ml-auto">combo</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
