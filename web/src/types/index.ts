export type TransportMode = "CAR" | "TRANSIT" | "BICYCLE" | "WALK";

export type AppScreen = "setup" | "result";

export interface LocationPoint {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteConfig {
  origin: LocationPoint;
  destination: LocationPoint;
  departureTime: string; // "오늘 오후 6:30" display string
  mode: TransportMode;
  naturalQuery: string;
}

export interface Restaurant {
  id: string;
  placeId: string;
  name: string;
  category: string;
  address: string;
  phone?: string;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  detourMinutes: number;
  travelTimeMinutes: number;
  etaTime: string;
  safetyStatus: "SAFE" | "TIGHT" | "REJECTED";
  safetyBadge: string;
  failReason?: string;
  guaranteedDiningMinutes: number;
  cookingSpeedScore: number;
  soloDiningScore: number;
  parkingScore: number;
  sentimentScore: number;
  reviewSnippet: string;
  sourceUrl: string;
  finalScore: number;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
  recommendedPlaces?: Restaurant[];
}
