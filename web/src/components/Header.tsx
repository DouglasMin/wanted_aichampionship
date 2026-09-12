import { ArrowLeft } from "lucide-react";
import type { RouteConfig } from "../types";

interface HeaderProps {
  routeConfig: RouteConfig;
  onBack: () => void;
}

export const Header = ({ routeConfig, onBack }: HeaderProps) => {
  return (
    <header
      className="w-full px-6 py-3.5 border-b flex items-center justify-between shrink-0"
      style={{
        borderColor: "var(--border-quiet)",
        background: "var(--bg-canvas)",
      }}
    >
      {/* Left: Back + Brand */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06]"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft size={14} />
          다시 설정
        </button>

        <div className="w-[1px] h-5" style={{ background: "var(--border-quiet)" }} />

        <span
          className="text-base font-bold tracking-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-headline)" }}
        >
          Way<span style={{ color: "var(--accent-primary)" }}>Bite</span>
        </span>
      </div>

      {/* Right: Route Pill */}
      <div
        className="hidden md:flex items-center gap-2 text-xs font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        <span style={{ color: "var(--text-headline)" }} className="font-medium">
          {routeConfig.origin.name}
        </span>
        <span style={{ color: "var(--text-faint)" }}>→</span>
        <span style={{ color: "var(--text-headline)" }} className="font-medium">
          {routeConfig.destination.name}
        </span>
        <span
          className="ml-1.5 font-sans font-semibold"
          style={{ color: "var(--accent-primary)" }}
        >
          {routeConfig.mode === "CAR" ? "🚗" : routeConfig.mode === "TRANSIT" ? "🚇" : routeConfig.mode === "WALK" ? "🚶" : "🚲"}
          {" "}{routeConfig.departureTime}
        </span>
      </div>
    </header>
  );
};
