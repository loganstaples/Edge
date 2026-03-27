"use client";
import { memo } from "react";
import { useEdges, useNodes } from "@xyflow/react";
import { NodeShell, useNodeConfig, selectClass, inputClass } from "./NodeShell";
import { getUpstreamFields } from "@/lib/strategy/upstream";

const COMPARATORS = [">", "<", ">=", "<=", "==", "!=", "between"];
const ROUTE_COLORS = ["#22d3ee", "#a78bfa", "#fb923c", "#4ade80"];

interface Route {
  label: string;
  field: string;
  comparator: string;
  value: string;
  is_default?: boolean;
}

function RouterNodeComponent({ id, type, data, selected }: any) {
  const config = data?.config ?? {};
  const update = useNodeConfig(id);
  const edges = useEdges();
  const nodes = useNodes();
  const upstreamFields = getUpstreamFields(id, nodes, edges);
  const lastOutput = data?.lastOutput;

  const routes: Route[] = config.routes ?? [
    { label: "Route 1", field: "", comparator: ">", value: "" },
    { label: "Route 2", field: "", comparator: "<=", value: "" },
  ];

  const updateRoute = (index: number, key: keyof Route, value: any) => {
    const next = [...routes];
    next[index] = { ...next[index], [key]: value };
    update("routes", next);
  };

  const addRoute = () => {
    if (routes.length < 4) {
      update("routes", [...routes, { label: `Route ${routes.length + 1}`, field: "", comparator: ">", value: "" }]);
    }
  };

  const removeRoute = (index: number) => {
    if (routes.length > 2) {
      update("routes", routes.filter((_: Route, i: number) => i !== index));
    }
  };

  return (
    <NodeShell id={id} type={type} selected={selected} status={data?.status} width="w-[260px]">
      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
        {routes.map((route: Route, i: number) => (
          <div key={i} className="space-y-0.5">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ROUTE_COLORS[i] }} />
              <input
                className={`${inputClass} !text-[10px] !px-1 !py-0.5 flex-1`}
                value={route.label}
                onChange={(e) => updateRoute(i, "label", e.target.value)}
                placeholder="Label"
              />
              {routes.length > 2 && (
                <button onClick={() => removeRoute(i)} className="text-edge-dim hover:text-accent-red text-xs flex-shrink-0">&times;</button>
              )}
            </div>
            {!route.is_default && (
              <div className="flex items-center gap-1 pl-3">
                <select className={`${selectClass} flex-1 !text-[9px] !px-1 !py-0.5`} value={route.field} onChange={(e) => updateRoute(i, "field", e.target.value)}>
                  <option value="">Field...</option>
                  {upstreamFields.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <select className={`${selectClass} !w-10 !text-[9px] !px-1 !py-0.5`} value={route.comparator} onChange={(e) => updateRoute(i, "comparator", e.target.value)}>
                  {COMPARATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                </select>
                <input className={`${inputClass} !w-12 !text-[9px] !px-1 !py-0.5`} value={route.value} onChange={(e) => updateRoute(i, "value", e.target.value)} placeholder="val" />
              </div>
            )}
            <label className="flex items-center gap-1 pl-3 text-[9px] text-edge-dim">
              <input type="checkbox" checked={route.is_default ?? false} onChange={(e) => updateRoute(i, "is_default", e.target.checked)} className="node-checkbox" />
              Default
            </label>
          </div>
        ))}
      </div>
      {routes.length < 4 && (
        <button onClick={addRoute} className="text-[9px] text-accent-blue hover:text-accent-blue/80 mt-1">+ Add route</button>
      )}
      {lastOutput?._router_active_route != null && (
        <div className="mt-1 flex items-center gap-1.5 text-[9px]">
          <div className="w-2 h-2 rounded-full" style={{ background: ROUTE_COLORS[lastOutput._router_active_route] }} />
          <span className="text-edge-muted">{routes[lastOutput._router_active_route]?.label ?? "—"}</span>
        </div>
      )}
    </NodeShell>
  );
}

export const RouterNode = memo(RouterNodeComponent);
