"use client";

import { useEffect, useState } from "react";
import { Bell, Volume2, MonitorSmartphone, Clock, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getNotificationPrefs,
  setNotificationPrefs,
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPermission,
  requestNotificationPermission,
  playNotificationSound,
  showNotification,
  type NotificationPrefs,
} from "@/lib/notifications";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked ? "bg-primary" : "bg-wa-border"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

export default function NotificationsSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [permission, setPermission] = useState<"default" | "granted" | "denied">("default");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPrefs(getNotificationPrefs());
    setPermission(getNotificationPermission());
    setLoaded(true);
  }, []);

  function update(patch: Partial<NotificationPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setNotificationPrefs(next);
  }

  async function onToggleDesktop(v: boolean) {
    if (v && getNotificationPermission() !== "granted") {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result !== "granted") {
        toast.error("Permissão de notificação negada pelo navegador");
        return;
      }
    }
    update({ desktop: v });
  }

  if (!loaded) return null;

  return (
    <div className="h-full bg-wa-bg flex flex-col overflow-hidden">
      <header className="h-14 bg-wa-header flex items-center px-4 border-b border-wa-border shrink-0">
        <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          Notificações
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto wa-scroll">
        <div className="container max-w-xl py-6 space-y-3">
          <p className="text-sm text-muted-foreground mb-2">
            Preferências salvas neste navegador. Cada atendente ajusta as suas.
          </p>

          {/* Som */}
          <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Volume2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Som de notificação</p>
                <p className="text-xs text-muted-foreground">Beep quando chega mensagem nova.</p>
              </div>
            </div>
            <Toggle checked={prefs.sound} onChange={(v) => update({ sound: v })} />
          </div>

          {/* Desktop */}
          <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <MonitorSmartphone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Notificação desktop</p>
                <p className="text-xs text-muted-foreground">
                  Pop-up do sistema mesmo com a aba em segundo plano.
                  {permission === "denied" && (
                    <span className="text-red-400">
                      {" "}
                      Bloqueado no navegador — libere nas permissões do site.
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Toggle checked={prefs.desktop && permission === "granted"} onChange={onToggleDesktop} />
          </div>

          {/* Antecedência do lembrete */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Antecedência do lembrete de tarefa</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Quantos minutos antes do horário avisar sobre uma tarefa.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[5, 10, 15, 30, 60].map((m) => (
                    <button
                      key={m}
                      onClick={() => update({ taskReminderMinutes: m })}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        prefs.taskReminderMinutes === m
                          ? "bg-primary/15 text-primary border-primary/40"
                          : "border-border text-muted-foreground hover:bg-wa-hover"
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={() => {
              playNotificationSound();
              showNotification("Teste de notificação", { body: "É assim que vai aparecer 🎉" });
            }}
          >
            <Check className="h-4 w-4" /> Testar som + notificação
          </Button>
        </div>
      </div>
    </div>
  );
}
