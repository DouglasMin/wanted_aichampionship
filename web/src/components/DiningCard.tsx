import { motion } from "framer-motion";
import type { Restaurant } from "../types";

interface DiningCardProps {
  restaurant: Restaurant;
  rank?: number;
  isSelected: boolean;
  onSelect: () => void;
}

export const DiningCard = ({
  restaurant,
  rank,
  isSelected,
  onSelect,
}: DiningCardProps) => {
  const isPruned = restaurant.safetyStatus === "REJECTED";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onClick={onSelect}
      className={`p-4 rounded-xl transition-all cursor-pointer border ${
        isSelected
          ? "bg-[#181d28] border-[#e25822]/60 shadow-lg shadow-black/30"
          : isPruned
          ? "bg-rose-950/10 border-rose-500/20 opacity-70 hover:opacity-100"
          : "bg-[#14171f] border-white/[0.06] hover:border-white/15"
      }`}
    >
      {/* Top Header */}
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="flex items-baseline gap-2.5">
          {rank !== undefined && (
            <span className="text-xs font-mono font-bold text-[#7d8699]">
              {String(rank).padStart(2, "0")}
            </span>
          )}
          <h3 className="text-base font-semibold text-[#f4f6fa] tracking-tight">
            {restaurant.name}
          </h3>
          <span className="text-xs text-[#7d8699]">
            {restaurant.category}
          </span>
        </div>

        {!isPruned && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#e25822] font-mono">
              +{restaurant.detourMinutes}분 우회
            </span>
          </div>
        )}
      </div>

      {/* Temporal Status / Failure Explanation */}
      <div className="text-xs mb-2.5">
        {isPruned ? (
          <div className="text-rose-300/90 text-xs bg-rose-500/10 p-2 rounded-lg leading-relaxed">
            {restaurant.failReason}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[#8e95a5]">
            <span className="text-emerald-400 font-medium">도착 {restaurant.etaTime}</span>
            <span className="text-slate-600">•</span>
            <span>{restaurant.safetyBadge}</span>
          </div>
        )}
      </div>

      {/* Review Snippet */}
      {!isPruned && (
        <p className="text-xs text-[#8e95a5] line-clamp-2 leading-relaxed mb-3">
          "{restaurant.reviewSnippet}"
        </p>
      )}

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs pt-2 border-t border-white/[0.04] text-[#7d8699]">
        <div className="flex items-center gap-2">
          <span>평점 {restaurant.rating}</span>
          <span>•</span>
          <span className="truncate max-w-[200px]">{restaurant.address}</span>
        </div>

        <a
          href={restaurant.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-[#8e95a5] hover:text-[#f4f6fa] underline underline-offset-2"
        >
          카카오맵
        </a>
      </div>
    </motion.div>
  );
};
