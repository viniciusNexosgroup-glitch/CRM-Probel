import { createServiceClient } from "@/lib/supabase/server";
import { evolution } from "@/lib/evolution/client";
import { salesbotDb, type UntypedSupabase } from "@/lib/salesbot/db";
import type { Json, MessageType } from "@/types/database";
import type { SalesbotEdge, SalesbotFlow, SalesbotNode, SalesbotTrigger } from "@/lib/salesbot/types";
import { validateSalesbotGraph } from "@/lib/salesbot/validation";

type SalesbotContext = {
  event: "new_message" | "new_conversation";
  flowId?: string;
  instanceId: string;
  conversationId: string;
  contactId: string;
  leadId: string | null;
  remoteJid: string;
  messageText: string | null;
  evolutionMessageId: string | null;
};

type FlowBundle = {
  flow: SalesbotFlow;
  triggers: SalesbotTrigger[];
  nodes: SalesbotNode[];
  edges: SalesbotEdge[];
};

type ExecutionResult = {
  stop?: boolean;
  wait?: boolean;
  responseSent?: boolean;
  handoff?: boolean;
  branch?: "yes" | "no";
  variables?: Record<string, Json | undefined>;
};

export type SalesbotRunResult = {
  executed: boolean;
  responseSent: boolean;
  handoff: boolean;
};

const MAX_STEPS = 40;
const LEAD_FIELDS = new Set([
  "name",
  "phone",
  "source",
  "interest",
  "estimated_value",
  "notes",
  "next_action",
  "lost_reason",
]);

function asRecord(value: unknown): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>;
  }
  return {};
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeMethod(value: unknown): "GET" | "POST" {
  return textValue(value).toUpperCase() === "GET" ? "GET" : "POST";
}

function normalizeMediaType(value: unknown): "image" | "video" | "document" {
  const mediaType = textValue(value);
  if (mediaType === "image" || mediaType === "video") return mediaType;
  return "document";
}

async function logExecution(
  db: UntypedSupabase,
  executionId: string,
  flowId: string,
  nodeKey: string | null,
  level: "debug" | "info" | "warning" | "error",
  message: string,
  data: Record<string, Json | undefined> = {}
) {
  await db.from("salesbot_execution_logs").insert({
    execution_id: executionId,
    flow_id: flowId,
    node_key: nodeKey,
    level,
    message,
    data,
  });
}

async function insertOutgoingMessage(
  db: UntypedSupabase,
  context: SalesbotContext,
  payload: {
    evolutionMessageId: string;
    messageType: MessageType;
    content: string | null;
    mediaUrl?: string | null;
    mediaMimetype?: string | null;
    mediaFilename?: string | null;
    mediaCaption?: string | null;
  }
) {
  const now = new Date().toISOString();
  await db.from("messages").insert({
    conversation_id: context.conversationId,
    instance_id: context.instanceId,
    evolution_message_id: payload.evolutionMessageId,
    remote_jid: context.remoteJid,
    from_me: true,
    message_type: payload.messageType,
    content: payload.content,
    media_url: payload.mediaUrl ?? null,
    media_mimetype: payload.mediaMimetype ?? null,
    media_filename: payload.mediaFilename ?? null,
    media_caption: payload.mediaCaption ?? null,
    status: "sent",
    timestamp: now,
  });

  await db
    .from("conversations")
    .update({
      last_message_text: payload.content || payload.mediaCaption || "Mensagem enviada",
      last_message_at: now,
      last_message_from_me: true,
      unread_count: 0,
    })
    .eq("id", context.conversationId);
}

function chooseNextNodeKey(
  node: SalesbotNode,
  edges: SalesbotEdge[],
  context: SalesbotContext,
  result: ExecutionResult
): string | null {
  const outgoing = edges.filter((edge) => edge.source_node_key === node.node_key);
  if (outgoing.length === 0) return null;

  if (node.type === "keyword" || node.type === "condition") {
    const branch = result.branch ?? "no";
    const preferred = outgoing.find((edge) => {
      const label = edge.label?.toLowerCase();
      if (branch === "yes") return label === "sim" || label === "yes" || label === "true";
      return label === "n\u00e3o" || label === "nao" || label === "no" || label === "false";
    });
    return (preferred ?? outgoing[0]).target_node_key;
  }

  return outgoing[0].target_node_key;
}

