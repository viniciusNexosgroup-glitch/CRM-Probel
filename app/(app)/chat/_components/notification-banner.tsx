"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getNotificationPermission,
  requestNotificationPermission,
  wasPermissionBannerDismissed,
  dismissPermissionBanner,
} from "@/lib/notifications";

export function NotificationBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const perm = getNotificationPermission();
    if (perm === "default" && !wasPermissionBannerDismissed()) {
      setShow(true);
    }
  }, []);

  async function onAllow() {
    const result = await requestNotificationPermission();
    if (result !== "default") {
      dismissPermissionBanner();
      setShow(false);
    }
  }

  function onDismiss() {
    dismissPermissionBanner();
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="px-3 py-2 bg-primary/15 border-b border-primary/30 flex items-center gap-2 text-xs text-wa-textPrimary">
      <Bell className="h-4 w-4 text-primary shrink-0" />
      <span className="flex-1">
        Receba <strong>notificações</strong> + <strong>som</strong> de mensagens novas.
      </span>
      <Button size="sm" onClick={onAllow} className="h-7 text-xs px-2">
        Ativar
      </Button>
      <button
        onClick={onDismiss}
        className="p-1 text-wa-textSecondary hover:text-wa-textPrimary"
        aria-label="Dispensar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
