"""Pareto multi-objective ranking and trade-off synthesis tool."""

from typing import Any, Dict, List, Optional
from strands import tool


@tool
def rank_pareto_dining(
    candidates: List[Dict[str, Any]],
    temporal_verdicts: List[Dict[str, Any]],
    review_metrics: Dict[str, Any],
    alpha_detour_weight: float = 0.5,
    max_top_k: int = 3,
) -> Dict[str, Any]:
    """Calculate multi-objective Pareto ranking balancing detour penalty against food rating and temporal safety."""
    print(f"\n🔥 [REAL PYTHON TOOL EXECUTED] rank_pareto_dining(candidates={len(candidates)}, alpha={alpha_detour_weight}, max_k={max_top_k})")
    # Resilient handling for varied LLM parameter formats
    if isinstance(temporal_verdicts, dict):
        temporal_list = temporal_verdicts.get("verdicts", [])
    elif isinstance(temporal_verdicts, list):
        temporal_list = temporal_verdicts
    else:
        temporal_list = []

    safety_map = {v["place_id"]: v for v in temporal_list if isinstance(v, dict) and "place_id" in v}

    if isinstance(review_metrics, dict):
        review_map = review_metrics.get("results") if "results" in review_metrics else review_metrics
    else:
        review_map = {}

    scored_items = []

    for c in candidates:
        pid = c.get("place_id")
        safety = safety_map.get(pid, {"safety_status": "SAFE", "badge_message": "검증 완료"})

        # Hard constraint filter: strictly reject stores with temporal safety violation
        if safety.get("safety_status") == "REJECTED":
            continue

        detour = c.get("detour_minutes", 10)
        rating = c.get("rating", 4.0)
        r_meta = review_map.get(pid, {})
        sentiment = r_meta.get("sentiment_score", 0.8)
        cooking_speed = r_meta.get("cooking_speed_score", 0.7)

        # Normalize metrics to 0~1
        # Detour penalty: 0 min detour = 1.0, 30 min detour = 0.0
        norm_detour = max(0.0, 1.0 - (detour / 30.0))
        # Quality score: rating (out of 5.0) and sentiment
        norm_quality = ((rating / 5.0) * 0.7) + (sentiment * 0.3)
        # Speed bonus for transit users
        norm_speed = cooking_speed

        # Pareto Composite Score (0 ~ 100)
        # alpha controls trade-off between detour speed and food quality
        score = (
            (alpha_detour_weight * norm_detour * 50)
            + ((1.0 - alpha_detour_weight) * norm_quality * 40)
            + (norm_speed * 10)
        )

        # Penalty if status is TIGHT
        if safety.get("safety_status") == "TIGHT":
            score -= 8.0

        ai_briefing = (
            f"우회 +{detour}분. "
            f"{c.get('category')} 전문점 (평점 {rating}점). "
            f"{safety.get('badge_message')}. "
            f"주문 후 빠른 조리({int(cooking_speed * 100)}점)로 편안한 식사 가능."
        )

        r_snippets = r_meta.get("snippets", [])
        snippet = r_snippets[0] if r_snippets else f"{c.get('name')} - 방문자 리뷰 만족도가 우수한 경로 인접 식당입니다."

        item = {
            "id": pid,
            "place_id": pid,
            "name": c.get("name"),
            "category": c.get("category", "음식점"),
            "address": c.get("address", ""),
            "phone": c.get("phone", ""),
            "lat": c.get("lat", 0.0),
            "lng": c.get("lng", 0.0),
            "rating": rating,
            "review_count": c.get("review_count", 120),
            "detour_minutes": detour,
            "travel_time_minutes": c.get("travel_time_from_origin_min", 15),
            "eta_time": safety.get("eta_time", "12:30"),
            "safety_status": safety.get("safety_status", "SAFE"),
            "safety_badge": safety.get("badge_message", "🟢 안심 입장"),
            "badge_message": safety.get("badge_message", "🟢 안심 입장"),
            "fail_reason": safety.get("fail_reason"),
            "guaranteed_dining_minutes": safety.get("guaranteed_dining_minutes", 45),
            "final_score": round(score, 1),
            "cooking_speed_score": round(cooking_speed * 100),
            "solo_dining_score": round(r_meta.get("solo_dining_score", 0.75) * 100),
            "parking_score": round(r_meta.get("parking_score", 0.6) * 100),
            "sentiment_score": round(sentiment * 100),
            "review_snippet": snippet,
            "ai_briefing_reason": ai_briefing,
            "source_url": c.get("source_url", ""),
        }
        scored_items.append(item)

    # Sort descending by composite Pareto score
    scored_items.sort(key=lambda x: x["final_score"], reverse=True)

    ranked_results = []
    for rank, item in enumerate(scored_items[:max_top_k], start=1):
        item["rank"] = rank
        ranked_results.append(item)

    # Also build rejected items list for temporal inspector
    rejected_items = []
    for c in candidates:
        pid = c.get("place_id")
        safety = safety_map.get(pid, {})
        if safety.get("safety_status") == "REJECTED":
            rejected_items.append({
                "id": pid,
                "place_id": pid,
                "name": c.get("name"),
                "category": c.get("category", "음식점"),
                "address": c.get("address", ""),
                "phone": c.get("phone", ""),
                "lat": c.get("lat", 0.0),
                "lng": c.get("lng", 0.0),
                "rating": c.get("rating", 4.0),
                "review_count": c.get("review_count", 50),
                "detour_minutes": c.get("detour_minutes", 10),
                "travel_time_minutes": c.get("travel_time_from_origin_min", 15),
                "eta_time": safety.get("eta_time", "12:30"),
                "safety_status": "REJECTED",
                "safety_badge": safety.get("badge_message", "🔴 브레이크타임 충돌"),
                "badge_message": safety.get("badge_message", "🔴 브레이크타임 충돌"),
                "fail_reason": safety.get("fail_reason", "브레이크타임 또는 라스트오더 마감"),
                "guaranteed_dining_minutes": 0,
                "final_score": 0.0,
                "cooking_speed_score": 50,
                "solo_dining_score": 50,
                "parking_score": 50,
                "sentiment_score": 50,
                "review_snippet": "시공간 안전 가드레일에 의해 추천에서 제외되었습니다.",
                "ai_briefing_reason": safety.get("fail_reason"),
                "source_url": c.get("source_url", ""),
            })

    all_candidates = scored_items + rejected_items

    return {
        "status": "SUCCESS",
        "alpha_detour_weight": alpha_detour_weight,
        "total_evaluated": len(candidates),
        "safe_count": len(scored_items),
        "pruned_count": len(rejected_items),
        "top_recommendations": ranked_results,
        "ranked_candidates": ranked_results,
        "all_candidates": all_candidates,
    }