async function getLeadData(db: UntypedSupabase, leadId: string | null): Promise<Record<string, Json | undefined>> {
  if (!leadId) return {};
  const { data } = await db.from("leads").select("*").eq("id", leadId).maybeSingle();
  return asRecord(data);
}

function evaluateCondition(
  config: Record<string, Json | undefined>,
  context: SalesbotContext,
  lead: Record<string, Json | undefined>
): boolean {
  const field = textValue(config.field) || "message";
  const operator = textValue(config.operator) || "contains";
  const expected = textValue(config.value).toLowerCase();
  const raw = field === "message" ? context.messageText : lead[field];
  const actual = String(raw ?? "").toLowerCase();

  if (operator === "equals") return actual === expected;
  if (operator === "not_contains") return !actual.includes(expected);
  if (operator === "exists") return actual.trim().length > 0;
  if (operator === "not_exists") return actual.trim().length === 0;
  return actual.includes(expected);
}

async function callAiResponse(
  db: UntypedSupabase,
  flowId: string,
  context: SalesbotContext,
  prompt: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return "No momento vou transferir seu atendimento para um vendedor.";
  }

  const [leadRes, messagesRes, knowledgeRes, settingsRes] = await Promise.all([
    context.leadId ? db.from("leads").select("*").eq("id", context.leadId).maybeSingle() : Promise.resolve({ data: null }),
    db
      .from("messages")
      .select("from_me, content, message_type, timestamp")
      .eq("conversation_id", context.conversationId)
      .order("timestamp", { ascending: false })
      .limit(12),
    db
      .from("salesbot_knowledge_base")
      .select("title, content")
      .eq("is_active", true)
      .limit(5),
    db.from("salesbot_ai_settings").select("*").eq("flow_id", flowId).maybeSingle(),
  ]);

  const lead = leadRes.data ? JSON.stringify(leadRes.data) : "Sem lead vinculado.";
  const history = (messagesRes.data ?? [])
    .reverse()
    .map((msg: { from_me: boolean; content: string | null; message_type: string }) =>
      `${msg.from_me ? "Atendente" : "Lead"} (${msg.message_type}): ${msg.content ?? ""}`
    )
    .join("\n");
  const knowledge = (knowledgeRes.data ?? [])
    .map((item: { title: string; content: string }) => `${item.title}: ${item.content}`)
    .join("\n\n");
  const settings = asRecord(settingsRes.data);
  const model = textValue(settings.model) || "gpt-4.1-mini";
  const systemPrompt =
    textValue(settings.system_prompt) ||
    "Voce e um assistente comercial do CRM. Responda de forma objetiva, nao invente dados e encaminhe para humano quando houver incerteza.";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            `Instrucao do bloco: ${prompt}`,
            `Lead: ${lead}`,
            `Historico:\n${history}`,
            `Base de conhecimento:\n${knowledge || "Vazia"}`,
            `Mensagem atual: ${context.messageText ?? ""}`,
          ].join("\n\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const fallback = textValue(settings.fallback_message);
    return fallback || "Nao consegui responder com seguranca agora. Vou chamar um atendente.";
  }
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return body.choices?.[0]?.message?.content?.trim() || "Vou chamar um atendente para continuar seu atendimento.";
}

