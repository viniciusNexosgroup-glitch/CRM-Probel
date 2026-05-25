"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  Bot,
  Clock,
  Copy,
  GitBranch,
  HelpCircle,
  MessageSquare,
  Plus,
  Save,
  Tag,
  UserRound,
  UserPlus,
  Webhook,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  SalesbotEdge,
  SalesbotFlow,
  SalesbotNode,
  SalesbotNodeType,
  SalesbotTrigger,
  SalesbotTriggerType,
} from "@/lib/salesbot/types";
import {
  saveSalesbotGraphAction,
  updateSalesbotFlowStatusAction,
  updateSalesbotTriggersAction,
} from "../actions";

type Option = {
  id: string;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  title?: string | null;
  color?: string | null;
  file_type?: string;
};

const NODE_TYPES: Array<{
  type: SalesbotNodeType;
  label: string;
  icon: typeof MessageSquare;
  tone: string;
}> = [
  { type: "send_message", label: "Enviar mensagem", icon: MessageSquare, tone: "text-emerald-400" },
  { type: "ask_question", label: "Fazer pergunta", icon: HelpCircle, tone: "text-sky-400" },
  { type: "capture_response", label: "Capturar resposta", icon: Plus, tone: "text-cyan-400" },
  { type: "wait", label: "Esperar tempo", icon: Clock, tone: "text-amber-400" },
  { type: "condition", label: "Condi\u00e7\u00e3o IF/ELSE", icon: GitBranch, tone: "text-violet-400" },
  { type: "keyword", label: "Mensagem espec\u00edfica", icon: Zap, tone: "text-yellow-400" },
  { type: "add_tag", label: "Adicionar tag", icon: Tag, tone: "text-pink-400" },
  { type: "remove_tag", label: "Remover tag", icon: Tag, tone: "text-red-400" },
  { type: "change_stage", label: "Alterar etapa", icon: GitBranch, tone: "text-blue-400" },
  { type: "assign_user", label: "Alterar respons\u00e1vel", icon: UserRound, tone: "text-orange-400" },
  { type: "create_task", label: "Criar tarefa", icon: Plus, tone: "text-lime-400" },
  { type: "send_media", label: "Enviar m\u00eddia", icon: MessageSquare, tone: "text-teal-400" },
  { type: "handoff", label: "Transferir humano", icon: UserRound, tone: "text-red-400" },
  { type: "notify_user", label: "Notificar vendedor", icon: UserRound, tone: "text-indigo-400" },
  { type: "webhook", label: "Webhook externo", icon: Webhook, tone: "text-slate-300" },
  { type: "ai_response", label: "Resposta com IA", icon: Bot, tone: "text-purple-400" },
  { type: "end_flow", label: "Encerrar fluxo", icon: X, tone: "text-wa-textSecondary" },
];

const TRIGGER_TYPES: Array<{
  type: SalesbotTriggerType;
  label: string;
  description: string;
  icon: typeof MessageSquare;
}> = [
  { type: "lead_created", label: "Novo lead", description: "Quando um lead for criado no CRM.", icon: UserPlus },
  { type: "new_conversation", label: "Nova conversa", description: "Quando uma conversa iniciar em um canal.", icon: MessageSquare },
  { type: "new_message", label: "Nova mensagem", description: "Quando o lead mandar qualquer mensagem.", icon: MessageSquare },
  { type: "keyword_detected", label: "Mensagem espec\u00edfica", description: "Quando a mensagem tiver uma palavra ou frase configurada.", icon: Zap },
  { type: "stage_changed", label: "Mudou de etapa", description: "Quando o lead mudar de etapa no funil.", icon: GitBranch },
  { type: "no_response", label: "Sem resposta", description: "Quando o lead ficar parado por um tempo.", icon: Clock },
  { type: "outside_business_hours", label: "Fora do expediente", description: "Quando a mensagem chegar fora do hor\u00e1rio.", icon: Clock },
  { type: "instagram_comment", label: "Coment\u00e1rio Instagram", description: "Preparado para coment\u00e1rios e DMs do Instagram.", icon: MessageSquare },
];

