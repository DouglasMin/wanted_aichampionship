import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SetupScreen } from "./components/SetupScreen";
import { Header } from "./components/Header";
import { ChatPanel } from "./components/ChatPanel";
import { ParetoDeck } from "./components/ParetoDeck";
import { TemporalInspector } from "./components/TemporalInspector";
import { DiningCard } from "./components/DiningCard";
import { TacticalMapPod } from "./components/TacticalMapPod";
import {
  fetchRouteDirections,
  searchCorridorRestaurants,
  minDistToRoute,
} from "./lib/restaurantService";
import { invokeAgentStream, mapToRestaurant } from "./lib/agentClient";
import type { AppScreen, RouteConfig, ChatMessage, Restaurant } from "./types";
import { Loader2 } from "lucide-react";

/* ── Helper: generate unique IDs ────────────────────── */
let _msgId = 0;
const nextId = () => `msg-${++_msgId}`;
const now = () =>
  new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

export function App() {
  /* ── Screen State ──────────────────────────────────── */
  const [screen, setScreen] = useState<AppScreen>("setup");
  const [routeConfig, setRouteConfig] = useState<RouteConfig | null>(null);

  /* ── Live Data State ───────────────────────────────── */
  const [rawRestaurants, setRawRestaurants] = useState<Restaurant[]>([]);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeSummary, setRouteSummary] = useState<{
    duration: number;
    distance: number;
  } | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isAgentEvaluating, setIsAgentEvaluating] = useState(false);
  const [agentStatusText, setAgentStatusText] = useState("");
  const [sessionId, setSessionId] = useState<string>(
    () => `wb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  );

  /* ── Chat State ────────────────────────────────────── */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  /* ── Result State ──────────────────────────────────── */
  const [alpha, setAlpha] = useState(0.5);
  const [showPruned, setShowPruned] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* ── Quick Sort & Conversational Modification ────────── */
  const handleQuickSort = (type: "detour" | "solo" | "sentiment") => {
    if (type === "detour") {
      setAlpha(0.9);
      setRawRestaurants((prev) =>
        [...prev].sort(
          (a, b) => a.detourMinutes - b.detourMinutes || b.cookingSpeedScore - a.cookingSpeedScore
        )
      );
    } else if (type === "solo") {
      setRawRestaurants((prev) =>
        [...prev].sort((a, b) => b.soloDiningScore - a.soloDiningScore)
      );
    } else if (type === "sentiment") {
      setAlpha(0.15);
      setRawRestaurants((prev) =>
        [...prev].sort(
          (a, b) => b.sentimentScore - a.sentimentScore || b.rating - a.rating
        )
      );
    }
  };

  const handleConversationalListUpdate = (query: string) => {
    const q = query.toLowerCase().trim();

    // 1. Prune by rank/number (e.g. "1번 빼줘", "2번 식당 제외해", "3번 탈락")
    const numMatch = q.match(/(\d+)\s*번/);
    if (
      numMatch &&
      (q.includes("빼") ||
        q.includes("제외") ||
        q.includes("삭제") ||
        q.includes("탈락"))
    ) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx >= 0 && idx < visibleRestaurants.length) {
        const targetId = visibleRestaurants[idx].id;
        setRawRestaurants((prev) => prev.filter((r) => r.id !== targetId));
        return;
      }
    }

    // 2. Prune rejected/breaktime restaurants (e.g. "브레이크타임 걸린거 빼줘", "탈락된거 없애줘")
    if (
      (q.includes("브레이크") ||
        q.includes("탈락") ||
        q.includes("마감") ||
        q.includes("rejected")) &&
      (q.includes("빼") ||
        q.includes("제외") ||
        q.includes("삭제") ||
        q.includes("숨겨") ||
        q.includes("안볼래"))
    ) {
      setShowPruned(false);
      setRawRestaurants((prev) =>
        prev.filter((r) => r.safetyStatus !== "REJECTED")
      );
      return;
    }

    // 3. Prune or select specific restaurant by name
    for (const r of rawRestaurants) {
      if (q.includes(r.name.toLowerCase())) {
        if (q.includes("빼") || q.includes("제외") || q.includes("삭제")) {
          setRawRestaurants((prev) => prev.filter((item) => item.id !== r.id));
          return;
        } else {
          setSelectedId(r.id);
        }
      }
    }

    // 4. Quick Detour / Speed intent ("제일 빠른 곳", "우회 적은 곳", "빨리 갈 수 있는 곳")
    if (
      q.includes("빠른") ||
      q.includes("빨리") ||
      q.includes("최단") ||
      q.includes("우회")
    ) {
      setAlpha(0.9);
      setRawRestaurants((prev) =>
        [...prev].sort(
          (a, b) =>
            a.detourMinutes - b.detourMinutes ||
            b.cookingSpeedScore - a.cookingSpeedScore
        )
      );
      return;
    }

    // 5. Solo dining intent ("혼밥", "혼자")
    if (q.includes("혼밥") || q.includes("혼자")) {
      setRawRestaurants((prev) =>
        [...prev].sort((a, b) => b.soloDiningScore - a.soloDiningScore)
      );
      return;
    }

    // 6. Food Quality / Review intent ("평점", "리뷰", "맛있는", "인기")
    if (
      q.includes("평점") ||
      q.includes("리뷰") ||
      q.includes("맛있는") ||
      q.includes("인기") ||
      q.includes("퀄리티")
    ) {
      setAlpha(0.15);
      setRawRestaurants((prev) =>
        [...prev].sort(
          (a, b) =>
            b.sentimentScore - a.sentimentScore || b.rating - a.rating
        )
      );
      return;
    }

    // 7. Late Night intent ("늦게", "야간", "심야", "새벽", "늦은")
    if (
      q.includes("늦게") ||
      q.includes("야간") ||
      q.includes("심야") ||
      q.includes("새벽") ||
      q.includes("늦은")
    ) {
      setRawRestaurants((prev) =>
        [...prev].sort((a, b) => {
          if (a.safetyStatus === "SAFE" && b.safetyStatus !== "SAFE") return -1;
          if (a.safetyStatus !== "SAFE" && b.safetyStatus === "SAFE") return 1;
          return b.guaranteedDiningMinutes - a.guaranteedDiningMinutes;
        })
      );
      return;
    }

    // 8. New Food Category Search ("흑돼지", "국밥", "카페", "돈까스", "일식", "양식", "중식")
    if (routeConfig) {
      const foodWords = [
        "흑돼지",
        "고기",
        "삼겹살",
        "국밥",
        "순대국",
        "돈까스",
        "국수",
        "칼국수",
        "찌개",
        "초밥",
        "스시",
        "회",
        "냉면",
        "카페",
        "라멘",
        "피자",
        "버거",
        "치킨",
        "백반",
        "중식",
        "짜장",
      ];
      const matched = foodWords.find((w) => q.includes(w));
      if (matched) {
        searchCorridorRestaurants(
          routeConfig.origin,
          routeConfig.destination,
          matched,
          routeConfig.mode,
          routeConfig.departureTime,
          routeCoordinates
        ).then((places) => {
          if (places.length > 0) {
            setRawRestaurants(places);
            const safe = places.filter((p) => p.safetyStatus !== "REJECTED");
            if (safe.length > 0) setSelectedId(safe[0].id);
            else setSelectedId(places[0].id);
          }
        });
      }
    }

    // 9. Conversational Departure Time change (e.g. "출발 시간 19:30으로 바꿔줘", "7시 출발로 변경")
    if (routeConfig && (q.includes("출발") || q.includes("시간") || q.includes("시각"))) {
      let newDepTime = "";
      const matchHHMM = q.match(/(\d{1,2}):(\d{2})/);
      if (matchHHMM) {
        newDepTime = `${matchHHMM[1].padStart(2, "0")}:${matchHHMM[2]} 출발`;
      } else {
        const matchH = q.match(/(\d{1,2})\s*시/);
        const matchM = q.match(/(\d{1,2})\s*분/);
        if (matchH) {
          let h = parseInt(matchH[1], 10);
          const m = matchM ? parseInt(matchM[1], 10) : 0;
          if ((q.includes("오후") || q.includes("저녁")) && h < 12) h += 12;
          newDepTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} 출발`;
        }
      }
      if (newDepTime) {
        setRouteConfig((prev) => (prev ? { ...prev, departureTime: newDepTime } : prev));
        searchCorridorRestaurants(
          routeConfig.origin,
          routeConfig.destination,
          routeConfig.naturalQuery,
          routeConfig.mode,
          newDepTime,
          routeCoordinates
        ).then((places) => {
          if (places.length > 0) {
            setRawRestaurants(places);
            const safe = places.filter((p) => p.safetyStatus !== "REJECTED");
            if (safe.length > 0) setSelectedId(safe[0].id);
            else setSelectedId(places[0].id);
          }
        });
      }
    }
  };

  /* ── Pareto Calculation ────────────────────────────── */
  const processedRestaurants = useMemo(() => {
    if (rawRestaurants.length === 0) return [];

    return rawRestaurants
      .map((r) => {
        if (r.safetyStatus === "REJECTED") return { ...r, finalScore: 0 };
        const normDetour = Math.max(0, 1 - r.detourMinutes / 15);
        const normQuality = (r.rating / 5) * 0.6 + (r.sentimentScore / 100) * 0.4;
        const normSpeed = r.cookingSpeedScore / 100;
        const score =
          alpha * normDetour * 50 + (1 - alpha) * normQuality * 40 + normSpeed * 10;
        return { ...r, finalScore: parseFloat(score.toFixed(1)) };
      })
      .sort((a, b) => {
        if (a.safetyStatus === "REJECTED" && b.safetyStatus !== "REJECTED") return 1;
        if (a.safetyStatus !== "REJECTED" && b.safetyStatus === "REJECTED") return -1;
        return b.finalScore - a.finalScore;
      });
  }, [rawRestaurants, alpha]);

  const visibleRestaurants = useMemo(() => {
    if (showPruned) return processedRestaurants;
    return processedRestaurants.filter((r) => r.safetyStatus !== "REJECTED");
  }, [processedRestaurants, showPruned]);

  const safeCount = processedRestaurants.filter(
    (r) => r.safetyStatus !== "REJECTED"
  ).length;
  const prunedCount = processedRestaurants.filter(
    (r) => r.safetyStatus === "REJECTED"
  ).length;

  /* ── Real AgentCore Streaming Integration ─────────────────── */
  const handleStartSearch = async (config: RouteConfig) => {
    const newSessionId = `wb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setSessionId(newSessionId);
    setRouteConfig(config);
    setIsInitialLoading(true);
    setIsAgentEvaluating(true);
    setAgentStatusText("카카오 실시간 경로 및 회랑 식당 탐색 중...");
    setRawRestaurants([]);

    const userText =
      config.naturalQuery ||
      `${config.origin.name} → ${config.destination.name} 맛집 추천`;
    const userMsg: ChatMessage = {
      id: nextId(),
      sender: "user",
      text: userText,
      timestamp: now(),
    };

    const agentMsgId = nextId();
    const initialAgentMsg: ChatMessage = {
      id: agentMsgId,
      sender: "agent",
      text: "⏳ WayBite 에이전트가 실시간 경로 및 맛집 분석을 시작합니다...",
      timestamp: now(),
    };

    setMessages([userMsg, initialAgentMsg]);
    setScreen("result");
    setIsTyping(true);

    // 1. Fetch route first, then search restaurants along that route
    let fetchedRouteCoords: [number, number][] = [];
    try {
      const dirs = await fetchRouteDirections(config.origin, config.destination);
      fetchedRouteCoords = dirs.routeCoordinates;
      setRouteCoordinates(fetchedRouteCoords);
      setRouteSummary({
        duration: dirs.durationMinutes,
        distance: dirs.distanceKm,
      });
    } catch (e) {
      console.warn("Quick directions error:", e);
    }

    // 2. Instant corridor restaurants using real route coordinates for precise filtering
    searchCorridorRestaurants(
      config.origin,
      config.destination,
      config.naturalQuery,
      config.mode,
      config.departureTime,
      fetchedRouteCoords
    )
      .then((places) => {
        // Immediately show the cards in center screen!
        setRawRestaurants(places);
        setIsInitialLoading(false); // Closes initial loader right away!
        const safe = places.filter((p) => p.safetyStatus !== "REJECTED");
        if (safe.length > 0) {
          setSelectedId((prev) => prev || safe[0].id);
        } else if (places.length > 0) {
          setSelectedId((prev) => prev || places[0].id);
        }
      })
      .catch((e) => {
        console.warn("Quick places error:", e);
        setIsInitialLoading(false);
      });

    // 3. Real AgentCore Bedrock Sonnet 4.5 Orchestration with all 4 tools
    const prompt = `출발지: ${config.origin.name} (${config.origin.lat}, ${config.origin.lng}), 도착지: ${config.destination.name} (${config.destination.lat}, ${config.destination.lng}), 이동수단: ${config.mode}, 출발시각: ${config.departureTime}, 조건: ${userText}. plan_corridor, verify_temporal_safety, query_pinecone_reviews, rank_pareto_dining을 모두 순서대로 실행해서 최종 시공간 파레토 최적화 맛집을 브리핑해줘.`;

    const toolLabels: Record<string, string> = {
      plan_corridor: "카카오 모빌리티 실시간 경로 및 회랑 식당 탐색 중...",
      verify_temporal_safety: "시공간 안전 가드레일 (브레이크타임/라스트오더) 검증 중...",
      query_pinecone_reviews: "Pinecone Serverless 리뷰 시맨틱 마이닝 (Titan 1536) 중...",
      rank_pareto_dining: "다변수 파레토 최적화 랭킹 계산 중...",
    };

    await invokeAgentStream(
      prompt,
      {
        onToolStart: (toolName) => {
          const label = toolLabels[toolName] || toolName;
          setAgentStatusText(label);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMsgId && (!msg.text || msg.text.startsWith("⏳"))
                ? { ...msg, text: `⏳ ${label}` }
                : msg
            )
          );
        },
        onCorridor: (payload) => {
          // Frontend already has the user's exact route from Kakao Mobility Directions.
          // Only update routeCoordinates if not already populated.
          if (payload.route_coordinates && payload.route_coordinates.length > 0) {
            setRouteCoordinates((prev) => (prev && prev.length >= 2 ? prev : payload.route_coordinates));
          }
          if (payload.base_duration_min) {
            setRouteSummary({
              duration: payload.base_duration_min,
              distance: Math.round((payload.base_distance_m || 15000) / 100) / 10,
            });
          }
        },
        onRecommendations: (payload) => {
          const candidates = payload.all_candidates || payload.top_recommendations || [];
          if (candidates.length > 0) {
            let mapped = candidates.map(mapToRestaurant);
            // Proximity filter: keep only restaurants within 4km of the real route
            if (fetchedRouteCoords && fetchedRouteCoords.length >= 2) {
              const inCorridor = mapped.filter((r: Restaurant) => minDistToRoute(r.lat, r.lng, fetchedRouteCoords) <= 4000);
              if (inCorridor.length > 0) mapped = inCorridor;
            }
            // Smoothly update the center list with AI-verified metrics!
            setRawRestaurants(mapped);
            const firstSafe = mapped.find((r: Restaurant) => r.safetyStatus !== "REJECTED");
            if (firstSafe) {
              setSelectedId(firstSafe.id);
            } else {
              setSelectedId(mapped[0].id);
            }
          }
          setIsInitialLoading(false);
          setIsAgentEvaluating(false);
        },
        onTextChunk: (chunk) => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== agentMsgId) return msg;
              const current = msg.text.startsWith("⏳") ? "" : msg.text;
              return { ...msg, text: current + chunk };
            })
          );

          // Highlight restaurant if mentioned in agent text
          for (const r of rawRestaurants) {
            if (chunk.includes(r.name)) {
              setSelectedId(r.id);
              break;
            }
          }
        },
        onError: (err) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMsgId
                ? {
                    ...msg,
                    text:
                      (msg.text.startsWith("⏳") ? "" : msg.text) +
                      `\n\n⚠️ 에이전트 응답 오류: ${err}`,
                  }
                : msg
            )
          );
          setIsInitialLoading(false);
          setIsAgentEvaluating(false);
          setIsTyping(false);
        },
        onDone: () => {
          setIsTyping(false);
          setIsInitialLoading(false);
          setIsAgentEvaluating(false);
        },
      },
      { sessionId: newSessionId }
    );
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isTyping) return;
    const query = chatInput.trim();
    setChatInput("");

    // 1. Immediately react to conversational intents on the center list!
    handleConversationalListUpdate(query);

    const userMsg: ChatMessage = {
      id: nextId(),
      sender: "user",
      text: query,
      timestamp: now(),
    };

    const agentMsgId = nextId();
    const agentMsg: ChatMessage = {
      id: agentMsgId,
      sender: "agent",
      text: "⏳ 질문을 분석하고 적절한 도구를 실행 중입니다...",
      timestamp: now(),
    };

    setMessages((prev) => [...prev, userMsg, agentMsg]);
    setIsTyping(true);
    setIsAgentEvaluating(true);
    setAgentStatusText("사용자 요청 분석 및 식당 목록 갱신 중...");

    const contextPrompt = routeConfig
      ? `[현재 경로 정보: ${routeConfig.origin.name} (${routeConfig.origin.lat}, ${routeConfig.origin.lng}) → ${routeConfig.destination.name} (${routeConfig.destination.lat}, ${routeConfig.destination.lng}), 이동수단: ${routeConfig.mode}, 출발시각: ${routeConfig.departureTime}]\n현재 추천 식당들: ${rawRestaurants.slice(0, 5).map((r) => r.name).join(", ")}\n사용자 요청: ${query}\n필요한 도구를 실행하여 최적의 추천과 답변을 한국어로 제공하고 리스트를 갱신해줘.`
      : query;

    const toolLabels: Record<string, string> = {
      plan_corridor: "카카오 모빌리티 실시간 경로 및 회랑 식당 탐색 중...",
      verify_temporal_safety: "시공간 안전 가드레일 (브레이크타임/라스트오더) 검증 중...",
      query_pinecone_reviews: "Pinecone Serverless 리뷰 시맨틱 마이닝 (Titan 1536) 중...",
      rank_pareto_dining: "다변수 파레토 최적화 랭킹 계산 중...",
    };

    await invokeAgentStream(
      contextPrompt,
      {
        onToolStart: (toolName) => {
          const label = toolLabels[toolName] || toolName;
          setAgentStatusText(label);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMsgId && (!msg.text || msg.text.startsWith("⏳"))
                ? { ...msg, text: `⏳ ${label}` }
                : msg
            )
          );
        },
        onCorridor: (payload) => {
          if (payload.route_coordinates && payload.route_coordinates.length > 0) {
            setRouteCoordinates((prev) => (prev && prev.length >= 2 ? prev : payload.route_coordinates));
          }
          if (payload.base_duration_min) {
            setRouteSummary({
              duration: payload.base_duration_min,
              distance: Math.round((payload.base_distance_m || 15000) / 100) / 10,
            });
          }
        },
        onRecommendations: (payload) => {
          const candidates = payload.all_candidates || payload.top_recommendations || [];
          if (candidates.length > 0) {
            let mapped = candidates.map(mapToRestaurant);
            if (routeCoordinates && routeCoordinates.length >= 2) {
              const inCorridor = mapped.filter((r: Restaurant) => minDistToRoute(r.lat, r.lng, routeCoordinates) <= 4000);
              if (inCorridor.length > 0) mapped = inCorridor;
            }
            setRawRestaurants(mapped);
            const firstSafe = mapped.find((r: Restaurant) => r.safetyStatus !== "REJECTED");
            if (firstSafe) {
              setSelectedId(firstSafe.id);
            } else {
              setSelectedId(mapped[0].id);
            }
          }
          setIsAgentEvaluating(false);
        },
        onTextChunk: (chunk) => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== agentMsgId) return msg;
              const current = msg.text.startsWith("⏳") ? "" : msg.text;
              return { ...msg, text: current + chunk };
            })
          );

          // Synchronize selection: if agent talks about a restaurant, highlight it!
          for (const r of rawRestaurants) {
            if (chunk.includes(r.name)) {
              setSelectedId(r.id);
              break;
            }
          }
        },
        onError: (err) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMsgId
                ? {
                    ...msg,
                    text:
                      (msg.text.startsWith("⏳") ? "" : msg.text) +
                      `\n\n⚠️ 오류 발생: ${err}`,
                  }
                : msg
            )
          );
          setIsTyping(false);
          setIsAgentEvaluating(false);
        },
        onDone: () => {
          setIsTyping(false);
          setIsAgentEvaluating(false);
        },
      },
      { sessionId }
    );
  };

  const handleBack = () => {
    setScreen("setup");
    setMessages([]);
    setChatInput("");
    setIsTyping(false);
  };



  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full w-full" style={{ background: "var(--bg-canvas)" }}>
      <AnimatePresence mode="wait">
        {screen === "setup" ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            <SetupScreen onStartSearch={handleStartSearch} />
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col h-full overflow-hidden"
          >
            {/* Header */}
            {routeConfig && <Header routeConfig={routeConfig} onBack={handleBack} />}

            {/* Main Content: 3-column Layout */}
            <main
              className="flex-1 min-h-0"
              style={{
                display: "grid",
                gridTemplateColumns: "340px 1fr 42%",
                gap: "16px",
                padding: "16px",
                overflow: "hidden",
                height: "calc(100vh - 65px)",
              }}
            >
              {/* ── Col 1: Chat Panel (~340px) ────────────────── */}
              <section
                className="editorial-panel flex flex-col overflow-hidden"
                style={{ height: "100%", minHeight: 0 }}
              >
                <ChatPanel
                  messages={messages}
                  isTyping={isTyping}
                  inputValue={chatInput}
                  onInputChange={setChatInput}
                  onSend={handleChatSend}
                />
              </section>

              {/* ── Col 2: Restaurant Results + Inspector ─────── */}
              <section
                className="flex flex-col gap-4 overflow-hidden"
                style={{ height: "100%", minHeight: 0 }}
              >
                {/* Pareto Deck Header */}
                <div className="shrink-0">
                  <ParetoDeck alpha={alpha} onAlphaChange={setAlpha} />
                </div>

                {/* Agent Evaluating Progress Banner (Non-blocking) */}
                {isAgentEvaluating && (
                  <div
                    className="px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs shrink-0 border"
                    style={{
                      background: "rgba(226, 88, 34, 0.08)",
                      borderColor: "rgba(226, 88, 34, 0.3)",
                      color: "#f4f6fa",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Loader2
                        size={14}
                        className="animate-spin"
                        style={{ color: "var(--accent-primary)" }}
                      />
                      <span className="font-medium text-[12px]">
                        {agentStatusText || "AI 가드레일 및 시공간 분석 진행 중..."}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-orange-500/30 text-orange-400 bg-orange-500/10">
                      실시간 반영 중
                    </span>
                  </div>
                )}

                {/* List Summary & Quick Controls */}
                <div className="flex items-center justify-between px-1 text-xs shrink-0">
                  <div className="flex items-center gap-2 text-[#7d8699]">
                    <span>추천 식당</span>
                    <span className="font-bold text-[#f4f6fa] font-mono text-sm">
                      {visibleRestaurants.length}
                    </span>
                    <span>곳</span>
                    {isAgentEvaluating && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        AI 검증 중
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickSort("detour")}
                      className="px-2 py-1 rounded-md text-[11px] bg-white/[0.04] hover:bg-white/[0.08] text-[#8e95a5] hover:text-white transition-colors border border-white/[0.06] cursor-pointer"
                    >
                      ⏱️ 최단우회
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSort("solo")}
                      className="px-2 py-1 rounded-md text-[11px] bg-white/[0.04] hover:bg-white/[0.08] text-[#8e95a5] hover:text-white transition-colors border border-white/[0.06] cursor-pointer"
                    >
                      👤 혼밥추천
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSort("sentiment")}
                      className="px-2 py-1 rounded-md text-[11px] bg-white/[0.04] hover:bg-white/[0.08] text-[#8e95a5] hover:text-white transition-colors border border-white/[0.06] cursor-pointer"
                    >
                      ⭐ 리뷰순
                    </button>
                  </div>
                </div>

                {/* Loading State only if no restaurants are loaded yet */}
                {isInitialLoading && rawRestaurants.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 editorial-panel">
                    <Loader2
                      size={28}
                      className="animate-spin"
                      style={{ color: "var(--accent-primary)" }}
                    />
                    <div
                      className="text-sm font-medium"
                      style={{ color: "var(--text-headline)" }}
                    >
                      실시간 회랑 식당 탐색 중...
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {routeConfig?.origin.name} → {routeConfig?.destination.name}
                    </div>
                  </div>
                ) : (
                  /* Restaurant Cards List (Scrollable) */
                  <div
                    className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 min-h-0"
                    style={{ scrollbarGutter: "stable" }}
                  >
                    <AnimatePresence mode="popLayout">
                      {visibleRestaurants.length > 0 ? (
                        visibleRestaurants.map((restaurant, idx) => (
                          <DiningCard
                            key={restaurant.id}
                            restaurant={restaurant}
                            rank={idx + 1}
                            isSelected={restaurant.id === selectedId}
                            onSelect={() => setSelectedId(restaurant.id)}
                          />
                        ))
                      ) : (
                        <div
                          className="p-8 text-center text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          조건에 부합하는 식당이 없습니다. 대화창에 원하는 조건을 말씀해주세요.
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Temporal Inspector (Fixed at bottom) */}
                <div className="shrink-0">
                  <TemporalInspector
                    safeCount={safeCount}
                    prunedCount={prunedCount}
                    showPruned={showPruned}
                    onToggleShowPruned={() => setShowPruned(!showPruned)}
                  />
                </div>
              </section>

              {/* ── Col 3: Tactical Map Pod (~42% width) ──────── */}
              <section
                className="flex flex-col gap-3 overflow-hidden"
                style={{ height: "100%", minHeight: 0 }}
              >
                {/* Map */}
                <div style={{ flex: 1, minHeight: 0 }}>
                  <TacticalMapPod
                    restaurants={visibleRestaurants}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    origin={routeConfig?.origin}
                    destination={routeConfig?.destination}
                    routeCoordinates={routeCoordinates}
                  />
                </div>

                {/* Route Summary Footer */}
                <div
                  className="shrink-0 px-5 py-3.5 flex items-center justify-around text-xs font-mono border-t"
                  style={{ borderColor: "var(--border-quiet)", background: "var(--bg-surface)" }}
                >
                  <div className="text-center">
                    <div style={{ color: "var(--text-muted)" }} className="text-[11px]">
                      직행 거리
                    </div>
                    <div style={{ color: "var(--text-headline)" }} className="font-semibold mt-0.5">
                      {routeSummary ? `${routeSummary.distance} km` : "16.8 km"}
                    </div>
                  </div>
                  <div className="w-[1px] h-8" style={{ background: "var(--border-quiet)" }} />
                  <div className="text-center">
                    <div style={{ color: "var(--text-muted)" }} className="text-[11px]">
                      실시간 소요
                    </div>
                    <div style={{ color: "var(--accent-primary)" }} className="font-semibold mt-0.5">
                      {routeSummary ? `${routeSummary.duration}분` : "40분"}
                    </div>
                  </div>
                  <div className="w-[1px] h-8" style={{ background: "var(--border-quiet)" }} />
                  <div className="text-center">
                    <div style={{ color: "var(--text-muted)" }} className="text-[11px]">
                      최적 경유 우회
                    </div>
                    <div style={{ color: "var(--accent-green)" }} className="font-semibold mt-0.5">
                      {visibleRestaurants.length > 0
                        ? `+${visibleRestaurants[0].detourMinutes}분`
                        : "+2분"}
                    </div>
                  </div>
                </div>
              </section>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
