import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  // Mensagem de boas-vindas customizada (#27) — visível pra quem chega pelo convite
  let welcome = "";
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "invite_welcome")
      .maybeSingle();
    welcome = (data?.value as unknown as { text?: string } | null)?.text ?? "";
  } catch {
    /* sem sessão / sem acesso → não mostra */
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Nova senha</CardTitle>
        <CardDescription>Defina uma nova senha para sua conta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {welcome && (
          <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-foreground whitespace-pre-wrap">
            {welcome}
          </div>
        )}
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
