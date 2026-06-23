import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useStreamingChat() {
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(
    async (
      conversationId: string,
      message: string,
      history: ChatMessage[]
    ): Promise<string> => {
      setIsStreaming(true);
      setStreamingText("");

      let accumulated = "";

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        };
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
          method: "POST",
          headers,
          body: JSON.stringify({ conversationId, message, history }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? `HTTP ${response.status}`);
        }

        const contentType = response.headers.get("content-type") ?? "";

        // SSE streaming path
        if (contentType.includes("text/event-stream") && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          outer: while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") break outer;

              try {
                const parsed = JSON.parse(payload) as { reply?: string; error?: string };
                if (parsed.error) throw new Error(parsed.error);
                if (parsed.reply) {
                  accumulated += parsed.reply;
                  setStreamingText(accumulated);
                }
              } catch {
                // skip malformed chunks
              }
            }
          }
        } else {
          // Fallback: non-streaming JSON response
          const data = await response.json() as { reply?: string; error?: string };
          if (data.error) throw new Error(data.error);
          accumulated = data.reply ?? "";
          setStreamingText(accumulated);
        }

        return accumulated;
      } finally {
        setIsStreaming(false);
        setStreamingText("");
      }
    },
    []
  );

  return { sendMessage, streamingText, isStreaming };
}