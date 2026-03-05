"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import type { PipelineSpec, AgentSpec, AgentArchetype } from "@/types/pipeline";
import { Lock } from "lucide-react";

// ── Props ────────────────────────────────────────────────────────────────────

interface PipelineGraphProps {
  spec: PipelineSpec;
  onAgentClick: (agent: AgentSpec) => void;
  selectedAgentId: string | null;
}

// ── Archetype colour mapping ─────────────────────────────────────────────

const DATA_ARCHETYPES = new Set(["Ingestion", "Enrichment", "Validation", "Transformation"]);
const INTEL_ARCHETYPES = new Set(["Research", "Analysis", "Scoring", "Classification"]);
const COMM_ARCHETYPES = new Set(["Copywriter", "Outreach", "Summarization", "Report"]);
const COORD_ARCHETYPES = new Set(["Scheduler", "Router", "OrchestratorSub"]);
const QS_ARCHETYPES = new Set(["QA", "Compliance", "Deduplication"]);
const MON_ARCHETYPES = new Set(["Logging", "Notification", "Watchdog"]);

function archetypeColor(archetype: AgentArchetype): {
  bg: string;
  border: string;
  text: string;
} {
  if (DATA_ARCHETYPES.has(archetype))
    return { bg: "bg-blue-950", border: "border-blue-700", text: "text-blue-400" };
  if (INTEL_ARCHETYPES.has(archetype))
    return { bg: "bg-purple-950", border: "border-purple-700", text: "text-purple-400" };
  if (COMM_ARCHETYPES.has(archetype))
    return { bg: "bg-emerald-950", border: "border-emerald-700", text: "text-emerald-400" };
  if (COORD_ARCHETYPES.has(archetype))
    return { bg: "bg-yellow-950", border: "border-yellow-700", text: "text-yellow-400" };
  if (QS_ARCHETYPES.has(archetype))
    return { bg: "bg-red-950", border: "border-red-700", text: "text-red-400" };
  if (MON_ARCHETYPES.has(archetype))
    return { bg: "bg-zinc-800", border: "border-zinc-600", text: "text-zinc-400" };
  return { bg: "bg-zinc-800", border: "border-zinc-600", text: "text-zinc-400" };
}

// ── Custom Agent Node ────────────────────────────────────────────────────────

type AgentNodeData = {
  role: string;
  archetype: AgentArchetype;
  toolCount: number;
  requiresApproval: boolean;
  isSelected: boolean;
};

function AgentNode({ data }: NodeProps<Node<AgentNodeData>>) {
  const colors = archetypeColor(data.archetype);

  return (
    <div
      className={`rounded-xl border-2 px-4 py-3 min-w-45 backdrop-blur-sm ${colors.bg} ${
        data.isSelected ? "border-white shadow-lg shadow-white/5" : colors.border
      } transition-all duration-150`}
    >
      <Handle type="target" position={Position.Top} className="bg-zinc-500! w-2! h-2!" />
      <div className="text-sm font-medium text-white">{data.role}</div>
      <div className={`text-xs mt-0.5 ${colors.text}`}>{data.archetype}</div>
      <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
        <span>{data.toolCount} tools</span>
        {data.requiresApproval && (
          <span title="Requires approval"><Lock className="size-3 text-amber-400" /></span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="bg-zinc-500! w-2! h-2!" />
    </div>
  );
}

const nodeTypes = { agent: AgentNode };

// ── Dagre layout ─────────────────────────────────────────────────────────────

const NODE_WIDTH = 200;
const NODE_HEIGHT = 90;

function layoutGraph(
  nodes: Node<AgentNodeData>[],
  edges: Edge[],
  flowEdges: PipelineSpec["orchestration"]["flow"]
) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const fe of flowEdges) {
    const from = fe.from === "START" ? null : fe.from;
    const to = fe.to === "END" ? null : fe.to;
    if (from && to && g.hasNode(from) && g.hasNode(to)) {
      g.setEdge(from, to);
    }
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function PipelineGraph({
  spec,
  onAgentClick,
  selectedAgentId,
}: PipelineGraphProps) {
  const parallelAgentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of spec.orchestration.parallel_groups) {
      for (const id of group) ids.add(id);
    }
    return ids;
  }, [spec.orchestration.parallel_groups]);

  const { initialNodes, initialEdges } = useMemo(() => {
    const agentMap = new Map(spec.agents.map((a) => [a.agent_id, a]));

    const rawNodes: Node<AgentNodeData>[] = spec.agents.map((agent) => ({
      id: agent.agent_id,
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        role: agent.role,
        archetype: agent.archetype,
        toolCount: agent.tools.length,
        requiresApproval: agent.requires_approval,
        isSelected: agent.agent_id === selectedAgentId,
      },
    }));

    const rawEdges: Edge[] = spec.orchestration.flow
      .filter(
        (e) =>
          e.from !== "START" &&
          e.to !== "END" &&
          agentMap.has(e.from) &&
          agentMap.has(e.to)
      )
      .map((e, i) => {
        const isParallel =
          parallelAgentIds.has(e.from) && parallelAgentIds.has(e.to);
        return {
          id: `e-${i}`,
          source: e.from,
          target: e.to,
          label: e.condition ?? undefined,
          animated: isParallel,
          style: isParallel
            ? { stroke: "#a78bfa", strokeDasharray: "5 5" }
            : { stroke: "#52525b" },
          labelStyle: { fill: "#a1a1aa", fontSize: 11 },
        };
      });

    const layoutedNodes = layoutGraph(rawNodes, rawEdges, spec.orchestration.flow);

    return { initialNodes: layoutedNodes, initialEdges: rawEdges };
  }, [spec, selectedAgentId, parallelAgentIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const agent = spec.agents.find((a) => a.agent_id === node.id);
      if (agent) onAgentClick(agent);
    },
    [spec.agents, onAgentClick]
  );

  return (
    <div className="h-full w-full min-h-125 rounded-xl ring-1 ring-white/6 bg-zinc-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-zinc-950"
      >
        <Background color="#27272a" gap={20} />
        <Controls
          className="bg-zinc-900! border-zinc-700! rounded-lg! [&>button]:bg-zinc-800! [&>button]:border-zinc-700! [&>button]:text-zinc-400! [&>button:hover]:bg-zinc-700!"
        />
      </ReactFlow>
    </div>
  );
}
