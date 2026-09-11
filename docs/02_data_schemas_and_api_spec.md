# 02. 데이터 스키마 및 API 인터페이스 명세서 (Data Schemas & API Spec)

본 문서는 **WayBite (웨이바이트)**의 내부 에이전트 간 데이터 교환 포맷, 데이터베이스 모델(Pydantic/TypeScript), 그리고 외부 연동 API(카카오, ODsay, TMap, Google Places)의 요청/응답 규격을 정의합니다.

---

## 📌 1. 핵심 데이터 모델 (Core Data Models - Pydantic / TypeScript)

### 1.1 사용자 요청 모델 (UserRequestSchema)
사용자의 자연어 질의 및 UI 제어 파라미터를 통합하는 입력 스키마입니다.

```typescript
export type TransportMode = "DRIVING" | "TRANSIT" | "WALKING" | "BICYCLING";

export interface UserRequestSchema {
  requestId: string;
  userId?: string;          // AWS Cognito User Sub (e.g., "us-east-1:xxxx-xxxx")
  userProfile?: {
    dietaryRestrictions: string[]; // e.g., ["비건", "견과류 알레르기"]
    spicinessTolerance: number;    // 1 (순한맛) ~ 5 (매운맛 마니아)
    preferredVehicleType?: string; // "EV" | "COMPACT" | "SEDAN"
  };
  origin: {
    name: string;           // e.g., "강남역 2호선"
    lat: number;            // 37.4979
    lng: number;            // 127.0276
  };
  destination: {
    name: string;           // e.g., "판교역 신분당선"
    lat: number;            // 37.3947
    lng: number;            // 127.1111
  };
  departureTime: string;    // ISO 8601 e.g., "2026-09-11T12:30:00+09:00"
  transportMode: TransportMode;
  naturalQuery: string;     // e.g., "차 덜 막히고 혼밥하기 편한 담백한 돈까스나 일식. 1시간 안에 복귀"
  
  // 사용자 정의 가중치 및 제약조건
  constraints: {
    maxDetourMinutes: number;       // 기본값 15 (최대 허용 우회 시간)
    maxMealBudgetMinutes: number;   // 식사에 사용할 총 여유시간 (기본 45)
    requireParking: boolean;        // 주차 필수 여부 (자동차 모드일 때 자동 활성화)
    preferSoloDining: boolean;      // 혼밥 선호 여부
  };
  
  // 파레토 가중치 슬라이더 (0.0 ~ 1.0, 합계 1.0)
  weights: {
    wSemantic: number;  // 0.35 (사용자 취향 일치도)
    wQuality: number;   // 0.25 (평점 및 찐맛집 랭킹)
    wDetour: number;    // 0.25 (우회 시간 최소화)
    wFriction: number;  // 0.15 (대기/조리/주차 마찰 최소화)
  };
}
```

---

### 1.2 경로 및 이동 궤적 모델 (RouteTrajectorySchema)

```typescript
export interface TransferNode {
  nodeName: string;          // e.g., "양재역 (환승역)"
  lineName: string;          // "신분당선 -> 3호선"
  lat: number;
  lng: number;
  etaFromOriginMinutes: number; // 출발지로부터 이 노드까지 소요시간
}

export interface RouteTrajectorySchema {
  routeId: string;
  transportMode: TransportMode;
  baseDurationMinutes: number;  // 직행 시 순수 소요시간 (A -> B)
  baseDistanceMeters: number;   // 직행 시 순수 거리
  polyline: Array<[number, number]>; // [[lat, lng], ...]
  corridorBounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  transferNodes?: TransferNode[]; // 대중교통 모드일 때만 포함
}
```

---

### 1.3 식당 후보 및 운영 시간 모델 (RestaurantCandidateSchema)

