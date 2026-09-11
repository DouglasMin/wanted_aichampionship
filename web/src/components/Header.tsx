import type { TransportMode } from "../types";

interface HeaderProps {
  mode: TransportMode;
  onModeChange: (m: TransportMode) => void;
  isSimulating: boolean;
  onToggleSimulator: () => void;
}

export const Header = ({
  mode,
  onModeChange,
  isSimulating,
  onToggleSimulator,
}: HeaderProps) => {
  return (
    <header className="w-full px-8 py-4 border-b border-[rgba(255,255,255,0.06)] bg-[#0c0e12] flex items-center justify-between shrink-0">
      {/* Brand & Route Summary */}
      <div className="flex items-center gap-6">
        <div className="flex items-baseline gap-2.5">
          <span className="text-xl font-bold tracking-tight text-[#f4f6fa] font-display">
            WayBite
          </span>
          <span className="text-xs text-[#7d8699] font-medium">
            시공간 경로 최적화 맛집 에이전트
          </span>
        </div>

        {/* Quiet Route Badge */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-[#8e95a5] pl-6 border-l border-white/10">
          <span className="text-white font-medium">판교역</span>
          <span className="text-slate-500">→</span>
          <span className="text-white font-medium">강남역</span>
          <span className="text-[#e25822] ml-1.5 font-sans font-semibold">실시간 49분 소요</span>
        </div>
      </div>

      {/* Mode Selector & Clean Action */}
      <div className="flex items-center gap-3">
        {/* Mode Selector */}
        <div className="flex items-center p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {(
            [
              { id: "CAR", label: "자동차" },
              { id: "TRANSIT", label: "대중교통" },
              { id: "BICYCLE", label: "자전거" },
              { id: "WALK", label: "도보" },
            ] as const
          ).map(({ id, label }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                onClick={() => onModeChange(id)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  active
                    ? "bg-[#e25822] text-white"
                    : "text-[#7d8699] hover:text-white"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Clean Simulation Toggle */}
        <button
          onClick={onToggleSimulator}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
            isSimulating
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
              : "border-white/10 text-[#7d8699] hover:text-white hover:border-white/20"
          }`}
        >
          {isSimulating ? "● 가상 주행 중" : "가상 주행"}
        </button>
      </div>
    </header>
  );
};