async function executeNode(
  db: UntypedSupabase,
  node: SalesbotNode,
  context: SalesbotContext,
  executionId: string,
  flowId: string
): Promise<ExecutionResult> {
  const config = asRecord(node.config);

  switch (node.type) {
    case "send_message":
    case "ask_question": {
      const text =
        textValue(config.message) ||
        textValue(config.question) ||
        "Ol\u00e1! Como posso ajudar?";
      const sent = await evolution.sendText(context.remoteJid, text);
      await insertOutgoingMessage(db, context, {
        evolutionMessageId: sent.key.id,
        messageType: "text",
        content: text,
      });
      await logExecution(db, executionId, flowId, node.node_key, "info", "Mensagem enviada");
      return { responseSent: true };
    }

    case "capture_response": {
      const field = textValue(config.field) || textValue(config.save_as) || "notes";
      if (context.leadId && LEAD_FIELDS.has(field)) {
        await db.from("leads").update({ [field]: context.messageText ?? "" }).eq("id", context.leadId);
      }
      await logExecution(db, executionId, flowId, node.node_key, "info", "Resposta capturada", { field });
      return { variables: { [field]: context.messageText } };
    }

    case "wait": {
      const minutes = Math.max(1, Number(config.minutes ?? 5));
      await logExecution(db, executionId, flowId, node.node_key, "info", "Fluxo pausado para espera", { minutes });
      return { stop: true, wait: true, variables: { wait_minutes: minutes } };
    }

    case "condition": {
      const lead = await getLeadData(db, context.leadId);
      const matched = evaluateCondition(config, context, lead);
      await logExecution(db, executionId, flowId, node.node_key, "info", matched ? "Condi\u00e7\u00e3o verdadeira" : "Condi\u00e7\u00e3o falsa");
      return { branch: matched ? "yes" : "no" };
    }

    case "keyword": {
      const keywords = textValue(config.keywords)
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      const message = (context.messageText ?? "").toLowerCase();
      const matched = keywords.some((keyword) => message.includes(keyword));
      await logExecution(db, executionId, flowId, node.node_key, "info", matched ? "Palavra-chave detectada" : "Palavra-chave n\u00e3o detectada");
      return { branch: matched ? "yes" : "no", variables: { keyword_matched: matched } };
    }

    case "add_tag": {
      if (context.leadId && typeof config.tag_id === "string" && config.tag_id) {
        await db
          .from("lead_tags")
          .upsert(
            { lead_id: context.leadId, tag_id: config.tag_id },
            { onConflict: "lead_id,tag_id" }
          );
      }
      await logExecution(db, executionId, flowId, node.node_key, "info", "Tag adicionada");
      return {};
    }

    case "remove_tag": {
      if (context.leadId && typeof config.tag_id === "string" && config.tag_id) {
        await db
          .from("lead_tags")
          .delete()
          .eq("lead_id", context.leadId)
          .eq("tag_id", config.tag_id);
      }
      await logExecution(db, executionId, flowId, node.node_key, "info", "Tag removida");
      return {};
    }

    case "change_stage": {
      if (context.leadId && typeof config.stage_id === "string" && config.stage_id) {
        await db.from("leads").update({ stage_id: config.stage_id }).eq("id", context.leadId);
      }
      await logExecution(db, executionId, flowId, node.node_key, "info", "Etapa alterada");
      return {};
    }

    case "assign_user": {
      const userId = typeof config.user_id === "string" && config.user_id ? config.user_id : null;
      if (userId) {
        await db.from("conversations").update({ assigned_to: userId }).eq("id", context.conversationId);
        if (context.leadId) await db.from("leads").update({ assigned_to: userId }).eq("id", context.leadId);
      }
      await logExecution(db, executionId, flowId, node.node_key, "info", "Respons\u00e1vel alterado");
      return {};
    }

    case "create_task": {
      const dueInMinutes = Number(config.due_in_minutes ?? 60);
      const dueAt = new Date(Date.now() + Math.max(1, dueInMinutes) * 60_000).toISOString();
      await db.from("tasks").insert({
        lead_id: context.leadId,
        contact_id: context.contactId,
        title: textValue(config.title) || "Retornar contato",
        description: textValue(config.description) || null,
        due_at: dueAt,
        assigned_to: textValue(config.user_id) || null,
      });
      await logExecution(db, executionId, flowId, node.node_key, "info", "Tarefa criada");
      return {};
    }

    case "send_media": {
      const mediaId = textValue(config.media_id);
      const { data: media } = mediaId
        ? await db
            .from("media_library")
            .select("title, file_url, file_type, mimetype")
            .eq("id", mediaId)
            .maybeSingle()
        : { data: null };
      if (!media?.file_url) throw new Error("M\u00eddia n\u00e3o encontrada para envio.");

      const mediaType = normalizeMediaType(media.file_type);
      const caption = textValue(config.caption);
      const sent = await evolution.sendMedia(context.remoteJid, {
        mediatype: mediaType,
        media: media.file_url,
        mimetype: media.mimetype ?? undefined,
        caption: caption || undefined,
        fileName: media.title ?? undefined,
      });
      await insertOutgoingMessage(db, context, {
        evolutionMessageId: sent.key.id,
        messageType: mediaType as MessageType,
        content: caption || null,
        mediaUrl: media.file_url,
        mediaMimetype: media.mimetype ?? null,
        mediaFilename: media.title ?? null,
        mediaCaption: caption || null,
      });
      await logExecution(db, executionId, flowId, node.node_key, "info", "M\u00eddia enviada");
      return { responseSent: true };
    }

    case "handoff":
      await logExecution(db, executionId, flowId, node.node_key, "info", "Transferido para humano");
      return { stop: true, handoff: true, variables: { handoff: true, handoff_reason: textValue(config.reason) } };

    case "notify_user":
      await logExecution(db, executionId, flowId, node.node_key, "info", "Notifica\u00e7\u00e3o interna registrada", {
        user_id: config.user_id,
        message: config.message,
      });
      return {};

    case "webhook": {
      const url = textValue(config.url);
      if (!url) throw new Error("URL do webhook n\u00e3o configurada.");
      const method = normalizeMethod(config.method);
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ context, flowId, nodeKey: node.node_key }) : undefined,
      });
      await logExecution(db, executionId, flowId, node.node_key, response.ok ? "info" : "warning", "Webhook externo chamado", {
        status: response.status,
      });
      return {};
    }

    case "ai_response": {
      const text = await callAiResponse(db, flowId, context, textValue(config.prompt));
      const sent = await evolution.sendText(context.remoteJid, text);
      await insertOutgoingMessage(db, context, {
        evolutionMessageId: sent.key.id,
        messageType: "text",
        content: text,
      });
      await logExecution(db, executionId, flowId, node.node_key, "info", "Resposta com IA enviada");
      return { responseSent: true };
    }

    case "end_flow":
      await logExecution(db, executionId, flowId, node.node_key, "info", "Fluxo encerrado");
      return { stop: true };

    default:
      await logExecution(db, executionId, flowId, node.node_key, "warning", "Tipo de bloco n\u00e3o suportado");
      return {};
  }
}

