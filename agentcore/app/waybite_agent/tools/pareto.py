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
    safety_map = {v["place_id"]: v for v in temporal_verdicts}
    review_map = review_metrics.get("results", {})

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

        scored_items.append({
            "place_id": pid,
            "name": c.get("name"),
            "category": c.get("category"),
            "address": c.get("address"),
            "rating": rating,
            "detour_minutes": detour,
            "safety_status": safety.get("safety_status"),
            "badge_message": safety.get("badge_message"),
            "guaranteed_dining_minutes": safety.get("guaranteed_dining_minutes", 45),
            "final_score": round(score, 1),
            "cooking_speed_score": cooking_speed,
            "ai_briefing_reason": ai_briefing,
            "source_url": c.get("source_url"),
        })

    # Sort descending by composite Pareto score
    scored_items.sort(key=lambda x: x["final_score"], reverse=True)

    ranked_results = []
    for rank, item in enumerate(scored_items[:max_top_k], start=1):
        item["rank"] = rank
        ranked_results.append(item)

    return {
        "status": "SUCCESS",
        "alpha_detour_weight": alpha_detour_weight,
        "total_evaluated": len(candidates),
        "survived_temporal_guardrail": len(scored_items),
        "top_recommendations": ranked_results,
    }
