"use client";
import { useState } from "react";
import { TEMPLATES, type StrategyTemplate } from "@/lib/strategy/templates";
import type { Node, Edge } from "@xyflow/react";

interface EmptyCanvasProps {
  onLoadTemplate: (nodes: Node[], edges: Edge[], name: string) => void;
}

// Each template gets a unique accent color for its glow
const TEMPLATE_ACCENTS: Record<string, { glow: string; border: string; icon_bg: string }> = {
  "Edge Trader": {
    glow: "rgba(129, 140, 248, 0.08)",
    border: "rgba(129, 140, 248, 0.15)",
    icon_bg: "rgba(129, 140, 248, 0.1)",
  },
  "News Reactive": {
    glow: "rgba(167, 139, 250, 0.08)",
    border: "rgba(167, 139, 250, 0.15)",
    icon_bg: "rgba(167, 139, 250, 0.1)",
  },
  "Price Watcher": {
    glow: "rgba(52, 211, 153, 0.08)",
    border: "rgba(52, 211, 153, 0.15)",
    icon_bg: "rgba(52, 211, 153, 0.1)",
  },
  "Contrarian Play": {
    glow: "rgba(251, 191, 36, 0.08)",
    border: "rgba(251, 191, 36, 0.15)",
    icon_bg: "rgba(251, 191, 36, 0.1)",
  },
  "Sniper": {
    glow: "rgba(248, 113, 113, 0.08)",
    border: "rgba(248, 113, 113, 0.15)",
    icon_bg: "rgba(248, 113, 113, 0.1)",
  },
};

const DEFAULT_ACCENT = {
  glow: "rgba(129, 140, 248, 0.08)",
  border: "rgba(129, 140, 248, 0.15)",
  icon_bg: "rgba(129, 140, 248, 0.1)",
};

export function EmptyCanvas({ onLoadTemplate }: EmptyCanvasProps) {
  const [view, setView] = useState<"chooser" | "templates">("chooser");
  const [dismissed, setDismissed] = useState(false);

  const handleTemplate = (template: StrategyTemplate) => {
    const nodes = template.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { config: n.config },
    }));
    const edges = template.connections.map((c) => ({
      id: c.id,
      source: c.source_id,
      target: c.target_id,
      sourceHandle: c.source_handle,
      targetHandle: c.target_handle,
      animated: true,
      style: { stroke: "#5a5f7a" },
    }));
    onLoadTemplate(nodes, edges, template.name);
  };

  if (dismissed) return null;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none" style={{ paddingBottom: "5%" }}>
      <div className="pointer-events-auto w-full max-w-[680px] px-6">
        {view === "chooser" ? (
          <ChooserView
            onScratch={() => setDismissed(true)}
            onTemplate={() => setView("templates")}
          />
        ) : (
          <TemplatePickerView
            onBack={() => setView("chooser")}
            onSelect={handleTemplate}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chooser — Two big cards                                            */
/* ------------------------------------------------------------------ */

function ChooserView({
  onScratch,
  onTemplate,
}: {
  onScratch: () => void;
  onTemplate: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      {/* Heading */}
      <h2 className="text-3xl font-semibold text-edge-text tracking-tight mb-2">
        Build a strategy
      </h2>
      <p className="text-base text-edge-muted mb-8">
        How would you like to get started?
      </p>

      {/* Two big cards */}
      <div className="grid grid-cols-2 gap-5 w-full">
        {/* Start from Scratch */}
        <button
          onClick={onScratch}
          className="group relative text-left rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 focus:outline-none"
          style={{
            background:
              "linear-gradient(145deg, rgba(14, 16, 24, 0.88) 0%, rgba(20, 22, 32, 0.68) 100%)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            boxShadow:
              "0 4px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.02) inset",
          }}
        >
          {/* Hover glow */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(129, 140, 248, 0.10) 0%, transparent 70%)",
              border: "1px solid rgba(129, 140, 248, 0.18)",
              borderRadius: "inherit",
            }}
          />

          {/* Top accent line */}
          <div
            className="h-[2px] w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.5), rgba(99, 102, 241, 0.4), transparent)",
            }}
          />

          {/* Inner glow from top */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 70% 40% at 50% -10%, rgba(129, 140, 248, 0.04) 0%, transparent 70%)",
            }}
          />

          <div className="relative p-7 pb-6 flex flex-col min-h-[190px]">
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(129,140,248,0.12)]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(129, 140, 248, 0.12) 0%, rgba(99, 102, 241, 0.06) 100%)",
                border: "1px solid rgba(129, 140, 248, 0.10)",
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(129, 140, 248, 0.9)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>

            {/* Title */}
            <div className="text-[15px] font-semibold text-edge-text group-hover:text-white transition-colors duration-200 mb-1.5">
              Start from scratch
            </div>

            {/* Description */}
            <p className="text-[12px] text-edge-muted leading-relaxed">
              Build your own strategy node by node using the visual canvas and
              node palette
            </p>

            {/* Bottom hint */}
            <div className="mt-auto pt-4">
              <span className="text-[10px] text-edge-dim uppercase tracking-wider font-medium flex items-center gap-1.5 group-hover:text-edge-muted transition-colors duration-200">
                <span className="inline-block w-1 h-1 rounded-full bg-accent-blue/50 group-hover:bg-accent-blue transition-colors duration-200" />
                Blank canvas
              </span>
            </div>
          </div>
        </button>

        {/* Start with a Template */}
        <button
          onClick={onTemplate}
          className="group relative text-left rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 focus:outline-none"
          style={{
            background:
              "linear-gradient(145deg, rgba(14, 16, 24, 0.88) 0%, rgba(20, 22, 32, 0.68) 100%)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            boxShadow:
              "0 4px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.02) inset",
          }}
        >
          {/* Hover glow */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(167, 139, 250, 0.10) 0%, transparent 70%)",
              border: "1px solid rgba(167, 139, 250, 0.18)",
              borderRadius: "inherit",
            }}
          />

          {/* Top accent line */}
          <div
            className="h-[2px] w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(167, 139, 250, 0.5), rgba(139, 92, 246, 0.4), transparent)",
            }}
          />

          {/* Inner glow from top */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 70% 40% at 50% -10%, rgba(167, 139, 250, 0.04) 0%, transparent 70%)",
            }}
          />

          <div className="relative p-7 pb-6 flex flex-col min-h-[190px]">
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(167,139,250,0.12)]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(167, 139, 250, 0.12) 0%, rgba(139, 92, 246, 0.06) 100%)",
                border: "1px solid rgba(167, 139, 250, 0.10)",
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(167, 139, 250, 0.9)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>

            {/* Title */}
            <div className="text-[15px] font-semibold text-edge-text group-hover:text-white transition-colors duration-200 mb-1.5">
              Use a template
            </div>

            {/* Description */}
            <p className="text-[12px] text-edge-muted leading-relaxed">
              Choose from pre-built strategies and customize them to fit your
              trading thesis
            </p>

            {/* Bottom hint */}
            <div className="mt-auto pt-4">
              <span className="text-[10px] text-edge-dim uppercase tracking-wider font-medium flex items-center gap-1.5 group-hover:text-edge-muted transition-colors duration-200">
                <span className="inline-block w-1 h-1 rounded-full bg-accent-purple/50 group-hover:bg-accent-purple transition-colors duration-200" />
                {TEMPLATES.length} templates
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Subtle AI hint */}
      <p className="text-[13px] text-edge-dim mt-6 text-center">
        Or describe your strategy in the AI bar below
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Template Picker — shown after clicking "Use a template"            */
/* ------------------------------------------------------------------ */

