import { useEffect, useRef } from "react";
import type { Restaurant } from "../types";

declare global {
  interface Window {
    kakao: any;
  }
}

interface TacticalMapPodProps {
  restaurants: Restaurant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isSimulating: boolean;
}

export const TacticalMapPod = ({
  restaurants,
  selectedId,
  onSelect,
  isSimulating,
}: TacticalMapPodProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(() => {
        const options = {
          center: new window.kakao.maps.LatLng(37.4845, 127.0341),
          level: 6,
        };
        const map = new window.kakao.maps.Map(containerRef.current, options);
        mapInstanceRef.current = map;

        // Draw direct trajectory polyline (Pangyo -> Yangjae -> Gangnam)
        const linePath = [
          new window.kakao.maps.LatLng(37.3947, 127.1111), // 판교역
          new window.kakao.maps.LatLng(37.4545, 127.0485), // 양재IC
          new window.kakao.maps.LatLng(37.4845, 127.0341), // 양재역
          new window.kakao.maps.LatLng(37.4980, 127.0280), // 강남역
        ];

        const polyline = new window.kakao.maps.Polyline({
          path: linePath,
          strokeWeight: 4,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.8,
          strokeStyle: "solid",
        });
        polyline.setMap(map);
        polylineRef.current = polyline;

        renderMarkers(map);
      });
    }
  }, []);

  const renderMarkers = (map: any) => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    restaurants.forEach((r, idx) => {
      const isSelected = r.id === selectedId;
      const isPruned = r.safetyStatus === "REJECTED";
      const position = new window.kakao.maps.LatLng(r.lat, r.lng);

      const markerContent = document.createElement("div");
      markerContent.className = "cursor-pointer transition-transform transform hover:scale-110";

      const bg = isPruned ? "#ef4444" : isSelected ? "#e25822" : idx === 0 ? "#e25822" : "#1e293b";
      const textColor = "#ffffff";

      markerContent.innerHTML = `
        <div style="
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 6px;
          background: ${bg};
          color: ${textColor};
          font-weight: 700;
          font-size: 11px;
          border: 1px solid rgba(255,255,255,0.2);
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        ">
          <span>${isPruned ? "✕" : idx + 1}</span>
          <span style="font-weight: 500; font-size: 10px;">${r.name.slice(0, 4)}</span>
        </div>
      `;

      markerContent.addEventListener("click", () => onSelect(r.id));

      const overlay = new window.kakao.maps.CustomOverlay({
        position,
        content: markerContent,
        yAnchor: 1.2,
      });

      overlay.setMap(map);
      markersRef.current.push(overlay);
    });
  };

  useEffect(() => {
    if (mapInstanceRef.current && window.kakao) {
      renderMarkers(mapInstanceRef.current);
    }
  }, [restaurants, selectedId]);

  return (
    <div className="h-full flex flex-col rounded-2xl overflow-hidden border border-white/[0.07] bg-[#14171f]">
      {/* Quiet Top Bar */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between text-xs text-[#8e95a5]">
        <span className="font-semibold text-white">경로 지도 뷰</span>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-[#3b82f6]" />
            <span>직행 경로</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e25822]" />
            <span>추천 식당</span>
          </span>
        </div>
      </div>

      {/* Embedded Map Pod */}
      <div className="relative flex-1 w-full h-full bg-[#0c0e12]">
        <div ref={containerRef} className="w-full h-full" />

        {/* Zoom Controls */}
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
          <button
            onClick={() => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.setLevel(mapInstanceRef.current.getLevel() - 1);
              }
            }}
            className="w-7 h-7 rounded bg-[#14171f] border border-white/10 text-white text-xs font-bold hover:bg-white/10 cursor-pointer"
          >
            +
          </button>
          <button
            onClick={() => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.setLevel(mapInstanceRef.current.getLevel() + 1);
              }
            }}
            className="w-7 h-7 rounded bg-[#14171f] border border-white/10 text-white text-xs font-bold hover:bg-white/10 cursor-pointer"
          >
            -
          </button>
        </div>

        {/* Simulation Car Pulse */}
        {isSimulating && (
          <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-lg bg-[#0c0e12]/90 border border-emerald-500/40 text-emerald-400 text-xs font-mono">
            양재IC 통과 중
          </div>
        )}
      </div>
    </div>
  );
};