const DEFAULT_NODE_CONFIG: Record<SalesbotNodeType, Record<string, string>> = {
  send_message: { message: "Ol\u00e1! Como posso ajudar?" },
  ask_question: { question: "Qual produto voc\u00ea procura?", save_as: "interest" },
  capture_response: { field: "notes" },
  wait: { minutes: "5" },
  condition: { field: "interest", operator: "contains", value: "" },
  keyword: { keywords: "pre\u00e7o, or\u00e7amento, entrega", match_mode: "contains" },
  add_tag: { tag_id: "" },
  remove_tag: { tag_id: "" },
  change_stage: { stage_id: "" },
  assign_user: { user_id: "", distribution_strategy: "least_active" },
  create_task: { title: "Retornar contato", due_in_minutes: "60" },
  send_media: { media_id: "", caption: "" },
  handoff: { reason: "Solicitou atendimento humano" },
  notify_user: { user_id: "", message: "Lead precisa de aten\u00e7\u00e3o" },
  end_flow: { reason: "Fluxo encerrado" },
  webhook: { url: "", method: "POST" },
  ai_response: { prompt: "Responda com base no hist\u00f3rico e qualifique o lead." },
};

type Props = {
  flow: SalesbotFlow;
  initialNodes: SalesbotNode[];
  initialEdges: SalesbotEdge[];
  initialTriggers: SalesbotTrigger[];
  stages: Option[];
  tags: Option[];
  profiles: Option[];
  medias: Option[];
};

function createNode(type: SalesbotNodeType, x: number, y: number): SalesbotNode {
  const meta = NODE_TYPES.find((item) => item.type === type) ?? NODE_TYPES[0];
  return {
    node_key: `${type}-${Date.now()}`,
    type,
    label: meta.label,
    position_x: x,
    position_y: y,
    config: DEFAULT_NODE_CONFIG[type],
  };
}

