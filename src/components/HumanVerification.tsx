import { useEffect, useId, useRef, useState } from "react";
import { contact } from "../content";
import { turnstileSiteKey } from "../lib/api";

type TurnstileOptions = {
  sitekey: string;
  action: string;
  appearance: "always";
  language: "auto";
  size: "compact" | "flexible";
  theme: "light";
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
  "unsupported-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-noel-turnstile]");
    const script = existing || document.createElement("script");

    const handleLoad = () => {
      if (window.turnstile) resolve();
      else reject(new Error("Human verification did not initialise."));
    };
    const handleError = () => reject(new Error("Human verification could not load."));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existing) {
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.noelTurnstile = "true";
      document.head.appendChild(script);
    }
  });

  return turnstileScriptPromise;
}

export default function HumanVerification({
  action,
  onToken,
  resetKey,
}: {
  action: "contact" | "volunteer" | "csr" | "feedback" | "donate";
  onToken: (token: string) => void;
  resetKey: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const statusId = useId();
  const siteKey = turnstileSiteKey;
  const [widgetSize, setWidgetSize] = useState<"compact" | "flexible">("compact");
  const [status, setStatus] = useState<"loading" | "ready" | "verified" | "error">("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const updateSize = (width: number) => {
      setWidgetSize(width >= 300 ? "flexible" : "compact");
    };
    updateSize(container.getBoundingClientRect().width);

    const observer = new ResizeObserver(([entry]) => updateSize(entry.contentRect.width));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!siteKey) return;

    let active = true;
    let widgetId: string | null = null;
    onToken("");
    setStatus("loading");

    void loadTurnstile()
      .then(() => {
        if (!active || !containerRef.current || !window.turnstile) return;
        containerRef.current.replaceChildren();
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          appearance: "always",
          language: "auto",
          size: widgetSize,
          theme: "light",
          callback: (token) => {
            if (!active) return;
            onToken(token);
            setStatus("verified");
          },
          "error-callback": () => {
            if (!active) return;
            onToken("");
            setStatus("error");
          },
          "expired-callback": () => {
            if (!active) return;
            onToken("");
            setStatus("ready");
          },
          "timeout-callback": () => {
            if (!active) return;
            onToken("");
            setStatus("ready");
          },
          "unsupported-callback": () => {
            if (!active) return;
            onToken("");
            setStatus("error");
          },
        });
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });

    return () => {
      active = false;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [action, onToken, resetKey, siteKey, widgetSize]);

  if (!siteKey) return null;

  return (
    <div className="human-verification" aria-describedby={statusId}>
      <div ref={containerRef} className="human-verification__widget" />
      <p
        id={statusId}
        className={status === "error" ? "field__error" : "field__hint"}
        aria-live="polite"
      >
        {status === "loading" ? (
          "Loading secure human verification…"
        ) : status === "verified" ? (
          "Human verification complete."
        ) : status === "error" ? (
          <>
            Human verification is unavailable. Refresh the page or{" "}
            <a href={`mailto:${contact.email}`}>continue by email</a>.
          </>
        ) : (
          "Complete the verification before sending."
        )}
      </p>
    </div>
  );
}