```typescript
export interface OperatingHours {
  dayOfWeek: number;            // 0: 일요일 ~ 6: 토요일
  isClosed: boolean;
  openTime?: string;            // "11:00"
  closeTime?: string;           // "21:30"
  breakStartTime?: string;      // "15:00"
  breakEndTime?: string;        // "17:00"
  lastOrderTime?: string;       // "14:30" (점심 라스트오더)
  dinnerLastOrderTime?: string; // "20:45" (저녁 라스트오더)
}

export interface RestaurantCandidate {
  placeId: string;
  name: string;
  category: string;             // "일식 > 돈까스,우동"
  address: string;
  lat: number;
  lng: number;
  rating: number;               // 4.6
  reviewCount: number;
  operatingHours: OperatingHours;
  sourceUrl: string;            // 카카오맵 / 네이버 플레이스 링크
}
```

---

### 1.4 시공간 타임라인 검증 결과 (TemporalValidationResult)

```typescript
export type SafetyStatus = "SAFE" | "TIGHT" | "REJECTED";

export interface TemporalValidationResult {
  placeId: string;
  etaArrivalTime: string;        // 식당 도착 예정 시각 "13:15:00"
  safetyStatus: SafetyStatus;    // 🟢 SAFE, 🟡 TIGHT, 🔴 REJECTED
  
  // 검증 세부 지표
  lastOrderRemainingMinutes: number; // 라스트오더까지 남은 시간 (e.g., +25분)
  breakTimeRemainingMinutes: number; // 브레이크타임까지 남은 시간 (e.g., +105분)
  guaranteedDiningMinutes: number;   // 보장되는 식사 시간
  
  failReason?: string;           // e.g., "도착 시각(14:35)이 점심 라스트오더(14:30) 이후임"
  badgeMessage: string;          // e.g., "13:15 도착 예정 (브레이크타임까지 1시간 45분 여유)"
}
```

---

### 1.5 비정형 리뷰 감성 마이닝 결과 (ReviewMiningResult)

```typescript
export interface ReviewMiningMetrics {
  placeId: string;
  cookingSpeedScore: number;     // 0.0 (30분 이상 슬로우푸드) ~ 1.0 (5분 컷 패스트)
  soloDiningFriendlyScore: number;// 0.0 (단체/회식 전용) ~ 1.0 (1인석/눈치 안 봄)
  parkingConvenienceScore: number;// 0.0 (주차 불가) ~ 1.0 (발렛/전용주차장 완비)
  noiseLevelScore: number;       // 0.0 (극도로 시끄러움) ~ 1.0 (조용하고 차분함)
  
  evidenceSnippets: string[];    // 실제 리뷰 발췌 근거
}
```

---

### 1.6 최종 추천 결과 모델 (FinalRecommendationSchema)

```typescript
export interface FinalRecommendationItem {
  rank: number;
  restaurant: RestaurantCandidate;
  temporalValidation: TemporalValidationResult;
  reviewMetrics: ReviewMiningMetrics;
  
  // 우회 시간 메트릭
  detourMinutes: number;          // +7분 (직행 30분 -> 식당 경유 시 37분)
  totalJourneyMinutes: number;    // 이동(37분) + 추천 식사(35분) = 72분
  
  // 최종 점수 및 AI 브리핑
  finalScore: number;             // 0 ~ 100
  aiBriefingReason: string;       // "신분당선 양재역 3번 출구 도보 2분 거리. 주문 후 5분 내 서빙되며, 브레이크타임 전 50분의 여유로운 식사가 가능합니다."
}

export interface FinalRecommendationResponse {
  requestId: string;
  transportMode: TransportMode;
  baseDurationMinutes: number;
  recommendations: FinalRecommendationItem[]; // Top 3 ~ 5개
}
```

---

## 🤖 2. Amazon Bedrock AgentCore 및 Action Groups 명세

### 2.1 Bedrock AgentCore System Instructions (Claude 3.7 Sonnet [Hybrid Reasoning] / Amazon Nova Pro)
```text
You are the Cognitive Core Agent of "WayBite", an intelligent spatio-temporal route-optimized dining platform.
Your objective is to help travelers, drivers, transit commuters, pedestrians, and cyclists find the optimal restaurant along their exact movement trajectory without unnecessary detours, while strictly honoring temporal constraints (ETA vs. last orders and break times).

Operating Principles:
1. Orchestrate your Action Groups sequentially:
   - Step A: Invoke 'parse_intent' to extract structured origin, destination, departure time, and food criteria.
   - Step B: Invoke 'plan_corridor' to query mobility APIs and build a bounding corridor along the route.
   - Step C: Invoke 'verify_temporal_safety' to evaluate ETA against restaurant operating hours, last-orders, and break times.
   - Step D: Query 'Bedrock Knowledge Base' for review-mined sentiment (cooking speed, solo-friendliness, parking).
   - Step E: Invoke 'rank_pareto' to compute the final multi-objective ranking.
2. Under no circumstances should you recommend a restaurant where ETA + 5 minutes > last_order_time or where dining overlaps with break times.
3. Provide crisp, structured explanations with clear time-saving metrics.
```

