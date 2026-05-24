import type { SalesbotEdge, SalesbotNode, SalesbotTrigger } from "@/lib/salesbot/types";

export type SalesbotValidationResult = {
  ok: boolean;
  errors: string[];
};

function hasCycle(
  nodeKey: string,
  outgoing: Map<string, string[]>,
  visiting: Set<string>,
  visited: Set<string>
): boolean {
  if (visiting.has(nodeKey)) return true;
  if (visited.has(nodeKey)) return false;

  visiting.add(nodeKey);
  for (const next of outgoing.get(nodeKey) ?? []) {
    if (hasCycle(next, outgoing, visiting, visited)) return true;
  }
  visiting.delete(nodeKey);
  visited.add(nodeKey);
  return false;
}

export function validateSalesbotGraph(
  nodes: Pick<SalesbotNode, "node_key" | "type" | "label">[],
  edges: Pick<SalesbotEdge, "source_node_key" | "target_node_key">[],
  triggers: Pick<SalesbotTrigger, "is_active">[] = []
): SalesbotValidationResult {
  const errors: string[] = [];
  const nodeKeys = new Set(nodes.map((node) => node.node_key));

  if (nodes.length === 0) {
    errors.push("Adicione ao menos um bloco ao fluxo.");
  }

  if (triggers.length === 0 || !triggers.some((trigger) => trigger.is_active)) {
    errors.push("Configure ao menos um gatilho ativo para o fluxo.");
  }

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const node of nodes) {
    incoming.set(node.node_key, 0);
    outgoing.set(node.node_key, []);
  }

  for (const edge of edges) {
    if (!nodeKeys.has(edge.source_node_key)) {
      errors.push(`Conexão com origem inválida: ${edge.source_node_key}.`);
      continue;
    }
    if (!nodeKeys.has(edge.target_node_key)) {
      errors.push(`Conexão com destino inválido: ${edge.target_node_key}.`);
      continue;
    }
    outgoing.get(edge.source_node_key)?.push(edge.target_node_key);
    incoming.set(edge.target_node_key, (incoming.get(edge.target_node_key) ?? 0) + 1);
  }

  if (nodes.length > 1) {
    const startNodes = nodes.filter((node) => (incoming.get(node.node_key) ?? 0) === 0);
    if (startNodes.length !== 1) {
      errors.push("O fluxo deve ter exatamente um bloco inicial.");
    }

    const disconnected = nodes.filter(
      (node) =>
        (incoming.get(node.node_key) ?? 0) === 0 &&
        (outgoing.get(node.node_key)?.length ?? 0) === 0
    );
    if (disconnected.length > 0) {
      errors.push("Remova ou conecte blocos soltos antes de ativar.");
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  for (const node of nodes) {
    if (hasCycle(node.node_key, outgoing, visiting, visited)) {
      errors.push("Remova ciclos do fluxo para evitar loop infinito.");
      break;
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateSalesbotEdgesForSave(
  nodes: Pick<SalesbotNode, "node_key">[],
  edges: Pick<SalesbotEdge, "source_node_key" | "target_node_key">[]
): SalesbotValidationResult {
  const nodeKeys = new Set(nodes.map((node) => node.node_key));
  const errors: string[] = [];

  for (const edge of edges) {
    if (!nodeKeys.has(edge.source_node_key) || !nodeKeys.has(edge.target_node_key)) {
      errors.push("Há conexões apontando para blocos inexistentes.");
      break;
    }
  }

  return { ok: errors.length === 0, errors };
}
