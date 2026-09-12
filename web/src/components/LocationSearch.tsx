import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, X, CheckCircle2 } from "lucide-react";
import type { LocationPoint } from "../types";
import { searchKakaoKeyword, type KakaoPlace } from "../lib/kakaoSearch";

interface LocationSearchProps {
  value: LocationPoint | null;
  onChange: (point: LocationPoint | null) => void;
  placeholder: string;
  icon: React.ReactNode;
}

export const LocationSearch = ({
  value,
  onChange,
  placeholder,
  icon,
}: LocationSearchProps) => {
  const [inputText, setInputText] = useState(value?.name ?? "");
  const [results, setResults] = useState<KakaoPlace[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with value if updated from parent
  useEffect(() => {
    if (value?.name) {
      setInputText(value.name);
    } else if (value === null) {
      setInputText("");
    }
  }, [value]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Execute keyword search
  const performSearch = useCallback(async (query: string): Promise<KakaoPlace[]> => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      return [];
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const places = await searchKakaoKeyword(trimmed, 6);
      setResults(places);
      setIsOpen(true);
      setActiveIndex(places.length > 0 ? 0 : -1);
      return places;
    } catch (err) {
      console.error("Kakao keyword search error:", err);
      setResults([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Input change with debounce
  const handleInputChange = (text: string) => {
    setInputText(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text.trim()) {
      setResults([]);
      setIsOpen(false);
      setHasSearched(false);
      onChange(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(text);
    }, 250);
  };

  // Select place item
  const handleSelectPlace = (place: KakaoPlace) => {
    setInputText(place.name);
    setIsOpen(false);
    setResults([]);
    setActiveIndex(-1);
    onChange({
      name: place.name,
      lat: place.lat,
      lng: place.lng,
    });
  };

  // Clear selection
  const handleClear = () => {
    setInputText("");
    setResults([]);
    setIsOpen(false);
    setHasSearched(false);
    setActiveIndex(-1);
    onChange(null);
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen && results.length > 0) {
        setIsOpen(true);
        return;
      }
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();

      // If dropdown is open and we have results
      if (isOpen && results.length > 0) {
        const target = activeIndex >= 0 && activeIndex < results.length
          ? results[activeIndex]
          : results[0];
        handleSelectPlace(target);
        return;
      }

      // If user typed and immediately pressed Enter without waiting for debounce
      if (inputText.trim()) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const places = await performSearch(inputText);
        if (places.length > 0) {
          handleSelectPlace(places[0]);
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Icon */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none flex items-center justify-center">
        {icon}
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          if (results.length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="input-field"
        style={{
          paddingLeft: "44px",
          paddingRight: value ? "110px" : inputText ? "44px" : "16px",
        }}
        autoComplete="off"
        spellCheck="false"
      />

      {/* Right controls: Loading spinner / Clear button / Verified coordinate badge */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
        {isLoading && (
          <Loader2 size={15} className="animate-spin" style={{ color: "var(--accent-primary)" }} />
        )}

        {inputText && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors cursor-pointer"
            title="지우기"
          >
            <X size={13} />
          </button>
        )}

        {value && (
          <div
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md shrink-0"
            style={{
              background: "rgba(34, 197, 94, 0.15)",
              color: "#4ade80",
              fontWeight: 600,
              border: "1px solid rgba(34, 197, 94, 0.25)",
            }}
          >
            <CheckCircle2 size={11} />
            좌표 확인
          </div>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl overflow-hidden"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-hover)",
            boxShadow: "0 16px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)",
            maxHeight: "320px",
            overflowY: "auto",
          }}
        >
          {results.length > 0 ? (
            <div>
              <div
                className="px-3.5 py-1.5 text-[10px] font-semibold tracking-wider uppercase border-b flex justify-between items-center"
                style={{
                  color: "var(--text-faint)",
                  borderColor: "var(--border-quiet)",
                  background: "rgba(255, 255, 255, 0.02)",
                }}
              >
                <span>검색 결과 ({results.length})</span>
                <span className="font-normal lowercase">Enter로 선택</span>
              </div>

              {results.map((place, idx) => {
                const isItemActive = idx === activeIndex;
                return (
                  <button
                    key={place.id || `${place.lat}-${place.lng}-${idx}`}
                    type="button"
                    onClick={() => handleSelectPlace(place)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className="w-full text-left px-4 py-3 flex flex-col gap-0.5 transition-colors cursor-pointer"
                    style={{
                      borderBottom:
                        idx === results.length - 1 ? "none" : "1px solid var(--border-quiet)",
                      background: isItemActive ? "var(--bg-surface-hover)" : "transparent",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-medium"
                        style={{
                          color: isItemActive ? "var(--accent-primary)" : "var(--text-headline)",
                        }}
                      >
                        {place.name}
                      </span>
                      {place.category && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            background: "var(--bg-subtle)",
                            color: "var(--text-faint)",
                          }}
                        >
                          {place.category}
                        </span>
                      )}
                    </div>
                    <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {place.roadAddress || place.address}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            hasSearched &&
            !isLoading && (
              <div className="p-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                검색 결과가 없습니다. 다른 검색어를 입력해 보세요.
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
