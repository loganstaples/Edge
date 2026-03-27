"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { ExecutionLogEntry } from "@/types";
import type { LiveStats } from "@/components/builder/LiveStatsBar";

const STARTING_BALANCE = 10000;

export function useStrategyExecution(
  strategyId: string | null,
  status: string,
  pollingInterval: number = 30000
) {
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, string>>({});
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, Record<string, any>>>({});
  const [activeNodeIds, setActiveNodeIds] = useState<Set<string>>(new Set());
  const [equityHistory, setEquityHistory] = useState<number[]>([STARTING_BALANCE]);
  const [liveStats, setLiveStats] = useState<LiveStats>({
    totalPnl: 0,
    balance: STARTING_BALANCE,
    startingBalance: STARTING_BALANCE,
    sharpeRatio: 0,
    totalTrades: 0,
    winRate: 0,
    maxDrawdown: 0,
    tickCount: 0,
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const returnsRef = useRef<number[]>([]);

  const executeTick = useCallback(async () => {
    if (!strategyId) return;
    setIsExecuting(true);

    // Briefly light up all nodes as "active" at the start of a tick
    try {
      const res = await fetch(`/api/strategies/${strategyId}/execute-tick`, { method: "POST" });
      if (res.ok) {
        const log: ExecutionLogEntry = await res.json();
        setLogs((prev) => [log, ...prev].slice(0, 50));

        // Extract node statuses and outputs from log
        if (log.nodeLogs) {
          const statuses = (log.nodeLogs._nodeStatuses ?? {}) as Record<string, string>;
          setNodeStatuses(statuses);

          // Mark nodes as active temporarily (staggered to simulate sequential execution)
          const nodeIds = Object.keys(statuses);
          nodeIds.forEach((nodeId, index) => {
            const delay = index * 300; // stagger 300ms per node

            setTimeout(() => {
              setActiveNodeIds((prev) => new Set(prev).add(nodeId));

              // Clear active after 800ms
              const clearTimer = setTimeout(() => {
                setActiveNodeIds((prev) => {
                  const next = new Set(prev);
                  next.delete(nodeId);
                  return next;
                });
              }, 800);

              activeTimersRef.current.set(nodeId, clearTimer);
            }, delay);
          });

          // Extract per-node outputs for lastOutput
          const outputs: Record<string, Record<string, any>> = {};
          for (const [key, value] of Object.entries(log.nodeLogs)) {
            if (key.startsWith("_")) continue;
            const entry = value as any;
            outputs[key] = entry?.outputs ?? entry ?? {};
          }
          setNodeOutputs(outputs);
        }

        // Update equity history and stats
        const pnlDelta = log.pnlDelta || 0;
        const hasTrade = log.tradePlaced;

        setEquityHistory((prev) => {
          const lastEquity = prev[prev.length - 1] ?? STARTING_BALANCE;
          const newEquity = lastEquity + pnlDelta;
          return [...prev, newEquity].slice(-200); // keep last 200 ticks
        });

        // Track returns for Sharpe calculation
        if (pnlDelta !== 0) {
          returnsRef.current.push(pnlDelta);
        }

        setLiveStats((prev) => {
          const newBalance = prev.balance + pnlDelta;
          const newTotalPnl = prev.totalPnl + pnlDelta;
          const newTrades = prev.totalTrades + (hasTrade ? 1 : 0);
          const newWinning = (prev.winRate / 100 * prev.totalTrades) + (hasTrade && pnlDelta > 0 ? 1 : 0);
          const newWinRate = newTrades > 0 ? (newWinning / newTrades) * 100 : 0;
          const tickCount = prev.tickCount + 1;

          // Sharpe ratio (annualized approximation)
          const returns = returnsRef.current;
          let sharpe = 0;
          if (returns.length >= 2) {
            const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
            const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
            const std = Math.sqrt(variance);
            sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0;
          }

          // Max drawdown
          const equity = [...(returnsRef.current.reduce<number[]>((acc, r) => {
            acc.push((acc[acc.length - 1] ?? STARTING_BALANCE) + r);
            return acc;
          }, [STARTING_BALANCE]))];
          let peak = equity[0];
          let maxDD = 0;
          for (const eq of equity) {
            if (eq > peak) peak = eq;
            const dd = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
            if (dd > maxDD) maxDD = dd;
          }

          return {
            totalPnl: newTotalPnl,
            balance: newBalance,
            startingBalance: STARTING_BALANCE,
            sharpeRatio: sharpe,
            totalTrades: newTrades,
            winRate: newWinRate,
            maxDrawdown: maxDD,
            tickCount,
          };
        });
      }
    } catch {
      // Silently handle tick failures
    } finally {
      setIsExecuting(false);
    }
  }, [strategyId]);

  useEffect(() => {
    if (status === "running" && strategyId) {
      // Reset stats on fresh start
      setEquityHistory([STARTING_BALANCE]);
      returnsRef.current = [];
      setLiveStats({
        totalPnl: 0,
        balance: STARTING_BALANCE,
        startingBalance: STARTING_BALANCE,
        sharpeRatio: 0,
        totalTrades: 0,
        winRate: 0,
        maxDrawdown: 0,
        tickCount: 0,
      });

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

  // Cleanup active node timers
  useEffect(() => {
    return () => {
      activeTimersRef.current.forEach((timer) => clearTimeout(timer));
      activeTimersRef.current.clear();
    };
  }, []);

  const totalPnl = logs.reduce((sum, log) => sum + (log.pnlDelta || 0), 0);

  return { logs, isExecuting, totalPnl, nodeStatuses, nodeOutputs, activeNodeIds, equityHistory, liveStats };
}
