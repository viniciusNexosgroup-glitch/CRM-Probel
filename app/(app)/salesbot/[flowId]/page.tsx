import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { salesbotDb } from "@/lib/salesbot/db";
import type { SalesbotEdge, SalesbotFlow, SalesbotNode } from "@/lib/salesbot/types";
import { SalesbotEditor } from "../_components/salesbot-editor";

export const dynamic = "force-dynamic";

async function getFlowData(flowId: string) {
  const supabase = await createClient();
  const db = salesbotDb(supabase);

  const [flowRes, nodesRes, edgesRes, stagesRes, tagsRes, profilesRes, mediaRes] =
    await Promise.all([
      db.from("salesbot_flows").select("*").eq("id", flowId).single(),
      db.from("salesbot_nodes").select("*").eq("flow_id", flowId).order("created_at", { ascending: true }),
      db.from("salesbot_edges").select("*").eq("flow_id", flowId).order("created_at", { ascending: true }),
      supabase.from("pipeline_stages").select("id, name, color").order("position", { ascending: true }),
      supabase.from("tags").select("id, name, color").order("name", { ascending: true }),
      supabase.from("profiles").select("id, full_name, email").order("full_name", { ascending: true }),
      supabase.from("media_library").select("id, title, file_type").order("title", { ascending: true }),
    ]);

  if (flowRes.error?.code === "42P01") {
    return { migrationMissing: true as const };
  }
  if (flowRes.error || !flowRes.data) return null;

  return {
    migrationMissing: false as const,
    flow: flowRes.data as SalesbotFlow,
    nodes: (nodesRes.data ?? []) as SalesbotNode[],
    edges: (edgesRes.data ?? []) as SalesbotEdge[],
    stages: stagesRes.data ?? [],
    tags: tagsRes.data ?? [],
    profiles: profilesRes.data ?? [],
    medias: mediaRes.data ?? [],
  };
}

export default async function SalesbotFlowPage({
  params,
}: {
  params: Promise<{ flowId: string }>;
}) {
  const { flowId } = await params;
  const data = await getFlowData(flowId);
  if (!data) notFound();

  if (data.migrationMissing) {
    return (
      <div className="h-full bg-wa-bg flex flex-col overflow-hidden">
        <header className="h-14 bg-wa-header flex items-center gap-3 px-4 border-b border-wa-border shrink-0">
          <Link href="/salesbot" className="text-wa-textSecondary hover:text-wa-textPrimary">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-medium text-wa-textPrimary">SalesBot</h1>
        </header>
        <div className="p-6 text-sm text-wa-textSecondary">
          Rode <span className="font-mono">npm.cmd run migrate</span> para criar as tabelas do SalesBot.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-wa-bg flex flex-col overflow-hidden">
      <header className="h-14 bg-wa-header flex items-center justify-between px-4 border-b border-wa-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/salesbot" className="text-wa-textSecondary hover:text-wa-textPrimary">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-medium text-wa-textPrimary flex items-center gap-2 min-w-0">
            <Bot className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{data.flow.name}</span>
          </h1>
        </div>
        <span className="text-xs text-wa-textSecondary">Editor visual</span>
      </header>

      <SalesbotEditor
        flow={data.flow}
        initialNodes={data.nodes}
        initialEdges={data.edges}
        stages={data.stages}
        tags={data.tags}
        profiles={data.profiles}
        medias={data.medias}
      />
    </div>
  );
}
