/**
 * WayBite Real AgentCore SSE Streaming Client
 * Connects directly to Bedrock Claude AgentCore backend via /api/agent/invocations
 */

import type { Restaurant } from "../types";

export interface AgentCallbacks {
  onToolStart?: (toolName: string) => void;
  onCorridor?: (payload: any) => void;
  onRecommendations?: (payload: any) => void;
  onTextChunk?: (chunk: string) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
}

export function mapToRestaurant(c: any): Restaurant {
  const pid = c.id || c.place_id || `place-${Math.random()}`;
  return {
    id: pid,
    placeId: c.place_id || pid,
    name: c.name || "식당",
    category: c.category || "음식점",
    address: c.address || "",
    phone: c.phone || "",
    lat: typeof c.lat === "number" ? c.lat : parseFloat(c.lat) || 37.5,
    lng: typeof c.lng === "number" ? c.lng : parseFloat(c.lng) || 127.0,
    rating: typeof c.rating === "number" ? c.rating : 4.5,
    reviewCount: typeof c.review_count === "number" ? c.review_count : 150,
    detourMinutes: typeof c.detour_minutes === "number" ? c.detour_minutes : 0,
    travelTimeMinutes: typeof c.travel_time_minutes === "number" ? c.travel_time_minutes : 15,
    etaTime: c.eta_time || "12:30",
    safetyStatus:
      c.safety_status === "REJECTED"
        ? "REJECTED"
        : c.safety_status === "TIGHT"
        ? "TIGHT"
        : "SAFE",
    safetyBadge:
      c.safety_badge ||
      c.badge_message ||
      (c.safety_status === "REJECTED"
        ? "🔴 브레이크타임 충돌"
        : "🟢 안심 입장"),
    failReason: c.fail_reason,
    guaranteedDiningMinutes:
      typeof c.guaranteed_dining_minutes === "number"
        ? c.guaranteed_dining_minutes
        : 45,
    cookingSpeedScore:
      typeof c.cooking_speed_score === "number" ? c.cooking_speed_score : 80,
    soloDiningScore:
      typeof c.solo_dining_score === "number" ? c.solo_dining_score : 75,
    parkingScore: typeof c.parking_score === "number" ? c.parking_score : 60,
    sentimentScore:
      typeof c.sentiment_score === "number"
        ? c.sentiment_score
        : typeof c.sentimentScore === "number"
        ? c.sentimentScore
        : 85,
    reviewSnippet:
      c.review_snippet ||
      c.ai_briefing_reason ||
      "방문자 만족도가 우수한 식당입니다.",
    sourceUrl:
      c.source_url ||
      (c.place_id
        ? `https://place.map.kakao.com/${c.place_id.replace("kakao-", "")}`
        : "#"),
    finalScore:
      typeof c.final_score === "number"
        ? c.final_score
        : c.safety_status === "REJECTED"
        ? 0
        : 50,
  };
}

export interface AgentStreamOptions {
  sessionId?: string;
  userId?: string;
}

export async function invokeAgentStream(
  prompt: string,
  callbacks: AgentCallbacks,
  options?: AgentStreamOptions,
  signal?: AbortSignal
): Promise<void> {
  try {
    const response = await fetch("/api/agent/invocations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        session_id: options?.sessionId,
        user_id: options?.userId,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`AgentCore HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response stream not available");
    }

    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const dataStr = trimmed.slice(5).trim();
        try {
          const data = JSON.parse(dataStr);
          if (typeof data === "string") {
            callbacks.onTextChunk?.(data);
          } else if (typeof data === "object" && data !== null) {
            if (data.error || data.errorMessage) {
              callbacks.onError?.(data.errorMessage || data.message || data.error);
            } else if (data.type === "tool_start") {
              callbacks.onToolStart?.(data.tool);
            } else if (data.type === "corridor") {
              callbacks.onCorridor?.(data.payload);
            } else if (data.type === "recommendations") {
              callbacks.onRecommendations?.(data.payload);
            } else if (data.type === "text") {
              callbacks.onTextChunk?.(data.content);
            } else if (data.type === "done") {
              callbacks.onDone?.();
            }
          }

        } catch {
          // If plain text fallback
          callbacks.onTextChunk?.(dataStr);
        }
      }
    }

    callbacks.onDone?.();
  } catch (err: any) {
    if (err.name === "AbortError") return;
    console.error("AgentCore streaming error:", err);
    callbacks.onError?.(err.message || "에이전트 통신 오류가 발생했습니다.");
  }
}
