"use client";

import { useCallback, useState, useRef, useEffect, Suspense, DragEvent } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useSearchParams } from "next/navigation";

import { nodeTypeComponents } from "./nodes";
import { NODE_TYPES, type NodeTypeDefinition } from "@/lib/strategy/node-types";
import { NodePalette } from "./NodePalette";
import { StrategyToolbar } from "./StrategyToolbar";
import { AIPromptBar } from "./AIPromptBar";
import { EmptyCanvas } from "./EmptyCanvas";
import { DragFromPortMenu } from "./DragFromPortMenu";
import { LiveStatsBar } from "./LiveStatsBar";
import { useStrategy, serializeNodes, serializeEdges } from "@/hooks/useStrategy";
import { useStrategyVault } from "@/hooks/useStrategyVault";
import { useStrategyExecution } from "@/hooks/useStrategyExecution";
import { useWallet } from "@/hooks/useWallet";
import { usePaymentStream } from "@/hooks/usePaymentStream";
import { MiniActivityFeed } from "./MiniActivityFeed";
import { PaymentModal } from "./PaymentModal";
import { StreamIndicator } from "./StreamIndicator";
import { TICK_COST_USDC } from "@/lib/payments/constants";

type StrategyStatus = "draft" | "running" | "paused" | "stopped";

const AUTO_CONNECT_THRESHOLD = 80;

let nodeIdCounter = 0;
function getNextNodeId() {
  nodeIdCounter += 1;
  return `node_${Date.now()}_${nodeIdCounter}`;
}

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: "#6b6b7b", strokeWidth: 2 },
};

function CanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [strategyName, setStrategyName] = useState("Untitled Strategy");
  const [strategyStatus, setStrategyStatus] = useState<StrategyStatus>("draft");
  const [aiLoading] = useState(false);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [isStreamingIn, setIsStreamingIn] = useState(false);
  const [streamingSettle, setStreamingSettle] = useState(false);
  const isStreamingRef = useRef(false);
  const streamCategoryCountRef = useRef<Record<string, number>>({});
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const aiPromptRef = useRef<HTMLTextAreaElement>(null);

  // Drag-from-port menu state
  const [portMenu, setPortMenu] = useState<{
    position: { x: number; y: number };
    sourceNodeId: string;
    sourceCategory: string;
  } | null>(null);

  const { strategy, isSaving, isMinting, save, mintNft, load, deploy, pause, setPublic } = useStrategy();
  const vault = useStrategyVault();
  const wallet = useWallet();
  const paymentStream = usePaymentStream();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const searchParams = useSearchParams();

  // In slow mode, space ticks far enough apart so all node glows finish before the next tick
  // Each node gets 1200ms stagger + 1800ms glow, so total animation ≈ nodes*1200 + 1800
  const nodeCount = nodes.length || 1;
  const pollingInterval = slowMode
    ? Math.max(nodeCount * 1200 + 2500, 8000)
    : turboMode ? 5000 : 30000;
  const { logs, isExecuting, totalPnl, nodeStatuses, nodeOutputs, activeNodeIds, equityHistory, liveStats } = useStrategyExecution(
    strategy?.id ?? null,
    strategyStatus,
    pollingInterval,
    slowMode
  );

  // Record payment tick when execution ticks happen
  const prevTickCount = useRef(0);
  useEffect(() => {
    if (liveStats.tickCount > prevTickCount.current && paymentStream.stream?.status === "active") {
      paymentStream.recordTick(TICK_COST_USDC);
    }
    prevTickCount.current = liveStats.tickCount;
  }, [liveStats.tickCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply node statuses, outputs, and active state from execution ticks
  useEffect(() => {
    const hasStatuses = nodeStatuses && Object.keys(nodeStatuses).length > 0;
    const hasOutputs = nodeOutputs && Object.keys(nodeOutputs).length > 0;
    const hasActive = activeNodeIds.size > 0;
    if (!hasStatuses && !hasOutputs && !hasActive) return;
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          ...(hasStatuses ? { status: nodeStatuses[n.id] || "idle" } : {}),
          ...(hasOutputs && nodeOutputs[n.id] ? { lastOutput: nodeOutputs[n.id] } : {}),
          isActive: activeNodeIds.has(n.id),
        },
      }))
    );
  }, [nodeStatuses, nodeOutputs, activeNodeIds, setNodes]);

  // Load strategy from URL param on mount
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setStrategyLoading(true);
      load(id, wallet.address, wallet.signMessage)
        .then((result) => {
          if (result) {
            setNodes(result.nodes);
            setEdges(result.edges);
            setStrategyName(result.name);
            setStrategyStatus(result.status as StrategyStatus);
          }
        })
        .catch(() => {})
        .finally(() => setStrategyLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, ...defaultEdgeOptions }, eds));
    },
    [setEdges]
  );

  // Auto-connect: when a node is dropped near another node's output port
  const tryAutoConnect = useCallback(
    (newNodeId: string, newNodePosition: { x: number; y: number }) => {
      const newNodeDef = nodes.find((n) => n.id === newNodeId);
      if (!newNodeDef?.type) return;
      const def = NODE_TYPES[newNodeDef.type];
      if (!def || def.handles.inputs.length === 0) return;

      for (const existingNode of nodes) {
        if (existingNode.id === newNodeId) continue;
        const existingDef = NODE_TYPES[existingNode.type as string];
        if (!existingDef || existingDef.handles.outputs.length === 0) continue;

        // Check distance from existing node's right side to new node's left side
        const existingRight = existingNode.position.x + 220; // approximate node width
        const dx = Math.abs(newNodePosition.x - existingRight);
        const dy = Math.abs(newNodePosition.y - existingNode.position.y);

        if (dx < AUTO_CONNECT_THRESHOLD && dy < AUTO_CONNECT_THRESHOLD) {
          // Auto-connect
          const sourceHandle = existingDef.handles.outputs[0];
          const targetHandle = def.handles.inputs[0];
          setEdges((eds) =>
            addEdge(
              {
                id: `auto_${existingNode.id}_${newNodeId}`,
                source: existingNode.id,
                target: newNodeId,
                sourceHandle,
                targetHandle,
                ...defaultEdgeOptions,
              },
              eds
            )
          );
          return; // Only auto-connect to one node
        }
      }
    },
    [nodes, setEdges]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData("application/reactflow-type");
      if (!nodeType || !NODE_TYPES[nodeType]) return;

      const def = NODE_TYPES[nodeType];
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds || !rfInstance) return;

      const position = rfInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const newId = getNextNodeId();
      const newNode: Node = {
        id: newId,
        type: nodeType,
        position,
        data: { config: { ...def.defaultConfig } },
      };

      setNodes((nds) => [...nds, newNode]);

      // Try auto-connect after a tick (so the node is in the array)
      setTimeout(() => tryAutoConnect(newId, position), 0);
    },
    [rfInstance, setNodes, tryAutoConnect]
  );

  // Drag-from-port: when user drags from output into empty space
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement;
      // If the connection was completed (landed on a handle), don't show menu
      if (target.classList.contains("react-flow__handle")) return;

      // Find which node the drag started from
      // React Flow 12 uses .connecting or .connectingfrom — try both
      const sourceHandle = document.querySelector(".react-flow__handle.connectingfrom") || document.querySelector(".react-flow__handle.connecting");
      if (!sourceHandle) return;

      const sourceNodeEl = sourceHandle.closest(".react-flow__node");
      if (!sourceNodeEl) return;

      const sourceNodeId = sourceNodeEl.getAttribute("data-id");
      if (!sourceNodeId) return;

      const sourceNode = nodes.find((n) => n.id === sourceNodeId);
      if (!sourceNode?.type) return;

      const sourceDef = NODE_TYPES[sourceNode.type];
      if (!sourceDef) return;

      const clientX = "clientX" in event ? event.clientX : event.touches?.[0]?.clientX ?? 0;
      const clientY = "clientY" in event ? event.clientY : event.touches?.[0]?.clientY ?? 0;

      setPortMenu({
        position: { x: clientX, y: clientY },
        sourceNodeId,
        sourceCategory: sourceDef.category,
      });
    },
    [nodes]
  );

  const handlePortMenuSelect = useCallback(
    (nodeTypes: string[]) => {
      if (!portMenu || !rfInstance) return;

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const basePosition = rfInstance.screenToFlowPosition({
        x: portMenu.position.x - bounds.left,
        y: portMenu.position.y - bounds.top,
      });

      let prevId = portMenu.sourceNodeId;
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      nodeTypes.forEach((nodeType, i) => {
        const def = NODE_TYPES[nodeType];
        if (!def) return;

        const newId = getNextNodeId();
        const position = { x: basePosition.x + i * 250, y: basePosition.y };

        newNodes.push({
          id: newId,
          type: nodeType,
          position,
          data: { config: { ...def.defaultConfig } },
        });

        // Connect to previous node
        const prevDef = i === 0
          ? NODE_TYPES[nodes.find((n) => n.id === prevId)?.type as string]
          : NODE_TYPES[nodeTypes[i - 1]];

        if (prevDef) {
          newEdges.push({
            id: `port_${prevId}_${newId}`,
            source: prevId,
            target: newId,
            sourceHandle: prevDef.handles.outputs[0],
            targetHandle: def.handles.inputs[0],
            animated: true,
            style: { stroke: "#6b6b7b", strokeWidth: 2 },
          });
        }

        prevId = newId;
      });

      setNodes((nds) => [...nds, ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);
      setPortMenu(null);
    },
    [portMenu, rfInstance, nodes, setNodes, setEdges]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
        e.preventDefault();
        aiPromptRef.current?.focus();
      }
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleDeploy();
      }
      if (e.key === "d" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        // Duplicate selected nodes
        const selected = nodes.filter((n) => n.selected);
        if (selected.length === 0) return;
        const newNodes = selected.map((n) => ({
          ...n,
          id: getNextNodeId(),
          position: { x: n.position.x + 30, y: n.position.y + 30 },
          selected: false,
        }));
        setNodes((nds) => [...nds, ...newNodes]);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    if (!wallet.isConnected || !wallet.address) {
      wallet.connect();
      return;
    }

    // Unlock vault if not already (derives encryption key)
    if (!vault.isUnlocked) {
      await vault.unlock(wallet.address, wallet.signMessage);
    }

    const isNew = !strategy?.id;
    const id = await save(strategyName, nodes, edges, wallet.address, wallet.signMessage, vault.getKey());
    window.history.replaceState(null, "", `?id=${id}`);

    // Update vault cache with current nodes
    vault.put(id, serializeNodes(nodes), serializeEdges(edges));

    // Mint NFT for new strategies
    if (isNew && wallet.address) {
      try {
        const phantom = (window as any).phantom?.solana;
        if (phantom) {
          await mintNft(id, wallet.address, strategyName, {
            publicKey: phantom.publicKey,
            signTransaction: (tx: any) => phantom.signTransaction(tx),
            signAllTransactions: (txs: any) => phantom.signAllTransactions(txs),
          });
        }
      } catch (err: any) {
        console.warn("NFT minting skipped:", err.message);
      }
    }
  }, [strategyName, nodes, edges, save, mintNft, wallet, strategy?.id, vault]);

  const handleDeploy = useCallback(async () => {
    // Show payment modal — user must connect wallet and confirm stream
    setShowPaymentModal(true);
  }, []);

  const handleConfirmDeploy = useCallback(async () => {
    setShowPaymentModal(false);
    // Auto-save before deploying so strategy.id is set
    await handleSave();
    // Start payment stream
    if (wallet.address && strategy?.id) {
      await paymentStream.startStream(strategy.id, wallet.address, pollingInterval);
    }
    await deploy(wallet.address);
    setStrategyStatus("running");
  }, [deploy, handleSave, wallet.address, strategy?.id, paymentStream, pollingInterval]);

  const handlePause = useCallback(async () => {
    await paymentStream.pauseStream();
    await pause(wallet.address);
    setStrategyStatus("paused");
  }, [pause, paymentStream, wallet.address]);

  const handleStop = useCallback(async () => {
    await paymentStream.stopStream();
    setStrategyStatus("stopped");
  }, [paymentStream]);

  // --- Streaming: clear canvas and prepare for incremental node rendering ---
  const handleStreamStart = useCallback(() => {
    setIsStreamingIn(true);
    isStreamingRef.current = true;
    streamCategoryCountRef.current = {};
    setNodes([]);
    setEdges([]);
  }, [setNodes, setEdges]);

  // --- Streaming: add newly parsed nodes with entrance animation ---
  const CATEGORY_COL: Record<string, number> = { data: 0, ai: 1, logic: 2, action: 3 };

  const handleStreamingNodes = useCallback(
    (rawNodes: any[]) => {
      const nodesToAdd: Node[] = rawNodes.map((n: any) => {
        const def = NODE_TYPES[n.type] as NodeTypeDefinition | undefined;
        const cat = def?.category ?? n.category ?? "data";
        const col = CATEGORY_COL[cat] ?? 0;
        const row = streamCategoryCountRef.current[cat] ?? 0;
        streamCategoryCountRef.current[cat] = row + 1;

        return {
          id: n.id,
          type: n.type,
          position: { x: col * 350, y: row * 220 },
          className: "streaming-node-enter",
          data: { config: n.config ?? {} },
        };
      });

      setNodes((nds) => [...nds, ...nodesToAdd]);

      // Remove entrance class after animation completes
      const ids = new Set(nodesToAdd.map((n) => n.id));
      setTimeout(() => {
        setNodes((nds) =>
          nds.map((n) =>
            ids.has(n.id) ? { ...n, className: undefined } : n
          )
        );
      }, 600);
    },
    [setNodes]
  );

  const handleStrategyGenerated = useCallback(
    (generatedNodes: any[], connections: any[], name?: string) => {
      const newNodes: Node[] = generatedNodes.map((n: any) => ({
        id: n.id,
        type: n.type,
        position: n.position ?? { x: 0, y: 0 },
        data: { config: n.config ?? {} },
      }));

      const newEdges: Edge[] = connections.map((c: any, i: number) => ({
        id: `edge_gen_${i}`,
        source: c.source_id,
        target: c.target_id,
        sourceHandle: c.source_handle,
        targetHandle: c.target_handle,
        ...defaultEdgeOptions,
      }));

      if (isStreamingRef.current) {
        // Animate nodes to their final auto-layout positions
        setStreamingSettle(true);
        setNodes(newNodes);

        // Fade in edges after positions start settling
        setTimeout(() => {
          setEdges(newEdges);
        }, 350);

        // Fit view and clean up streaming state
        setTimeout(() => {
          rfInstance?.fitView({ padding: 0.15, duration: 400 });
        }, 500);

        setTimeout(() => {
          setStreamingSettle(false);
          setIsStreamingIn(false);
          isStreamingRef.current = false;
        }, 900);
      } else {
        setNodes(newNodes);
        setEdges(newEdges);
      }

      if (name) setStrategyName(name);
    },
    [setNodes, setEdges, rfInstance]
  );

  const handleLoadTemplate = useCallback(
    (templateNodes: Node[], templateEdges: Edge[], name: string) => {
      setNodes(templateNodes);
      setEdges(templateEdges);
      setStrategyName(name);
    },
    [setNodes, setEdges]
  );

  return (
    <div className="h-screen flex flex-col bg-edge-bg">
      <StrategyToolbar
        name={strategyName}
        status={strategyStatus}
        isSaving={isSaving}
        isMinting={isMinting}
        turboMode={turboMode}
        slowMode={slowMode}
        isPublic={strategy?.isPublic}
        nftMint={strategy?.nftMint}
        ownerWallet={strategy?.ownerWallet}
        onNameChange={setStrategyName}
        onSave={handleSave}
        onDeploy={handleDeploy}
        onPause={handlePause}
        onToggleTurbo={() => { setTurboMode((t) => !t); if (!turboMode) setSlowMode(false); }}
        onToggleSlow={() => { setSlowMode((s) => !s); if (!slowMode) setTurboMode(false); }}
        onTogglePublic={() => setPublic(!strategy?.isPublic, wallet.address)}
        onStop={handleStop}
        stream={paymentStream.stream}
        walletBalance={wallet.balance}
        walletConnected={wallet.isConnected}
        walletAddress={wallet.address}
        onConnectWallet={wallet.connect}
        onDisconnectWallet={wallet.disconnect}
      />
      {/* Live stats bar — visible when strategy is running */}
      {(strategyStatus === "running" || strategyStatus === "paused") && liveStats.tickCount > 0 && (
        <LiveStatsBar
          stats={liveStats}
          equityHistory={equityHistory}
          isExecuting={isExecuting}
        />
      )}

      <div className="flex-1 min-h-0 min-w-0 relative" ref={reactFlowWrapper}>
        <NodePalette />
          {strategyLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-edge-bg/80">
              <p className="text-edge-muted text-sm animate-pulse-soft">Loading strategy...</p>
            </div>
          )}
          {!strategyLoading && nodes.length === 0 && (
            <EmptyCanvas onLoadTemplate={handleLoadTemplate} />
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectEnd={onConnectEnd}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onInit={setRfInstance}
            nodeTypes={nodeTypeComponents}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionLineStyle={{ stroke: "#9b9bb0", strokeWidth: 2, strokeDasharray: "6 3" }}
            fitView
            proOptions={{ hideAttribution: true }}
            className={`bg-edge-bg ${nodes.length === 0 ? "react-flow-default-cursor" : ""} ${streamingSettle ? "streaming-settle" : ""} ${isStreamingIn && !streamingSettle ? "streaming-edges-enter" : ""}`}
          >
            <MiniMap
              nodeColor="#2a2a2e"
              maskColor="rgba(9, 9, 11, 0.7)"
              style={{ backgroundColor: "#111113" }}
            />
            <Background color="rgba(255, 255, 255, 0.03)" gap={24} size={1} />
          </ReactFlow>

          {/* Reset canvas button — top-right, only when nodes exist */}
          {nodes.length > 0 && (
            <button
              onClick={() => {
                setNodes([]);
                setEdges([]);
                setStrategyName("Untitled Strategy");
                setStrategyStatus("draft");
              }}
              className="absolute top-4 right-4 z-20 group flex items-center gap-2 px-3 py-2 rounded-xl glass transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
              style={{
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.35)",
              }}
              title="Reset canvas"
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
                className="text-edge-muted group-hover:text-edge-text transition-colors duration-200"
              >
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              <span className="text-[11px] font-medium text-edge-muted group-hover:text-edge-text transition-colors duration-200">
                Reset
              </span>
            </button>
          )}

          {/* AI Prompt — floating at bottom center */}
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-20">
            <AIPromptBar
              onStrategyGenerated={handleStrategyGenerated}
              onStreamStart={handleStreamStart}
              onStreamingNodes={handleStreamingNodes}
              isLoading={aiLoading}
              inputRef={aiPromptRef}
              existingNodes={nodes}
              existingEdges={edges}
              strategyName={strategyName}
            />
          </div>

          {/* Drag-from-port menu */}
          {portMenu && (
            <DragFromPortMenu
              position={portMenu.position}
              sourceCategory={portMenu.sourceCategory}
              onSelect={handlePortMenuSelect}
              onClose={() => setPortMenu(null)}
            />
          )}
      </div>
      <MiniActivityFeed
        logs={logs}
        isExecuting={isExecuting}
        totalPnl={totalPnl}
      />
      <PaymentModal
        isOpen={showPaymentModal}
        walletAddress={wallet.address}
        walletBalance={wallet.balance}
        isConnected={wallet.isConnected}
        isConnecting={wallet.isConnecting}
        pollingIntervalMs={pollingInterval}
        onConnect={wallet.connect}
        onConfirm={handleConfirmDeploy}
        onCancel={() => setShowPaymentModal(false)}
      />
    </div>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <Suspense>
        <CanvasInner />
      </Suspense>
    </ReactFlowProvider>
  );
}