### 2.2 Bedrock Action Groups OpenAPI Schema 요약 (`bedrock_action_groups.yaml`)
```yaml
openapi: 3.0.0
info:
  title: WayBite Bedrock Action Groups API
  version: 1.0.0
paths:
  /corridor/plan:
    post:
      summary: 경로 생성 및 주변 POI 수집 (Lambda: corridor_planner)
      operationId: planCorridor
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RouteTrajectorySchema'
  /temporal/verify:
    post:
      summary: 도착 예정 시각 대비 브레이크타임/라스트오더 가드레일 (Lambda: temporal_verifier)
      operationId: verifyTemporalSafety
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RestaurantCandidate'
  /rank/pareto:
    post:
      summary: 다목적 파레토 최적화 랭킹 산출 (Lambda: pareto_ranker)
      operationId: rankPareto
```

---

## 🌐 3. 외부 API 호출 및 데이터 매핑 명세

### 3.1 카카오 모빌리티 자동차 경로 API (Kakao Directions)
* **엔드포인트:** `POST https://apis-navi.kakaomobility.com/v1/directions`
* **요청 파라미터:**
  * `origin`: `${lng},${lat}` (출발지)
  * `destination`: `${lng},${lat}` (목적지)
  * `waypoints`: `${lng},${lat}` (식당 후보 경유지 - 최대 5개)
  * `priority`: `RECOMMEND` (실시간 교통 반영 추천 경로)
* **응답 매핑:**
  * `routes[0].summary.duration`: 경유지 포함 총 소요시간 (초 단위)
  * $\Delta T_{\text{detour}} = \text{duration}_{\text{with\_waypoint}} - \text{duration}_{\text{base}}$

### 3.2 ODsay 대중교통 경로 탐색 API (ODsay Transit)
* **엔드포인트:** `GET https://api.odsay.com/v1/api/searchPubTransPathT`
* **요청 파라미터:**
  * `SX`, `SY`: 출발지 X(경도), Y(위도)
  * `EX`, `EY`: 도착지 X(경도), Y(위도)
  * `SearchPathType`: `0` (지하철+버스 전체)
* **응답 매핑:**
  * `result.path[0].subPath`: 이동 구간 목록
  * `subPath` 중 `trafficType == 1 (지하철)` 또는 `2 (버스)`의 환승역/정류장 명칭 및 좌표 수집 $\rightarrow$ **탐색 중심 노드로 지정**.

### 3.3 TMap 보행자 경로 API (TMap Pedestrian)
* **엔드포인트:** `POST https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1`
* **요청 바디:**
  * `startX`, `startY`: 환승역 출구 좌표
  * `endX`, `endY`: 식당 좌표
  * `reqCoordType`: `WGS84GEO`
* **응답 매핑:**
  * `features[0].properties.totalTime`: 횡단보도 대기 시간 및 인도 연결을 반영한 정밀 도보 소요시간 (초)

### 3.4 Google Places API (New) - 영업시간 및 리뷰 수집
* **엔드포인트:** `POST https://places.googleapis.com/v1/places:searchNearby`
* **FieldMask:**
  `places.displayName,places.currentOpeningHours,places.regularOpeningHours,places.rating,places.userRatingCount,places.reviews`
* **응답 매핑:**
  * `places.currentOpeningHours.openNow`: 현재 영업 상태
  * `places.regularOpeningHours.periods`: 요일별 오픈, 브레이크타임, 마감 시각 객체
  * `places.reviews.text.text`: 비정형 감성 마이닝용 원본 리뷰 텍스트 (최신 5개)
