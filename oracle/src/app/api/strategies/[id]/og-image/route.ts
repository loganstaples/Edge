import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getStrategy } from "@/lib/db/queries";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const STATUS_COLORS: Record<string, string> = {
  running: "#34d399",
  paused:  "#fbbf24",
  stopped: "#f87171",
  draft:   "#a1a1aa",
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  ensureInit();

  const strategy = getStrategy(params.id);
  if (!strategy) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  const name = escapeXml(strategy.name ?? "Untitled Strategy");
  const status = strategy.status ?? "draft";
  const statusLabel = escapeXml(status.charAt(0).toUpperCase() + status.slice(1));
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  const idShort = escapeXml(strategy.id.slice(0, 16) + "...");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#09090b"/>
      <stop offset="100%" stop-color="#18181b"/>
    </linearGradient>
  </defs>

  <!-- Background with rounded corners -->
  <rect width="600" height="400" rx="16" ry="16" fill="url(#bg)"/>

  <!-- Subtle border -->
  <rect width="600" height="400" rx="16" ry="16" fill="none" stroke="#27272a" stroke-width="1.5"/>

  <!-- EDGE label top-left -->
  <text x="28" y="40" font-family="monospace, sans-serif" font-size="11" font-weight="600"
        letter-spacing="3" fill="#52525b">EDGE</text>

  <!-- Strategy name, centered vertically -->
  <text x="300" y="195" font-family="system-ui, -apple-system, sans-serif" font-size="32"
        font-weight="700" fill="#fafafa" text-anchor="middle" dominant-baseline="middle"
        style="max-width:540px">${name}</text>

  <!-- Status badge -->
  <rect x="220" y="240" width="160" height="32" rx="8" ry="8" fill="${statusColor}" fill-opacity="0.15"/>
  <rect x="220" y="240" width="160" height="32" rx="8" ry="8" fill="none" stroke="${statusColor}" stroke-width="1.2"/>
  <circle cx="248" cy="256" r="4" fill="${statusColor}"/>
  <text x="262" y="256" font-family="system-ui, -apple-system, sans-serif" font-size="13"
        font-weight="500" fill="${statusColor}" dominant-baseline="middle">${statusLabel}</text>

  <!-- Strategy NFT label bottom-left -->
  <text x="28" y="372" font-family="monospace, sans-serif" font-size="11" fill="#3f3f46">Strategy NFT</text>

  <!-- Strategy ID truncated bottom-right -->
  <text x="572" y="372" font-family="monospace, sans-serif" font-size="11" fill="#3f3f46"
        text-anchor="end">${idShort}</text>
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300",
    },
  });
}
