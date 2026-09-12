export interface KakaoPlace {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  lat: number;
  lng: number;
  category: string;
  phone?: string;
  url?: string;
}

const KAKAO_REST_KEY = "078370a041aa6afb4c2d4b67e25c89fd";

/**
 * Searches locations using Kakao Local Keyword Search API.
 * Tries local Vite proxy first, falls back to direct Kakao REST API with CORS.
 */
export async function searchKakaoKeyword(query: string, size = 6): Promise<KakaoPlace[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const endpoints = [
    `/api/kakao/v2/local/search/keyword.json?query=${encodeURIComponent(trimmed)}&size=${size}`,
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(trimmed)}&size=${size}`,
  ];

  for (const url of endpoints) {
    try {
      const headers: Record<string, string> = {};
      if (url.startsWith("https://dapi.kakao.com")) {
        headers["Authorization"] = `KakaoAK ${KAKAO_REST_KEY}`;
      }

      const res = await fetch(url, { headers });
      if (!res.ok) continue;

      const data = await res.json();
      if (!data.documents || !Array.isArray(data.documents)) continue;

      return data.documents.map((item: any) => ({
        id: item.id,
        name: item.place_name,
        address: item.address_name || "",
        roadAddress: item.road_address_name || "",
        lat: parseFloat(item.y),
        lng: parseFloat(item.x),
        category: item.category_group_name || item.category_name?.split(" > ").pop() || "",
        phone: item.phone || undefined,
        url: item.place_url || undefined,
      }));
    } catch {
      // Continue to next endpoint if available
    }
  }

  return [];
}