async function getActiveFlows(db: UntypedSupabase, context: SalesbotContext): Promise<FlowBundle[]> {
  let query = db
    .from("salesbot_flows")
    .select("*")
    .eq("status", "active")
    .in("channel", ["whatsapp", "multi"]);
  if (context.flowId) query = query.eq("id", context.flowId);

  const { data: flows, error } = await query;
  if (error || !flows?.length) return [];

  const flowIds = flows.map((flow: SalesbotFlow) => flow.id);
  const [triggersRes, nodesRes, edgesRes] = await Promise.all([
    db
      .from("salesbot_triggers")
      .select("*")
      .in("flow_id", flowIds)
      .eq("is_active", true)
      .in("type", [context.event, "new_message"]),
    db.from("salesbot_nodes").select("*").in("flow_id", flowIds),
    db.from("salesbot_edges").select("*").in("flow_id", flowIds),
  ]);

  if (triggersRes.error || nodesRes.error || edgesRes.error) return [];

  return (flows as SalesbotFlow[])
    .map((flow) => ({
      flow,
      triggers: (triggersRes.data ?? []).filter((trigger: SalesbotTrigger) => trigger.flow_id === flow.id),
      nodes: (nodesRes.data ?? []).filter((node: SalesbotNode) => node.flow_id === flow.id),
      edges: (edgesRes.data ?? []).filter((edge: SalesbotEdge) => edge.flow_id === flow.id),
    }))
    .filter((bundle) => bundle.triggers.length > 0);
}

