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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const executeTick = useCallback(async () => {
    if (!strategyId) return;
    setIsExecuting(true);
    try {
      const res = await fetch(`/api/strategies/${strategyId}/execute-tick`, { method: "POST" });
      if (res.ok) {
        const log: ExecutionLogEntry = await res.json();
        setLogs((prev) => [log, ...prev].slice(0, 50));
        // Extract node statuses from log
        if (log.nodeLogs?._nodeStatuses) {
          setNodeStatuses(log.nodeLogs._nodeStatuses as Record<string, string>);
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

  return { logs, isExecuting, totalPnl, nodeStatuses };
}
