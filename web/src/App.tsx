import { useState, useMemo } from "react";
import { Header } from "./components/Header";
import { ParetoDeck } from "./components/ParetoDeck";
import { TemporalInspector } from "./components/TemporalInspector";
import { DiningCard } from "./components/DiningCard";
import { TacticalMapPod } from "./components/TacticalMapPod";
import { INITIAL_RESTAURANTS } from "./data/mockData";
import type { TransportMode } from "./types";

const QUICK_CHIPS = [
  "퇴근길 10분 내 빠른 조리",
  "양재역 환승 칼국수 맛집",
  "조용한 이탈리안 파스타",
];

export function App() {
  const [mode, setMode] = useState<TransportMode>("CAR");
  const [alpha, setAlpha] = useState<number>(0.5);
  const [showPruned, setShowPruned] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string | null>("kakao-14590990");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [queryInput, setQueryInput] = useState<string>("");
  const [agentFeedback, setAgentFeedback] = useState<string>(
    "판교역에서 강남역(퇴근시간 정체 49분) 경로 분석 완료. 양재 회랑의 7개 식당 중 라스트오더 전에 안전하게 식사할 수 있는 곳들을 파레토 최적화로 정렬했습니다."
  );

  // Recalculate Pareto scores dynamically whenever alpha moves
  const processedRestaurants = useMemo(() => {
    return INITIAL_RESTAURANTS.map((r) => {
      if (r.safetyStatus === "REJECTED") {
        return { ...r, finalScore: 0 };
      }
      const normDetour = Math.max(0, 1 - r.detourMinutes / 15);
      const normQuality = (r.rating / 5) * 0.6 + (r.sentimentScore / 100) * 0.4;
      const normSpeed = r.cookingSpeedScore / 100;
      const score = alpha * normDetour * 50 + (1 - alpha) * normQuality * 40 + normSpeed * 10;

      return {
        ...r,
        finalScore: parseFloat(score.toFixed(1)),
      };
    }).sort((a, b) => {
      if (a.safetyStatus === "REJECTED" && b.safetyStatus !== "REJECTED") return 1;
      if (a.safetyStatus !== "REJECTED" && b.safetyStatus === "REJECTED") return -1;
      return b.finalScore - a.finalScore;
    });
  }, [alpha]);

  const visibleRestaurants = useMemo(() => {
    if (showPruned) return processedRestaurants;
    return processedRestaurants.filter((r) => r.safetyStatus !== "REJECTED");
  }, [processedRestaurants, showPruned]);

  const safeCount = processedRestaurants.filter((r) => r.safetyStatus !== "REJECTED").length;
  const prunedCount = processedRestaurants.filter((r) => r.safetyStatus === "REJECTED").length;

  const handleQuerySubmit = (text: string) => {
    if (!text.trim()) return;
    if (text.includes("칼국수") || text.includes("국수")) {
      setAgentFeedback(
        "🍜 '임병주 산동칼국수'는 미쉐린 빕구르망 칼국수 전문점으로 우회 +4분 소요됩니다. 라스트오더 전 120분 여유로 가장 안정적인 선택입니다."
      );
      setSelectedId("kakao-25038356");
    } else if (text.includes("빠른") || text.includes("혼밥")) {
      setAgentFeedback(
        "⚡ '작은공간'과 '황재벌'은 직행 대비 단 +2분 우회로 최소 패널티를 기록했습니다. 회전율이 빨라 빠른 식사에 최적입니다."
      );
      setSelectedId("kakao-14590990");
    } else {
      setAgentFeedback(
        `조건('${text}')을 반영하여 회랑 내 식당들의 실시간 도로 교통량과 브레이크타임 안전성을 재정렬했습니다.`
      );
    }
    setQueryInput("");
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0c0e12] text-[#c4cbd8] overflow-hidden">
      {/* Quiet Minimal Header */}
      <Header
        mode={mode}
        onModeChange={setMode}
        isSimulating={isSimulating}
        onToggleSimulator={() => setIsSimulating(!isSimulating)}
      />

      {/* Main 2-Column Balanced Stage */}
      <main className="flex-1 px-8 py-5 grid grid-cols-12 gap-8 min-h-0 overflow-hidden max-w-[1600px] mx-auto w-full">
        {/* Left Column (58%): Editorial Dining Dossier */}
        <section className="col-span-12 lg:col-span-7 h-full min-h-0 flex flex-col gap-4 overflow-hidden">
          {/* Conversational Query Bar & Feedback */}
          <div className="p-4 rounded-xl bg-[#14171f] border border-white/[0.06] flex flex-col gap-3 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleQuerySubmit(queryInput);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="예: 퇴근길에 10분 내로 빨리 먹고 갈 수 있는 곳 있어?"
                className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white placeholder-[#7d8699] focus:outline-none focus:border-[#e25822] transition-colors"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#e25822] text-white text-xs font-semibold hover:bg-[#cf4d1a] transition-colors cursor-pointer"
              >
                질문하기
              </button>
            </form>

            {/* Quick Filter Chips */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[11px] text-[#7d8699]">빠른 질문:</span>
              {QUICK_CHIPS.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => handleQuerySubmit(chip)}
                  className="px-2.5 py-1 rounded-md bg-white/[0.04] text-[11px] text-[#8e95a5] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Gentle Agent Feedback Banner */}
            <div className="text-xs text-[#8e95a5] leading-relaxed pt-2 border-t border-white/[0.04] flex items-start gap-2">
              <span className="text-[#e25822] font-semibold shrink-0">에이전트 브리핑:</span>
              <span>{agentFeedback}</span>
            </div>
          </div>

          {/* Pareto Slider HUD */}
          <ParetoDeck alpha={alpha} onAlphaChange={setAlpha} />

          {/* Temporal Guardrail Row */}
          <TemporalInspector
            showPruned={showPruned}
            onToggleShowPruned={() => setShowPruned(!showPruned)}
            safeCount={safeCount}
            prunedCount={prunedCount}
          />

          {/* Scrollable Clean Restaurant List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {visibleRestaurants.map((restaurant, idx) => (
              <DiningCard
                key={restaurant.id}
                restaurant={restaurant}
                rank={restaurant.safetyStatus === "REJECTED" ? undefined : idx + 1}
                isSelected={restaurant.id === selectedId}
                onSelect={() => setSelectedId(restaurant.id)}
              />
            ))}
          </div>
        </section>

        {/* Right Column (42%): Framed Map Pod & Route Summary */}
        <section className="col-span-12 lg:col-span-5 h-full min-h-0 flex flex-col gap-4">
          {/* Framed Map Pod */}
          <div className="flex-1 min-h-[380px] rounded-2xl overflow-hidden">
            <TacticalMapPod
              restaurants={visibleRestaurants}
              selectedId={selectedId}
              onSelect={setSelectedId}
              isSimulating={isSimulating}
            />
          </div>

          {/* Quiet Route Dossier */}
          <div className="p-4 rounded-xl bg-[#14171f] border border-white/[0.06] flex items-center justify-around text-xs shrink-0 font-mono">
            <div className="text-center">
              <div className="text-[11px] text-[#7d8699]">직행 거리</div>
              <div className="text-white font-semibold mt-0.5">16.8 km</div>
            </div>
            <div className="w-[1px] h-8 bg-white/5" />
            <div className="text-center">
              <div className="text-[11px] text-[#7d8699]">실시간 소요</div>
              <div className="text-[#e25822] font-semibold mt-0.5">49분</div>
            </div>
            <div className="w-[1px] h-8 bg-white/5" />
            <div className="text-center">
              <div className="text-[11px] text-[#7d8699]">최적 경유 우회</div>
              <div className="text-emerald-400 font-semibold mt-0.5">+2분</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
