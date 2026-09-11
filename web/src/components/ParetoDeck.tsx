import * as Slider from "@radix-ui/react-slider";

interface ParetoDeckProps {
  alpha: number; // 0.0 ~ 1.0
  onAlphaChange: (val: number) => void;
}

export const ParetoDeck = ({ alpha, onAlphaChange }: ParetoDeckProps) => {
  const getModeSummary = () => {
    if (alpha >= 0.65) return "시간 절약 우선 — 직행 대비 +1~2분 이내의 최소 우회 맛집을 상위에 배치합니다.";
    if (alpha <= 0.35) return "맛집 퀄리티 우선 — 우회가 조금 늘더라도 미쉐린 및 최고 평점 식당을 우선합니다.";
    return "파레토 최적 밸런스 — 우회 시간과 맛집 퀄리티, 조리 속도를 균형 있게 반영합니다.";
  };

  return (
    <div className="p-4 rounded-xl bg-[#14171f] border border-white/[0.06] flex flex-col gap-2.5">
      {/* Label and Readout */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[#f4f6fa]">
          다목적 파레토 최적화 (Pareto Trade-off)
        </span>
        <span className="text-[11px] font-mono text-[#7d8699]">
          우회 가중치 {(alpha * 100).toFixed(0)}%
        </span>
      </div>

      {/* Slider */}
      <div className="py-1">
        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-4 cursor-pointer"
          value={[alpha]}
          max={1}
          min={0}
          step={0.05}
          onValueChange={(vals) => onAlphaChange(vals[0])}
        >
          <Slider.Track className="clean-slider-track">
            <Slider.Range className="clean-slider-range" />
          </Slider.Track>
          <Slider.Thumb className="clean-slider-thumb" aria-label="Pareto weight" />
        </Slider.Root>

        <div className="flex justify-between text-[11px] text-[#7d8699] mt-1.5 font-medium">
          <span className={alpha >= 0.6 ? "text-white font-semibold" : ""}>
            최소 우회 (+1~2분)
          </span>
          <span className={alpha <= 0.4 ? "text-white font-semibold" : ""}>
            맛집 퀄리티 우선
          </span>
        </div>
      </div>

      {/* Explanatory sentence */}
      <p className="text-[11px] text-[#7d8699] leading-relaxed pt-1 border-t border-white/[0.04]">
        {getModeSummary()}
      </p>
    </div>
  );
};
