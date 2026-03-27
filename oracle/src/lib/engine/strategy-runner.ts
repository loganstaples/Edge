import type { ExecutionLogEntry } from "@/types";
import { getStrategy } from "@/lib/db/queries";
import { insertExecutionLog, getExecutionLogs } from "@/lib/db/queries";
import { executeStrategy } from "./executor";
import { processTrades, updateOpenTrades, computePerformanceMetrics } from "./paper-trader";

export async function runStrategyTick(strategyId: string): Promise<ExecutionLogEntry | null> {
  const strategy = getStrategy(strategyId);
  if (!strategy || strategy.status !== "running") return null;

  const execResult = await executeStrategy(strategy);

  // Process paper trades
  if (execResult.tradesPlaced.length > 0) {
    await processTrades(strategyId, execResult.tradesPlaced);
  }

  // Update open trade P&Ls
  await updateOpenTrades(strategyId);

  // Compute performance metrics
  computePerformanceMetrics(strategyId);

  // Build node status map for frontend visualization
  const nodeStatuses: Record<string, string> = {};
  for (const output of execResult.nodeOutputs) {
    nodeStatuses[output.nodeId] = output.status;
  }

  // Log the execution
  insertExecutionLog({
    strategyId,
    nodeLogs: {
      ...Object.fromEntries(execResult.nodeOutputs.map((o) => [o.nodeId, o])),
      _nodeStatuses: nodeStatuses,
    },
    tradePlaced: execResult.tradesPlaced.length > 0,
    tradeDetails: execResult.tradesPlaced.length > 0 ? execResult.tradesPlaced[0] as any : undefined,
    pnlDelta: 0, // Updated on next tick when prices change
  });

  const logs = getExecutionLogs(strategyId, 1);
  return logs[0] ?? null;
}
