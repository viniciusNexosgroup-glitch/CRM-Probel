import Link from "next/link";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>
          Acesse seu CRM com email e senha.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
        <div className="text-sm text-muted-foreground text-center space-y-2">
          <p>
            <Link
              href="/forgot-password"
              className="text-primary hover:underline"
            >
              Esqueci minha senha
            </Link>
          </p>
          <p>
            Não tem conta?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