export function SalesbotEditor({
  flow,
  initialNodes,
  initialEdges,
  initialTriggers,
  stages,
  tags,
  profiles,
  medias,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<SalesbotNode[]>(() =>
    initialNodes.length > 0 ? initialNodes : [createNode("send_message", 410, 180)]
  );
  const [edges, setEdges] = useState<SalesbotEdge[]>(initialEdges);
  const [triggers, setTriggers] = useState<Array<Pick<SalesbotTrigger, "type" | "config" | "is_active">>>(() =>
    initialTriggers.length > 0
      ? initialTriggers.map((trigger) => ({
          type: trigger.type,
          config: trigger.config ?? {},
          is_active: trigger.is_active,
        }))
      : [{ type: "lead_created", config: {}, is_active: true }]
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(nodes[0]?.node_key ?? null);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<{
    nodeKey: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedNode = useMemo(
    () => nodes.find((node) => node.node_key === selectedKey) ?? null,
    [nodes, selectedKey]
  );
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.edge_key === selectedEdgeKey) ?? null,
    [edges, selectedEdgeKey]
  );
  const startNodes = useMemo(
    () =>
      nodes.filter((node) => !edges.some((edge) => edge.target_node_key === node.node_key)),
    [edges, nodes]
  );
  const triggerPosition = useMemo(() => {
    const y = startNodes.length > 0
      ? Math.round(startNodes.reduce((sum, node) => sum + Number(node.position_y), 0) / startNodes.length)
      : 180;
    return { x: 90, y };
  }, [startNodes]);
  const activeTrigger = triggers.find((trigger) => trigger.is_active) ?? triggers[0];
  const activeTriggerMeta = TRIGGER_TYPES.find((item) => item.type === activeTrigger?.type) ?? TRIGGER_TYPES[0];
  const TriggerIcon = activeTriggerMeta.icon;

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const type = event.dataTransfer.getData("salesbot/node-type") as SalesbotNodeType;
    if (!type || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const node = createNode(type, event.clientX - rect.left - 90, event.clientY - rect.top - 36);
    setNodes((current) => [...current, node]);
    setSelectedKey(node.node_key);
    setSelectedEdgeKey(null);
  }

  function updateSelected(updates: Partial<SalesbotNode>) {
    if (!selectedNode) return;
    setNodes((current) =>
      current.map((node) =>
        node.node_key === selectedNode.node_key ? { ...node, ...updates } : node
      )
    );
  }

  function updateSelectedConfig(key: string, value: string) {
    if (!selectedNode) return;
    updateSelected({ config: { ...selectedNode.config, [key]: value } });
  }

  function duplicateSelected() {
    if (!selectedNode) return;
    const copy: SalesbotNode = {
      ...selectedNode,
      node_key: `${selectedNode.type}-${Date.now()}`,
      label: `${selectedNode.label} (c\u00f3pia)`,
      position_x: Number(selectedNode.position_x) + 32,
      position_y: Number(selectedNode.position_y) + 32,
      config: { ...selectedNode.config },
    };
    setNodes((current) => [...current, copy]);
    setSelectedKey(copy.node_key);
    setSelectedEdgeKey(null);
  }

  function removeNode(nodeKey: string) {
    setNodes((current) => current.filter((node) => node.node_key !== nodeKey));
    setEdges((current) =>
      current.filter(
        (edge) =>
          edge.source_node_key !== nodeKey &&
          edge.target_node_key !== nodeKey
      )
    );
    setConnectFrom((current) => (current === nodeKey ? null : current));
    setSelectedKey((current) => (current === nodeKey ? null : current));
  }

  function removeSelected() {
    if (!selectedNode) return;
    removeNode(selectedNode.node_key);
  }

  function removeSelectedEdge() {
    if (!selectedEdgeKey) return;
    setEdges((current) => current.filter((edge) => edge.edge_key !== selectedEdgeKey));
    setSelectedEdgeKey(null);
  }

  function updateSelectedEdge(updates: Partial<SalesbotEdge>) {
    if (!selectedEdge) return;
    setEdges((current) =>
      current.map((edge) =>
        edge.edge_key === selectedEdge.edge_key ? { ...edge, ...updates } : edge
      )
    );
  }

  function toggleConnection(nodeKey: string) {
    if (!connectFrom) {
      setConnectFrom(nodeKey);
      setSelectedEdgeKey(null);
      return;
    }
    if (connectFrom === nodeKey) {
      setConnectFrom(null);
      return;
    }
    const edge: SalesbotEdge = {
      edge_key: `edge-${Date.now()}`,
      source_node_key: connectFrom,
      target_node_key: nodeKey,
      label: null,
      condition: {},
    };
    setEdges((current) => [...current, edge]);
    setConnectFrom(null);
    setSelectedEdgeKey(edge.edge_key);
    setSelectedKey(null);
  }

  function save() {
    startTransition(async () => {
      const graphResult = await saveSalesbotGraphAction(flow.id, nodes, edges);
      if (!graphResult.ok) {
        toast.error("Falha ao salvar", { description: graphResult.error });
        return;
      }

      const triggerResult = await updateSalesbotTriggersAction(flow.id, triggers);
      if (!triggerResult.ok) {
        toast.error("Falha ao salvar gatilho", { description: triggerResult.error });
        return;
      }

      toast.success("Fluxo salvo");
    });
  }

  function selectTrigger(type: SalesbotTriggerType) {
    setSelectedKey(null);
    setSelectedEdgeKey(null);
    setTriggers([
      {
        type,
        config: type === "keyword_detected" ? { keywords: "", match_mode: "contains" } : {},
        is_active: true,
      },
    ]);
  }

  function updateTriggerConfig(key: string, value: string) {
    setTriggers((current) =>
      current.map((trigger, index) =>
        index === 0 ? { ...trigger, config: { ...trigger.config, [key]: value } } : trigger
      )
    );
  }

  function setStatus(status: SalesbotFlow["status"]) {
    startTransition(async () => {
      const result = await updateSalesbotFlowStatusAction(flow.id, status);
      if (result.ok) toast.success(status === "active" ? "Fluxo ativado" : "Status atualizado");
      else toast.error("Falha ao atualizar", { description: result.error });
    });
  }

  function startNodeDrag(event: React.MouseEvent<HTMLDivElement>, node: SalesbotNode) {
    if (!canvasRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setSelectedKey(node.node_key);
    setSelectedEdgeKey(null);
    setDraggingNode({
      nodeKey: node.node_key,
      offsetX: event.clientX - rect.left - Number(node.position_x),
      offsetY: event.clientY - rect.top - Number(node.position_y),
    });
  }

  function moveNode(event: React.MouseEvent<HTMLDivElement>) {
    if (!draggingNode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nextX = Math.max(0, event.clientX - rect.left - draggingNode.offsetX);
    const nextY = Math.max(0, event.clientY - rect.top - draggingNode.offsetY);
    setNodes((current) =>
      current.map((node) =>
        node.node_key === draggingNode.nodeKey
          ? { ...node, position_x: Math.round(nextX), position_y: Math.round(nextY) }
          : node
      )
    );
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[260px_1fr_320px] bg-wa-bg">
      <aside className="bg-wa-panel border-r border-wa-border flex flex-col min-h-0">
        <div className="h-11 px-4 border-b border-wa-border flex items-center justify-between">
          <span className="text-sm font-medium text-wa-textPrimary">Gatilhos</span>
          <span className="text-xs text-wa-textSecondary">{TRIGGER_TYPES.length}</span>
        </div>
        <div className="border-b border-wa-border p-2 space-y-1 max-h-[38vh] overflow-y-auto wa-scroll shrink-0">
          {TRIGGER_TYPES.map((item) => {
            const Icon = item.icon;
            const selected = activeTrigger?.type === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => selectTrigger(item.type)}
                className={cn(
                  "w-full min-h-9 px-3 py-2 rounded-md flex items-start gap-2 text-left text-sm transition-colors",
                  selected
                    ? "bg-primary/15 text-primary"
                    : "text-wa-textSecondary hover:bg-wa-hover hover:text-wa-textPrimary"
                )}
              >
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate">{item.label}</span>
                  <span className="block text-[10px] text-wa-textSecondary leading-snug line-clamp-2">{item.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="h-11 px-4 border-b border-wa-border flex items-center justify-between">
          <span className="text-sm font-medium text-wa-textPrimary">Blocos</span>
          <span className="text-xs text-wa-textSecondary">{NODE_TYPES.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto wa-scroll p-2 space-y-1">
          {NODE_TYPES.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                type="button"
                draggable
                onDragStart={(event) => event.dataTransfer.setData("salesbot/node-type", item.type)}
                className="w-full h-10 px-3 rounded-md flex items-center gap-2 text-sm text-wa-textSecondary hover:bg-wa-hover hover:text-wa-textPrimary transition-colors"
              >
                <Icon className={cn("h-4 w-4", item.tone)} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="min-w-0 min-h-0 flex flex-col">
        <div className="h-11 bg-wa-panel border-b border-wa-border px-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={isPending}>
              <Save className="h-4 w-4" />
              Salvar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setStatus("active")} disabled={isPending}>
              Ativar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatus("paused")} disabled={isPending}>
              Pausar
            </Button>
          </div>
          <span className="text-xs text-wa-textSecondary">
            Arraste blocos para o canvas. Use "Conectar" para ligar etapas.
          </span>
        </div>

        <div
          ref={canvasRef}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          onMouseMove={moveNode}
          onMouseUp={() => setDraggingNode(null)}
          onMouseLeave={() => setDraggingNode(null)}
          className="relative flex-1 overflow-auto bg-[radial-gradient(circle_at_1px_1px,rgba(134,150,160,0.18)_1px,transparent_0)] [background-size:24px_24px]"
        >
          <svg className="absolute inset-0 w-[1800px] h-[1200px] pointer-events-none">
            {startNodes.map((startNode) => (
              <path
                key={`trigger-${startNode.node_key}`}
                d={`M ${triggerPosition.x + 180} ${triggerPosition.y + 42} C ${triggerPosition.x + 250} ${triggerPosition.y + 42}, ${Number(startNode.position_x) - 80} ${Number(startNode.position_y) + 42}, ${Number(startNode.position_x)} ${Number(startNode.position_y) + 42}`}
                stroke="#00a884"
                strokeWidth="2"
                fill="none"
                opacity="0.7"
                strokeDasharray="6 6"
              />
            ))}
            {edges.map((edge) => {
              const source = nodes.find((node) => node.node_key === edge.source_node_key);
              const target = nodes.find((node) => node.node_key === edge.target_node_key);
              if (!source || !target) return null;
              const x1 = Number(source.position_x) + 180;
              const y1 = Number(source.position_y) + 42;
              const x2 = Number(target.position_x);
              const y2 = Number(target.position_y) + 42;
              const mid = (x1 + x2) / 2;
              const selectedEdge = selectedEdgeKey === edge.edge_key;
              return (
                <path
                  key={edge.edge_key}
                  d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                  stroke={selectedEdge ? "#f59e0b" : "#00a884"}
                  strokeWidth={selectedEdge ? "4" : "2"}
                  fill="none"
                  opacity={selectedEdge ? "0.95" : "0.75"}
                  className="pointer-events-auto cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedEdgeKey(edge.edge_key);
                    setSelectedKey(null);
                  }}
                />
              );
            })}
          </svg>

          <div className="relative w-[1800px] h-[1200px]">
            <div
              className="absolute w-[180px] rounded-lg border border-primary/60 bg-wa-panel shadow-lg overflow-hidden select-none"
              style={{ left: triggerPosition.x, top: triggerPosition.y }}
            >
              <div className="h-9 px-3 bg-wa-header border-b border-wa-border flex items-center gap-2">
                <TriggerIcon className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-xs font-medium text-wa-textPrimary truncate">{activeTriggerMeta.label}</span>
              </div>
              <div className="p-3 space-y-2">
                <p className="text-[11px] text-wa-textSecondary truncate">
                  {activeTriggerMeta.description}
                </p>
                <div className="h-7 w-full rounded-md bg-primary/10 text-[11px] text-primary flex items-center justify-center">
                  Entrada
                </div>
              </div>
            </div>

            {nodes.map((node) => {
              const meta = NODE_TYPES.find((item) => item.type === node.type) ?? NODE_TYPES[0];
              const Icon = meta.icon;
              const selected = selectedKey === node.node_key;
              return (
                <div
                  key={node.node_key}
                  className={cn(
                    "absolute w-[180px] rounded-lg border bg-wa-panel shadow-lg overflow-hidden cursor-grab active:cursor-grabbing select-none",
                    selected ? "border-primary ring-1 ring-primary/40" : "border-wa-border",
                    connectFrom === node.node_key && "border-amber-400 ring-1 ring-amber-400/40"
                  )}
                  style={{ left: Number(node.position_x), top: Number(node.position_y) }}
                  onClick={() => {
                    setSelectedKey(node.node_key);
                    setSelectedEdgeKey(null);
                  }}
                  onMouseDown={(event) => startNodeDrag(event, node)}
                >
                  <div className="h-9 px-3 bg-wa-header border-b border-wa-border flex items-center gap-2">
                    <Icon className={cn("h-4 w-4 shrink-0", meta.tone)} />
                    <span className="text-xs font-medium text-wa-textPrimary truncate">
                      {node.label}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeNode(node.node_key);
                      }}
                      className="ml-auto text-wa-textSecondary hover:text-red-400 transition-colors"
                      title="Excluir bloco"
                      aria-label="Excluir bloco"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-[11px] text-wa-textSecondary truncate">
                      {String(node.config.message ?? node.config.question ?? node.config.prompt ?? meta.label)}
                    </p>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleConnection(node.node_key);
                      }}
                      className="h-7 w-full rounded-md bg-wa-bg text-[11px] text-wa-textSecondary hover:text-primary transition-colors"
                    >
                      {connectFrom ? "Conectar aqui" : "Conectar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <aside className="bg-wa-panel border-l border-wa-border flex flex-col min-h-0">
        <div className="h-11 px-4 border-b border-wa-border flex items-center justify-between">
          <span className="text-sm font-medium text-wa-textPrimary">{"Configura\u00e7\u00e3o"}</span>
          {selectedNode && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={duplicateSelected} className="text-wa-textSecondary hover:text-primary" title="Duplicar bloco" aria-label="Duplicar bloco">
                <Copy className="h-4 w-4" />
              </button>
              <button type="button" onClick={removeSelected} className="text-wa-textSecondary hover:text-red-400" title="Excluir bloco" aria-label="Excluir bloco">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {selectedNode ? (
          <div className="flex-1 overflow-y-auto wa-scroll p-4 space-y-4">
            <div className="rounded-md border border-wa-border bg-wa-bg/50 px-3 py-2">
              <p className="text-xs text-wa-textSecondary">
                Clique em qualquer card para editar. Arraste pelo card para mover no canvas.
              </p>
            </div>

            <label className="space-y-1 block">
              <span className="text-xs text-wa-textSecondary">Nome do bloco</span>
              <Input value={selectedNode.label} onChange={(event) => updateSelected({ label: event.target.value })} />
            </label>

            {selectedNode.type === "send_message" && (
              <label className="space-y-1 block">
                <span className="text-xs text-wa-textSecondary">Mensagem</span>
                <Textarea value={String(selectedNode.config.message ?? "")} onChange={(event) => updateSelectedConfig("message", event.target.value)} rows={5} />
              </label>
            )}

            {selectedNode.type === "ask_question" && (
              <>
                <label className="space-y-1 block">
                  <span className="text-xs text-wa-textSecondary">Pergunta</span>
                  <Textarea value={String(selectedNode.config.question ?? "")} onChange={(event) => updateSelectedConfig("question", event.target.value)} rows={4} />
                </label>
                <label className="space-y-1 block">
                  <span className="text-xs text-wa-textSecondary">Salvar resposta em</span>
                  <Select value={String(selectedNode.config.save_as ?? "interest")} onChange={(event) => updateSelectedConfig("save_as", event.target.value)}>
                    <option value="name">Nome</option>
                    <option value="phone">Telefone</option>
                    <option value="interest">Produto de interesse</option>
                    <option value="estimated_value">{"Or\u00e7amento"}</option>
                    <option value="source">Origem</option>
                    <option value="notes">{"Observa\u00e7\u00f5es"}</option>
                  </Select>
                </label>
              </>
            )}

            {selectedNode.type === "wait" && (
              <label className="space-y-1 block">
                <span className="text-xs text-wa-textSecondary">Minutos de espera</span>
                <Input value={String(selectedNode.config.minutes ?? "5")} onChange={(event) => updateSelectedConfig("minutes", event.target.value)} />
              </label>
            )}

            {selectedNode.type === "keyword" && (
              <>
                <label className="space-y-1 block">
                  <span className="text-xs text-wa-textSecondary">Mensagem cont\u00e9m</span>
                  <Textarea
                    value={String(selectedNode.config.keywords ?? "")}
                    onChange={(event) => updateSelectedConfig("keywords", event.target.value)}
                    placeholder={"Ex: meta ads, google ads, campanha x"}
                    rows={4}
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="text-xs text-wa-textSecondary">Modo de busca</span>
                  <Select
                    value={String(selectedNode.config.match_mode ?? "contains")}
                    onChange={(event) => updateSelectedConfig("match_mode", event.target.value)}
                  >
                    <option value="contains">{"Cont\u00e9m"}</option>
                    <option value="equals">Igual exatamente</option>
                    <option value="starts_with">{"Come\u00e7a com"}</option>
                  </Select>
                </label>
                <div className="rounded-md border border-wa-border bg-wa-bg/50 px-3 py-2">
                  <p className="text-xs text-wa-textSecondary">
                    Use conex\u00f5es com r\u00f3tulo Sim e N\u00e3o para separar o caminho do fluxo.
                  </p>
                </div>
              </>
            )}

            {(selectedNode.type === "add_tag" || selectedNode.type === "remove_tag") && (
              <label className="space-y-1 block">
                <span className="text-xs text-wa-textSecondary">Tag</span>
                <Select value={String(selectedNode.config.tag_id ?? "")} onChange={(event) => updateSelectedConfig("tag_id", event.target.value)}>
                  <option value="">Selecione</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </Select>
              </label>
            )}

            {selectedNode.type === "change_stage" && (
              <label className="space-y-1 block">
                <span className="text-xs text-wa-textSecondary">Etapa do funil</span>
                <Select value={String(selectedNode.config.stage_id ?? "")} onChange={(event) => updateSelectedConfig("stage_id", event.target.value)}>
                  <option value="">Selecione</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                  ))}
                </Select>
              </label>
            )}

            {(selectedNode.type === "assign_user" || selectedNode.type === "notify_user") && (
              <div className="space-y-3">
                <label className="space-y-1 block">
                  <span className="text-xs text-wa-textSecondary">Vendedor</span>
                  <Select value={String(selectedNode.config.user_id ?? "")} onChange={(event) => updateSelectedConfig("user_id", event.target.value)}>
                    <option value="">Distribuir automaticamente</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.full_name ?? profile.email}</option>
                    ))}
                  </Select>
                </label>
                {selectedNode.type === "assign_user" && !selectedNode.config.user_id && (
                  <label className="space-y-1 block">
                    <span className="text-xs text-wa-textSecondary">Regra de distribui\u00e7\u00e3o</span>
                    <Select
                      value={String(selectedNode.config.distribution_strategy ?? "least_active")}
                      onChange={(event) => updateSelectedConfig("distribution_strategy", event.target.value)}
                    >
                      <option value="least_active">Menos leads ativos</option>
                      <option value="round_robin">Distribui\u00e7\u00e3o por igual</option>
                    </Select>
                  </label>
                )}
              </div>
            )}

            {selectedNode.type === "send_media" && (
              <label className="space-y-1 block">
                <span className="text-xs text-wa-textSecondary">{"M\u00eddia"}</span>
                <Select value={String(selectedNode.config.media_id ?? "")} onChange={(event) => updateSelectedConfig("media_id", event.target.value)}>
                  <option value="">Selecione</option>
                  {medias.map((media) => (
                    <option key={media.id} value={media.id}>{media.title} {"\u00b7"} {media.file_type}</option>
                  ))}
                </Select>
              </label>
            )}

            {selectedNode.type === "ai_response" && (
              <label className="space-y-1 block">
                <span className="text-xs text-wa-textSecondary">{"Instru\u00e7\u00e3o da IA"}</span>
                <Textarea value={String(selectedNode.config.prompt ?? "")} onChange={(event) => updateSelectedConfig("prompt", event.target.value)} rows={6} />
              </label>
            )}

            {selectedNode.type === "webhook" && (
              <>
                <label className="space-y-1 block">
                  <span className="text-xs text-wa-textSecondary">URL</span>
                  <Input value={String(selectedNode.config.url ?? "")} onChange={(event) => updateSelectedConfig("url", event.target.value)} />
                </label>
                <label className="space-y-1 block">
                  <span className="text-xs text-wa-textSecondary">{"M\u00e9todo"}</span>
                  <Select value={String(selectedNode.config.method ?? "POST")} onChange={(event) => updateSelectedConfig("method", event.target.value)}>
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                  </Select>
                </label>
              </>
            )}

            <div className="border-t border-wa-border pt-4 space-y-2">
              <span className="text-xs text-wa-textSecondary">{"Posi\u00e7\u00e3o"}</span>
              <div className="grid grid-cols-2 gap-2">
                <Input value={String(selectedNode.position_x)} onChange={(event) => updateSelected({ position_x: Number(event.target.value) || 0 })} />
                <Input value={String(selectedNode.position_y)} onChange={(event) => updateSelected({ position_y: Number(event.target.value) || 0 })} />
              </div>
            </div>
          </div>
        ) : selectedEdgeKey ? (
          <div className="p-4 space-y-4">
            <div className="rounded-md border border-wa-border bg-wa-bg/50 px-3 py-2">
              <p className="text-xs text-wa-textSecondary">
                Configure a sa\u00edda da conex\u00e3o. Para blocos de mensagem espec\u00edfica, use Sim ou N\u00e3o.
              </p>
            </div>
            <label className="space-y-1 block">
              <span className="text-xs text-wa-textSecondary">Sa\u00edda da conex\u00e3o</span>
              <Select
                value={selectedEdge?.label ?? ""}
                onChange={(event) => updateSelectedEdge({ label: event.target.value || null })}
              >
                <option value="">Padr\u00e3o</option>
                <option value="sim">Sim</option>
                <option value="nao">N\u00e3o</option>
              </Select>
            </label>
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={removeSelectedEdge}
            >
              <X className="h-4 w-4" />
              {"Excluir conex\u00e3o"}
            </Button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="rounded-md border border-wa-border bg-wa-bg/50 px-3 py-2">
              <p className="text-xs text-wa-textSecondary">
                Configure o gatilho inicial ou selecione um bloco/conex\u00e3o no canvas para editar.
              </p>
            </div>
            <label className="space-y-1 block">
              <span className="text-xs text-wa-textSecondary">Gatilho inicial</span>
              <Select value={activeTrigger?.type ?? "lead_created"} onChange={(event) => selectTrigger(event.target.value as SalesbotTriggerType)}>
                {TRIGGER_TYPES.map((trigger) => (
                  <option key={trigger.type} value={trigger.type}>{trigger.label}</option>
                ))}
              </Select>
            </label>
            {activeTrigger?.type === "keyword_detected" && (
              <>
                <label className="space-y-1 block">
                  <span className="text-xs text-wa-textSecondary">Palavras ou frases</span>
                  <Textarea
                    value={String(activeTrigger.config?.keywords ?? "")}
                    onChange={(event) => updateTriggerConfig("keywords", event.target.value)}
                    placeholder={"Ex: pre\u00e7o, or\u00e7amento, quero comprar"}
                    rows={4}
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="text-xs text-wa-textSecondary">Modo de busca</span>
                  <Select
                    value={String(activeTrigger.config?.match_mode ?? "contains")}
                    onChange={(event) => updateTriggerConfig("match_mode", event.target.value)}
                  >
                    <option value="contains">{"Cont\u00e9m"}</option>
                    <option value="equals">Igual exatamente</option>
                    <option value="starts_with">{"Come\u00e7a com"}</option>
                  </Select>
                </label>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