function TemplatePickerView({
  onBack,
  onSelect,
}: {
  onBack: () => void;
  onSelect: (t: StrategyTemplate) => void;
}) {
  return (
    <div className="flex flex-col items-center">
      {/* Back + heading */}
      <button
        onClick={onBack}
        className="self-start flex items-center gap-1.5 text-[12px] text-edge-muted hover:text-edge-text transition-colors duration-200 mb-4 group"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="group-hover:-translate-x-0.5 transition-transform duration-200"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>

      <h2 className="text-2xl font-semibold text-edge-text tracking-tight mb-1.5">
        Choose a template
      </h2>
      <p className="text-[15px] text-edge-muted mb-6">
        Pre-built strategies you can customize
      </p>

      {/* Template grid */}
      <div className="grid grid-cols-3 gap-3 w-full mb-3">
        {TEMPLATES.slice(0, 3).map((t) => (
          <TemplateCard key={t.name} template={t} onClick={onSelect} />
        ))}
      </div>
      <div className="flex justify-center gap-3 w-full">
        {TEMPLATES.slice(3).map((t) => (
          <div key={t.name} className="w-[calc(33.333%-4px)]">
            <TemplateCard template={t} onClick={onSelect} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Template Card                                                      */
/* ------------------------------------------------------------------ */

function TemplateCard({
  template,
  onClick,
}: {
  template: StrategyTemplate;
  onClick: (t: StrategyTemplate) => void;
}) {
  const accent = TEMPLATE_ACCENTS[template.name] ?? DEFAULT_ACCENT;
  const nodeCount = template.nodes.length;

  return (
    <button
      onClick={() => onClick(template)}
      className="group relative text-left w-full rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(135deg, rgba(14, 16, 24, 0.85) 0%, rgba(20, 22, 32, 0.65) 100%)`,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid rgba(255, 255, 255, 0.04)`,
      }}
    >
      {/* Hover glow effect */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${accent.glow} 0%, transparent 70%)`,
          border: `1px solid ${accent.border}`,
          borderRadius: "inherit",
        }}
      />

      {/* Top gradient line */}
      <div
        className="h-[1px] w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent.border}, transparent)`,
        }}
      />

      <div className="relative p-4">
        {/* Icon */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg mb-3 transition-colors duration-300"
          style={{
            background: accent.icon_bg,
          }}
        >
          {template.icon}
        </div>

        {/* Title */}
        <div className="text-[13px] font-semibold text-edge-text group-hover:text-white transition-colors duration-200 mb-1">
          {template.name}
        </div>

        {/* Description */}
        <div className="text-[11px] text-edge-muted leading-relaxed mb-3">
          {template.description}
        </div>

        {/* Node count pill */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-edge-dim px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.04]">
            {nodeCount} nodes
          </span>
        </div>
      </div>
    </button>
  );
}
