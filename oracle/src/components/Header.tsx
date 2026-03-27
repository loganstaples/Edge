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
            {tabs.map((tab) => {
              const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`relative px-3 py-3 text-sm transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-edge-muted hover:text-edge-text-2"
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-white rounded-full" />
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
    </header>
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
