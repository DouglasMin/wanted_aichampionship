import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, Zap, ArrowRight } from "lucide-react";
import { LocationSearch } from "./LocationSearch";
import type { TransportMode, RouteConfig, LocationPoint } from "../types";

const MODES: { id: TransportMode; label: string; icon: string }[] = [
  { id: "CAR", label: "자동차", icon: "🚗" },
  { id: "TRANSIT", label: "대중교통", icon: "🚇" },
  { id: "WALK", label: "도보", icon: "🚶" },
  { id: "BICYCLE", label: "자전거", icon: "🚲" },
];

const QUICK_CHIPS = [
  "퇴근길 10분 내 빠른 조리",
  "양재역 환승 칼국수 맛집",
  "조용한 이탈리안 파스타",
  "혼밥하기 좋은 곳",
];

interface SetupScreenProps {
  onStartSearch: (config: RouteConfig) => void;
}

export const SetupScreen = ({ onStartSearch }: SetupScreenProps) => {
  const [mode, setMode] = useState<TransportMode>("CAR");
  const [origin, setOrigin] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [departureTime, setDepartureTime] = useState("지금 출발");
  const [queryText, setQueryText] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = origin && destination && !isSubmitting;

  const handleSubmit = () => {
    if (!origin || !destination || isSubmitting) return;
    setIsSubmitting(true);
    const query = queryText.trim() || "퇴근길에 빨리 먹을 수 있는 맛집 추천해줘";
    onStartSearch({
      origin,
      destination,
      departureTime,
      mode,
      naturalQuery: query,
    });
  };

  const handleChipClick = (chip: string) => {
    setQueryText(chip);
  };

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[540px] flex flex-col gap-10"
      >
        {/* ── Brand ────────────────────────────────── */}
        <div className="text-center">
          <h1
            className="text-[3.2rem] font-extrabold tracking-tight leading-none"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-headline)" }}
          >
            Way<span style={{ color: "var(--accent-primary)" }}>Bite</span>
          </h1>
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            이동 경로 위에서 최적의 한 끼를 찾아드립니다
          </p>
        </div>

        {/* ── Mode Selector ────────────────────────── */}
        <div className="flex items-center justify-center gap-2">
          {MODES.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`mode-chip ${mode === id ? "mode-chip-active" : ""}`}
            >
              <span className="mr-1.5">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* ── Route Input ──────────────────────────── */}
        <div className="flex flex-col gap-3">
          {/* Origin */}
          <LocationSearch
            value={origin}
            onChange={setOrigin}
            placeholder="출발지 검색 (예: 판교역, 강남역)"
            icon={<MapPin size={16} style={{ color: "var(--accent-primary)" }} />}
          />

          {/* Arrow Connector */}
          <div className="flex justify-center">
            <ArrowRight size={16} style={{ color: "var(--text-faint)" }} className="rotate-90" />
          </div>

          {/* Destination */}
          <LocationSearch
            value={destination}
            onChange={setDestination}
            placeholder="도착지 검색 (예: 서울역, 잠실역)"
            icon={<MapPin size={16} style={{ color: "var(--accent-green)" }} />}
          />

          {/* Departure Time */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <Clock size={16} style={{ color: "var(--text-muted)" }} />
            </div>
            <input
              type="text"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              placeholder="출발 시각 (예: 오후 6:30)"
              className="input-field"
              style={{ paddingLeft: "44px" }}
            />
          </div>
        </div>

        {/* ── Natural Query ─────────────────────────── */}
        <div className="flex flex-col gap-3">
          <label
            className="text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            💬 어떤 식사를 원하시나요?
          </label>
          <textarea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="예: 퇴근길에 10분 내로 빨리 먹고 갈 수 있는 곳 있어?"
            rows={2}
            className="input-field resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          {/* Quick Chips */}
          <div className="flex flex-wrap gap-2">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => handleChipClick(chip)}
                className="px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-quiet)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text-headline)";
                  e.currentTarget.style.borderColor = "var(--border-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.borderColor = "var(--border-quiet)";
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────── */}
        <motion.button
          whileHover={canSubmit ? { scale: 1.02 } : {}}
          whileTap={canSubmit ? { scale: 0.98 } : {}}
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="cta-button w-full"
          style={{
            opacity: canSubmit ? 1 : 0.4,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          <Zap size={18} />
          {canSubmit
            ? "최적 동선 맛집 탐색하기"
            : "출발지와 도착지를 선택해 주세요"}
        </motion.button>

        {/* ── Footnote ─────────────────────────────── */}
        <p
          className="text-center text-[11px]"
          style={{ color: "var(--text-faint)" }}
        >
          실시간 교통 정보 · 브레이크타임 가드레일 · 파레토 최적화
        </p>
      </motion.div>
    </div>
  );
};
