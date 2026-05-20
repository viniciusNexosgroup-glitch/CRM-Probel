/**
 * Helpers de notificação desktop + som.
 * Tudo client-side. Usa Notification API + Web Audio.
 */

export type PermissionState = "default" | "granted" | "denied";

export function getNotificationPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  return Notification.permission as PermissionState;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission !== "default") return Notification.permission as PermissionState;
  const result = await Notification.requestPermission();
  return result as PermissionState;
}

export function showNotification(
  title: string,
  options: {
    body?: string;
    icon?: string;
    tag?: string;
    onClick?: () => void;
  } = {}
): Notification | null {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;

  try {
    const n = new Notification(title, {
      body: options.body,
      icon: options.icon,
      tag: options.tag ?? "crm-probel",
      badge: options.icon,
    });
    if (options.onClick) {
      n.onclick = () => {
        window.focus();
        options.onClick?.();
        n.close();
      };
    }
    // Auto-close depois de 6s
    setTimeout(() => n.close(), 6000);
    return n;
  } catch (e) {
    console.warn("[notification] falhou:", e);
    return null;
  }
}

let audioContext: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioContext) return audioContext;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContext = new Ctx();
    return audioContext;
  } catch {
    return null;
  }
}

/**
 * Beep curto de notificação. Som suave estilo WhatsApp Web.
 */
export function playNotificationSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;

  try {
    // Beep duplo: duas frequencias proximas
    const now = ctx.currentTime;
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.12, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
      osc.start(now + start);
      osc.stop(now + start + duration);
    };
    playTone(880, 0, 0.08); // primeira nota
    playTone(1100, 0.09, 0.15); // segunda
  } catch (e) {
    console.warn("[beep] falhou:", e);
  }
}

const DISMISSED_KEY = "crm-probel:notif-dismissed";

export function wasPermissionBannerDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(DISMISSED_KEY) === "1";
}

export function dismissPermissionBanner() {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISSED_KEY, "1");
}
