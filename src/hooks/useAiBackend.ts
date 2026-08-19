import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AiBackendStatus = "checking" | "available" | "unavailable";

/**
 * Probes the Venice AI edge function once on mount and reports whether the
 * AI backend is reachable. Tools use this to degrade gracefully: manual
 * features (editing, export, import) always work; AI buttons are disabled
 * with a clear explanation when the backend is down.
 */
export function useAiBackendStatus(): AiBackendStatus {
  const [status, setStatus] = useState<AiBackendStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const result = await Promise.race([
          supabase.functions.invoke("venice-ai", {
            body: { action: "health" },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 8000),
          ),
        ]);
        if (!cancelled) {
          setStatus(
            !result.error && (result.data as { ok?: boolean } | null)?.ok
              ? "available"
              : "unavailable",
          );
        }
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