async function wasAlreadyExecuted(
  db: UntypedSupabase,
  flowId: string,
  context: SalesbotContext
): Promise<boolean> {
  if (!context.evolutionMessageId) return false;
  const { data } = await db
    .from("salesbot_executions")
    .select("id")
    .eq("flow_id", flowId)
    .eq("conversation_id", context.conversationId)
    .contains("variables", { evolution_message_id: context.evolutionMessageId })
    .limit(1);
  return Boolean(data?.length);
}

export async function runSalesbotForMessage(context: SalesbotContext): Promise<SalesbotRunResult> {
  const supabase = createServiceClient();
  const db = salesbotDb(supabase);
  const flows = await getActiveFlows(db, context);
  const runResult: SalesbotRunResult = { executed: false, responseSent: false, handoff: false };

  for (const bundle of flows) {
    if (await wasAlreadyExecuted(db, bundle.flow.id, context)) continue;

    const validation = validateSalesbotGraph(bundle.nodes, bundle.edges, bundle.triggers);
    if (!validation.ok) {
      console.warn(`[salesbot] fluxo inv\u00e1lido ${bundle.flow.id}: ${validation.errors.join(" ")}`);
      continue;
    }

    const startNode =
      bundle.nodes.find((node) =>
        !bundle.edges.some((edge) => edge.target_node_key === node.node_key)
      ) ?? bundle.nodes[0];

    const { data: execution, error: executionError } = await db
      .from("salesbot_executions")
      .insert({
        flow_id: bundle.flow.id,
        trigger_id: bundle.triggers[0]?.id ?? null,
        conversation_id: context.conversationId,
        lead_id: context.leadId,
        contact_id: context.contactId,
        current_node_key: startNode.node_key,
        status: "running",
        variables: {
          event: context.event,
          evolution_message_id: context.evolutionMessageId,
          message_text: context.messageText,
        },
      })
      .select("id")
      .single();

    if (executionError || !execution) {
      console.warn("[salesbot] falha ao criar execu\u00e7\u00e3o:", executionError?.message);
      continue;
    }

    runResult.executed = true;
    let currentKey: string | null = startNode.node_key;
    let steps = 0;
    let variables: Record<string, Json | undefined> = {};
    let finalStatus: "completed" | "waiting" = "completed";

    try {
      while (currentKey && steps < MAX_STEPS) {
        steps++;
        const node = bundle.nodes.find((item) => item.node_key === currentKey);
        if (!node) throw new Error(`Bloco n\u00e3o encontrado: ${currentKey}`);

        await db
          .from("salesbot_executions")
          .update({ current_node_key: node.node_key, variables: { ...variables } })
          .eq("id", execution.id);

        const result = await executeNode(db, node, context, execution.id, bundle.flow.id);
        variables = { ...variables, ...(result.variables ?? {}) };
        runResult.responseSent = runResult.responseSent || Boolean(result.responseSent);
        runResult.handoff = runResult.handoff || Boolean(result.handoff);
        if (result.wait) finalStatus = "waiting";
        if (result.stop) break;
        currentKey = chooseNextNodeKey(node, bundle.edges, context, result);
      }

      if (steps >= MAX_STEPS) {
        throw new Error("Limite de etapas atingido; poss\u00edvel loop interrompido.");
      }

      await db
        .from("salesbot_executions")
        .update({
          status: finalStatus,
          finished_at: finalStatus === "completed" ? new Date().toISOString() : null,
          variables: {
            ...variables,
            event: context.event,
            evolution_message_id: context.evolutionMessageId,
            message_text: context.messageText,
          },
        })
        .eq("id", execution.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      await logExecution(db, execution.id, bundle.flow.id, currentKey, "error", message);
      await db
        .from("salesbot_executions")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: message,
        })
        .eq("id", execution.id);
    }
  }

  return runResult;
}
