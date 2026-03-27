"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Builder" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/marketplace", label: "Marketplace" },
];

export function Header() {
  const pathname = usePathname();

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
          {tabs.map((tab) => {
            const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative px-3 py-3 text-[13px] transition-colors ${
                  isActive
                    ? "font-medium text-edge-text"
                    : "text-edge-muted hover:text-edge-text-2"
                }`}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-accent-blue to-accent-purple rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right: Connection status */}
      <div className="flex items-center gap-5 text-xs text-edge-text-2">
        <StatusDot label="Gemini" connected />
        <StatusDot label="Polymarket" connected />
      </div>
    </div>
  );
}

function StatusDot({ label, connected }: { label: string; connected: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-40" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${connected ? "bg-accent-green" : "bg-accent-amber"}`}
        />
      </span>
      <span className="font-medium">{label}</span>
    </span>
  );
}
