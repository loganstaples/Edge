"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Builder" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/marketplace", label: "Marketplace" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 h-full">
      {tabs.map((tab) => {
        const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="relative px-4 py-3 text-sm transition-colors"
          >
            <span
              className={
                isActive
                  ? "text-edge-text font-medium"
                  : "text-edge-muted hover:text-edge-text-2"
              }
            >
              {tab.label}
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-accent-blue to-accent-purple rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
