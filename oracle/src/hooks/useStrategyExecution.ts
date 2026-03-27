"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { ExecutionLogEntry } from "@/types";

export function useStrategyExecution(
  strategyId: string | null,
  status: string,
  pollingInterval: number = 30000
) {
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, string>>({});
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, Record<string, any>>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const executeTick = useCallback(async () => {
    if (!strategyId) return;
    setIsExecuting(true);
    try {
      const res = await fetch(`/api/strategies/${strategyId}/execute-tick`, { method: "POST" });
      if (res.ok) {
        const log: ExecutionLogEntry = await res.json();
        setLogs((prev) => [log, ...prev].slice(0, 50));
        // Extract node statuses and outputs from log
        if (log.nodeLogs) {
          if (log.nodeLogs._nodeStatuses) {
            setNodeStatuses(log.nodeLogs._nodeStatuses as Record<string, string>);
          }
          // Extract per-node outputs for lastOutput
          const outputs: Record<string, Record<string, any>> = {};
          for (const [key, value] of Object.entries(log.nodeLogs)) {
            if (key.startsWith("_")) continue;
            const entry = value as any;
            outputs[key] = entry?.outputs ?? entry ?? {};
          }
          setNodeOutputs(outputs);
        }
      }
    } catch {
      // Silently handle tick failures
    } finally {
      setIsExecuting(false);
    }
  }, [strategyId]);

  useEffect(() => {
    if (status === "running" && strategyId) {
      executeTick();
      intervalRef.current = setInterval(executeTick, pollingInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, strategyId, executeTick, pollingInterval]);

  const totalPnl = logs.reduce((sum, log) => sum + (log.pnlDelta || 0), 0);

  return { logs, isExecuting, totalPnl, nodeStatuses, nodeOutputs };
}
