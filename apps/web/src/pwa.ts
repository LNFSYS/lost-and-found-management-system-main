export interface PwaRegistrationStatus {
  supported: boolean;
  registered: boolean;
  reason?: "unsupported-browser" | "insecure-context" | "registration-failed";
}

function canUseServiceWorker() {
  if (!("serviceWorker" in navigator)) return { ok: false as const, reason: "unsupported-browser" as const };
  if (!window.isSecureContext) return { ok: false as const, reason: "insecure-context" as const };
  return { ok: true as const };
}

export async function registerPwa(): Promise<PwaRegistrationStatus> {
  const support = canUseServiceWorker();
  if (!support.ok) return { supported: false, registered: false, reason: support.reason };

  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return { supported: true, registered: true };
  } catch (error) {
    console.warn("[pwa] service worker registration failed", error);
    return { supported: true, registered: false, reason: "registration-failed" };
  }
}
