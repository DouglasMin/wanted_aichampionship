interface TemporalInspectorProps {
  showPruned: boolean;
  onToggleShowPruned: () => void;
  safeCount: number;
  prunedCount: number;
}

export const TemporalInspector = ({
  showPruned,
  onToggleShowPruned,
  safeCount,
  prunedCount,
}: TemporalInspectorProps) => {
  return (
    <div className="flex items-center justify-between text-xs py-1 px-1">
      <div className="flex items-center gap-2 text-[#8e95a5]">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <span>
          도착 시점 안전 식당 <strong className="text-white font-medium">{safeCount}곳</strong>
        </span>
      </div>

      <button
        onClick={onToggleShowPruned}
        className={`text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
          showPruned
            ? "bg-rose-500/15 text-rose-300 font-medium"
            : "text-[#7d8699] hover:text-white"
        }`}
      >
        {showPruned ? "탈락 식당 숨기기" : `탈락 사유 확인 (${prunedCount}곳)`}
      </button>
    </div>
  );
};
