export type TransportMode = "CAR" | "TRANSIT" | "BICYCLE" | "WALK";

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
