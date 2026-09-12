import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import type { Restaurant, LocationPoint } from "../types";
import { Info } from "lucide-react";

declare global {
  interface Window {
    kakao: any;
  }
}

interface TacticalMapPodProps {
  restaurants: Restaurant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  origin?: LocationPoint;
  destination?: LocationPoint;
  routeCoordinates?: [number, number][];
}

type MapEngine = "kakao" | "leaflet" | null;

/**
 * Checks or loads Kakao Maps SDK dynamically.
 * Resolves true if available, false if failed or unauthorized.
 */
function tryLoadKakao(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve(true));
      return;
    }

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src =
      "https://dapi.kakao.com/v2/maps/sdk.js?appkey=1b8a016f0232babcf72db2781d663053&autoload=false&libraries=services,clusterer";

    const timeout = setTimeout(() => {
      resolve(false);
    }, 1500);

    script.onload = () => {
      clearTimeout(timeout);
      if (window.kakao?.maps) {
        window.kakao.maps.load(() => resolve(true));
      } else {
        resolve(false);
      }
    };

    script.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };

    document.head.appendChild(script);
  });
}

export const TacticalMapPod = ({
  restaurants,
  selectedId,
  onSelect,
  origin,
  destination,
  routeCoordinates,
}: TacticalMapPodProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<MapEngine>(null);
  const [mapReady, setMapReady] = useState(false);

  // References for Leaflet
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkersRef = useRef<L.Marker[]>([]);
  const leafletPolylineRef = useRef<L.Polyline | null>(null);

  // References for Kakao
  const kakaoMapRef = useRef<any>(null);
  const kakaoOverlaysRef = useRef<any[]>([]);
  const kakaoPolylineRef = useRef<any>(null);

  // ── Render Kakao Markers & Route ────────────────────
  const renderKakaoMarkers = useCallback(
    (map: any) => {
      if (!window.kakao?.maps) return;
      const kakao = window.kakao;

      kakaoOverlaysRef.current.forEach((o) => o.setMap(null));
      kakaoOverlaysRef.current = [];
      if (kakaoPolylineRef.current) {
        kakaoPolylineRef.current.setMap(null);
        kakaoPolylineRef.current = null;
      }

      const bounds = new kakao.maps.LatLngBounds();

      if (origin) {
        const pos = new kakao.maps.LatLng(origin.lat, origin.lng);
        bounds.extend(pos);
        const el = document.createElement("div");
        el.innerHTML = `
          <div style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:10px;background:#2563eb;color:#ffffff;font-weight:700;font-size:11px;box-shadow:0 4px 14px rgba(37,99,235,0.4);border:1px solid rgba(255,255,255,0.25);white-space:nowrap;">
            <span style="font-size:10px;opacity:0.85;">출발</span>
            <span>${origin.name}</span>
          </div>
        `;
        const overlay = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 1.2 });
        overlay.setMap(map);
        kakaoOverlaysRef.current.push(overlay);
      }

      if (destination) {
        const pos = new kakao.maps.LatLng(destination.lat, destination.lng);
        bounds.extend(pos);
        const el = document.createElement("div");
        el.innerHTML = `
          <div style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:10px;background:#16a34a;color:#ffffff;font-weight:700;font-size:11px;box-shadow:0 4px 14px rgba(22,163,74,0.4);border:1px solid rgba(255,255,255,0.25);white-space:nowrap;">
            <span style="font-size:10px;opacity:0.85;">도착</span>
            <span>${destination.name}</span>
          </div>
        `;
        const overlay = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 1.2 });
        overlay.setMap(map);
        kakaoOverlaysRef.current.push(overlay);
      }

      restaurants.forEach((r, idx) => {
        const pos = new kakao.maps.LatLng(r.lat, r.lng);
        bounds.extend(pos);
        const isSelected = r.id === selectedId;
        const isRejected = r.safetyStatus === "REJECTED";
        const bg = isRejected ? "#dc2626" : isSelected ? "var(--accent-primary)" : "#1e2433";
        const borderColor = isSelected ? "#ffffff" : "rgba(255,255,255,0.18)";

        const el = document.createElement("div");
        el.style.cursor = "pointer";
        el.innerHTML = `
          <div style="display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:8px;background:${bg};color:#ffffff;font-weight:700;font-size:11px;box-shadow:${isSelected ? "0 0 16px rgba(226,88,34,0.6)" : "0 3px 8px rgba(0,0,0,0.4)"};border:1px solid ${borderColor};white-space:nowrap;">
            <span style="background:rgba(255,255,255,0.2);border-radius:4px;padding:1px 4px;font-size:10px;">${isRejected ? "✕" : idx + 1}</span>
            <span>${r.name}</span>
          </div>
        `;
        el.onclick = () => onSelect(r.id);

        const overlay = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 1.2 });
        overlay.setMap(map);
        kakaoOverlaysRef.current.push(overlay);
      });

      const routePoints: any[] = [];
      if (routeCoordinates && routeCoordinates.length >= 2) {
        routeCoordinates.forEach(([lat, lng]) => {
          const pt = new kakao.maps.LatLng(lat, lng);
          routePoints.push(pt);
          bounds.extend(pt);
        });
      } else {
        if (origin) routePoints.push(new kakao.maps.LatLng(origin.lat, origin.lng));
        if (restaurants.length > 0) {
          const sel = restaurants.find((r) => r.id === selectedId) || restaurants[0];
          routePoints.push(new kakao.maps.LatLng(sel.lat, sel.lng));
        }
        if (destination) routePoints.push(new kakao.maps.LatLng(destination.lat, destination.lng));
      }

      if (routePoints.length >= 2) {
        const polyline = new kakao.maps.Polyline({
          path: routePoints,
          strokeWeight: 4,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.85,
          strokeStyle: "solid",
        });
        polyline.setMap(map);
        kakaoPolylineRef.current = polyline;
      }

      if (!bounds.isEmpty()) {
        map.setBounds(bounds, 50);
      }
    },
    [origin, destination, restaurants, selectedId, onSelect, routeCoordinates]
  );

  // ── Render Leaflet Markers & Route ──────────────────
  const renderLeafletMarkers = useCallback(
    (map: L.Map) => {
      // Clear old markers
      leafletMarkersRef.current.forEach((m) => m.remove());
      leafletMarkersRef.current = [];
      if (leafletPolylineRef.current) {
        leafletPolylineRef.current.remove();
        leafletPolylineRef.current = null;
      }

      const allLatLngs: [number, number][] = [];

      // Origin Marker
      if (origin) {
        allLatLngs.push([origin.lat, origin.lng]);
        const originIcon = L.divIcon({
          className: "custom-map-marker",
          html: `
            <div style="
              display:inline-flex;align-items:center;gap:5px;
              padding:5px 11px;border-radius:10px;
              background:#2563eb;color:#ffffff;
              font-family:var(--font-body);
              font-weight:700;font-size:11px;
              box-shadow:0 4px 14px rgba(37,99,235,0.4),0 2px 5px rgba(0,0,0,0.5);
              border:1px solid rgba(255,255,255,0.25);
              white-space:nowrap;cursor:default;
            ">
              <span style="font-size:10px;opacity:0.85;">출발</span>
              <span>${origin.name}</span>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [30, 15],
        });
        const marker = L.marker([origin.lat, origin.lng], { icon: originIcon }).addTo(map);
        leafletMarkersRef.current.push(marker);
      }

      // Destination Marker
      if (destination) {
        allLatLngs.push([destination.lat, destination.lng]);
        const destIcon = L.divIcon({
          className: "custom-map-marker",
          html: `
            <div style="
              display:inline-flex;align-items:center;gap:5px;
              padding:5px 11px;border-radius:10px;
              background:#16a34a;color:#ffffff;
              font-family:var(--font-body);
              font-weight:700;font-size:11px;
              box-shadow:0 4px 14px rgba(22,163,74,0.4),0 2px 5px rgba(0,0,0,0.5);
              border:1px solid rgba(255,255,255,0.25);
              white-space:nowrap;cursor:default;
            ">
              <span style="font-size:10px;opacity:0.85;">도착</span>
              <span>${destination.name}</span>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [30, 15],
        });
        const marker = L.marker([destination.lat, destination.lng], { icon: destIcon }).addTo(map);
        leafletMarkersRef.current.push(marker);
      }

      // Restaurant Markers
      restaurants.forEach((r, idx) => {
        allLatLngs.push([r.lat, r.lng]);
        const isSelected = r.id === selectedId;
        const isRejected = r.safetyStatus === "REJECTED";

        const bg = isRejected
          ? "#dc2626"
          : isSelected
          ? "var(--accent-primary)"
          : "#1e2433";
        const borderColor = isSelected
          ? "#ffffff"
          : "rgba(255,255,255,0.18)";
        const scale = isSelected ? "scale(1.12)" : "scale(1)";
        const zIndex = isSelected ? 1000 : 100;

        const icon = L.divIcon({
          className: "custom-map-marker",
          html: `
            <div style="
              transform: ${scale};
              transition: transform 0.2s ease, box-shadow 0.2s ease;
              display:inline-flex;align-items:center;gap:5px;
              padding:4px 9px;border-radius:8px;
              background:${bg};color:#ffffff;
              font-family:var(--font-body);
              font-weight:700;font-size:11px;
              box-shadow:${isSelected ? "0 0 16px rgba(226,88,34,0.6)" : "0 3px 8px rgba(0,0,0,0.4)"};
              border:1px solid ${borderColor};
              white-space:nowrap;cursor:pointer;
              z-index:${zIndex};
            ">
              <span style="
                background:rgba(255,255,255,0.2);
                border-radius:4px;padding:1px 4px;font-size:10px;
              ">${isRejected ? "✕" : idx + 1}</span>
              <span>${r.name}</span>
              <span style="font-size:9px;opacity:0.75;font-weight:400;">★${r.rating}</span>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [25, 14],
        });

        const marker = L.marker([r.lat, r.lng], { icon }).addTo(map);
        marker.on("click", () => onSelect(r.id));
        leafletMarkersRef.current.push(marker);
      });

      // Polyline (Exact route coordinates from Kakao Mobility if available)
      const routePoints: [number, number][] =
        routeCoordinates && routeCoordinates.length >= 2
          ? routeCoordinates
          : [];

      if (routePoints.length === 0) {
        if (origin) routePoints.push([origin.lat, origin.lng]);
        if (restaurants.length > 0) {
          const sel = restaurants.find((r) => r.id === selectedId) || restaurants[0];
          routePoints.push([sel.lat, sel.lng]);
        }
        if (destination) routePoints.push([destination.lat, destination.lng]);
      }

      if (routePoints.length >= 2) {
        const polyline = L.polyline(routePoints, {
          color: "#3b82f6",
          weight: 4,
          opacity: 0.85,
        }).addTo(map);
        leafletPolylineRef.current = polyline;
      }

      // Bounds fit
      const fitPoints: [number, number][] = [...allLatLngs];
      if (routePoints.length > 0) {
        fitPoints.push(...routePoints);
      }

      if (fitPoints.length > 0) {
        const bounds = L.latLngBounds(fitPoints);
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
      }
    },
    [origin, destination, restaurants, selectedId, onSelect, routeCoordinates]
  );

  // ── Initialize Map Engine ───────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    tryLoadKakao().then((kakaoOk) => {
      if (cancelled || !containerRef.current) return;

      if (kakaoOk && window.kakao?.maps) {
        // Kakao Map available!
        setEngine("kakao");
        const kakao = window.kakao;

        let centerLat = 37.5665;
        let centerLng = 126.9780;
        if (origin && destination) {
          centerLat = (origin.lat + destination.lat) / 2;
          centerLng = (origin.lng + destination.lng) / 2;
        }

        const map = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(centerLat, centerLng),
          level: 6,
        });
        kakaoMapRef.current = map;
        renderKakaoMarkers(map);
        setMapReady(true);
      } else {
        // Fallback to high-performance Leaflet dark tactical map
        setEngine("leaflet");

        let centerLat = 37.5665;
        let centerLng = 126.9780;
        if (origin && destination) {
          centerLat = (origin.lat + destination.lat) / 2;
          centerLng = (origin.lng + destination.lng) / 2;
        }

        const map = L.map(containerRef.current, {
          center: [centerLat, centerLng],
          zoom: 12,
          zoomControl: false,
          attributionControl: true,
        });

        // OpenStreetMap tiles with dark CSS filter — 100% free, no API key needed
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          className: "dark-map-tiles",
        }).addTo(map);

        leafletMapRef.current = map;
        renderLeafletMarkers(map);
        setMapReady(true);
      }
    });

    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // ── Update Markers when selection or items change ────
  useEffect(() => {
    if (engine === "leaflet" && leafletMapRef.current && mapReady) {
      renderLeafletMarkers(leafletMapRef.current);
    } else if (engine === "kakao" && kakaoMapRef.current && mapReady) {
      renderKakaoMarkers(kakaoMapRef.current);
    }
  }, [engine, mapReady, renderLeafletMarkers, renderKakaoMarkers]);

  // ── Zoom In / Out Handlers ──────────────────────────
  const handleZoomIn = () => {
    if (engine === "leaflet" && leafletMapRef.current) {
      leafletMapRef.current.zoomIn();
    } else if (engine === "kakao" && kakaoMapRef.current) {
      kakaoMapRef.current.setLevel(kakaoMapRef.current.getLevel() - 1);
    }
  };

  const handleZoomOut = () => {
    if (engine === "leaflet" && leafletMapRef.current) {
      leafletMapRef.current.zoomOut();
    } else if (engine === "kakao" && kakaoMapRef.current) {
      kakaoMapRef.current.setLevel(kakaoMapRef.current.getLevel() + 1);
    }
  };

  return (
    <div
      className="flex flex-col overflow-hidden border border-white/[0.07]"
      style={{ background: "var(--bg-surface)", borderRadius: "16px", height: "100%" }}
    >
      {/* Top Bar */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between text-xs shrink-0"
        style={{ borderColor: "var(--border-quiet)", color: "var(--text-muted)" }}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold" style={{ color: "var(--text-headline)" }}>
            경로 지도
          </span>

          {engine === "leaflet" && (
            <div
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(226, 88, 34, 0.12)",
                color: "var(--accent-primary)",
                border: "1px solid rgba(226, 88, 34, 0.25)",
              }}
              title="카카오맵 콘솔 설정 활성화 전까지 고성능 전술 맵으로 안전하게 렌더링됩니다."
            >
              <Info size={10} />
              <span>전술 맵 모드</span>
            </div>
          )}

          {engine === "kakao" && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(34, 197, 94, 0.12)",
                color: "#4ade80",
                border: "1px solid rgba(34, 197, 94, 0.25)",
              }}
            >
              Kakao Maps
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-[2px] rounded" style={{ background: "#3b82f6" }} />
            경로 회랑
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--accent-primary)" }} />
            추천 식당
          </span>
        </div>
      </div>

      {/* Map Container */}
      <div
        className="relative flex-1 w-full"
        style={{ minHeight: "400px", background: "var(--bg-canvas)" }}
      >
        <div
          ref={containerRef}
          style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
        />

        {/* Loading Overlay */}
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0c0e12]/80 backdrop-blur-xs">
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              지도 로딩 중...
            </div>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="absolute bottom-3 right-3 z-[1000] flex flex-col gap-1">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-lg border text-white text-sm font-bold hover:bg-white/10 cursor-pointer backdrop-blur-sm flex items-center justify-center"
            style={{ background: "rgba(20,23,31,0.9)", borderColor: "rgba(255,255,255,0.1)" }}
            aria-label="확대"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-lg border text-white text-sm font-bold hover:bg-white/10 cursor-pointer backdrop-blur-sm flex items-center justify-center"
            style={{ background: "rgba(20,23,31,0.9)", borderColor: "rgba(255,255,255,0.1)" }}
            aria-label="축소"
          >
            −
          </button>
        </div>
      </div>
    </div>
  );
};
