import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BusinessHoursForm } from "./_components/form";
import {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_AUTO_REPLY,
  type BusinessHoursConfig,
  type AutoReplyConfig,
} from "@/lib/business-hours";

export const dynamic = "force-dynamic";

export default async function BusinessHoursPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["business_hours", "auto_reply_outside_hours"]);

  const map = new Map(data?.map((r) => [r.key, r.value]) ?? []);
  const hours: BusinessHoursConfig = {
    ...DEFAULT_BUSINESS_HOURS,
    ...((map.get("business_hours") as Partial<BusinessHoursConfig>) ?? {}),
  };
  const reply: AutoReplyConfig = {
    ...DEFAULT_AUTO_REPLY,
    ...((map.get("auto_reply_outside_hours") as Partial<AutoReplyConfig>) ?? {}),
  };

  return (
    <div className="h-full bg-wa-bg flex flex-col overflow-hidden">
      <header className="h-14 bg-wa-header flex items-center px-4 border-b border-wa-border shrink-0">
        <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Horário Comercial
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto wa-scroll">
        <div className="container max-w-2xl py-6">
          <p className="text-sm text-muted-foreground mb-6">
            Defina seu horário de atendimento. Fora dele, novas mensagens recebem uma
            resposta automática (configurável abaixo).
          </p>
          <BusinessHoursForm initialHours={hours} initialReply={reply} />
        </div>
      </div>
    </div>
  );
}
