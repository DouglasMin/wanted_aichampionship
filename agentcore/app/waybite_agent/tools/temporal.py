"""Temporal safety guardrail tool to evaluate arrival ETA against operating hours."""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from strands import tool


def _parse_time(time_str: Optional[str]) -> Optional[datetime]:
    if not time_str:
        return None
    now = datetime.now()
    try:
        parts = [int(p) for p in time_str.split(":")]
        return now.replace(hour=parts[0], minute=parts[1], second=0, microsecond=0)
    except Exception:
        return None


@tool
def verify_temporal_safety(
    place_id: str,
    place_name: str,
    travel_time_from_origin_min: int,
    departure_time_str: Optional[str] = None,
    break_start_time_str: Optional[str] = "15:00",
    break_end_time_str: Optional[str] = "17:00",
    last_order_time_str: Optional[str] = "14:30",
    close_time_str: Optional[str] = "21:00",
    min_dining_duration_min: int = 30,
) -> Dict[str, Any]:
    """Verify temporal safety of visiting a restaurant given departure time, travel ETA, break times, and last order cutoffs."""
    print(f"\n🔥 [REAL PYTHON TOOL EXECUTED] verify_temporal_safety(place={place_name}, travel_time={travel_time_from_origin_min}m, dep={departure_time_str})")
    now = datetime.now()
    if departure_time_str:
        dep_time = _parse_time(departure_time_str) or now
    else:
        dep_time = now

    eta_time = dep_time + timedelta(minutes=travel_time_from_origin_min)
    eta_str = eta_time.strftime("%H:%M")

    break_start = _parse_time(break_start_time_str)
    break_end = _parse_time(break_end_time_str)
    last_order = _parse_time(last_order_time_str)
    close_time = _parse_time(close_time_str)

    # 1. Break time validation
    if break_start and break_end:
        if break_start <= eta_time < break_end:
            return {
                "place_id": place_id,
                "place_name": place_name,
                "eta_time": eta_str,
                "safety_status": "REJECTED",
                "fail_reason": f"도착 예정 시각({eta_str})이 브레이크타임({break_start_time_str}~{break_end_time_str}) 중입니다.",
                "badge_message": f"🔴 브레이크타임 충돌 (도착 {eta_str})",
                "guaranteed_dining_minutes": 0,
            }

        # If arriving before break time
        if eta_time < break_start:
            margin_before_break = int((break_start - eta_time).total_seconds() / 60)
            if margin_before_break < min_dining_duration_min:
                return {
                    "place_id": place_id,
                    "place_name": place_name,
                    "eta_time": eta_str,
                    "safety_status": "REJECTED",
                    "fail_reason": f"브레이크타임({break_start_time_str})까지 남은 시간({margin_before_break}분)이 최소 식사 시간({min_dining_duration_min}분)에 미달합니다.",
                    "badge_message": f"🔴 식사시간 부족 ({margin_before_break}분 여유)",
                    "guaranteed_dining_minutes": margin_before_break,
                }

    # 2. Last order validation
    if last_order:
        if eta_time > last_order:
            return {
                "place_id": place_id,
                "place_name": place_name,
                "eta_time": eta_str,
                "safety_status": "REJECTED",
                "fail_reason": f"도착 예정 시각({eta_str})이 점심 라스트오더({last_order_time_str})를 초과했습니다.",
                "badge_message": f"🔴 라스트오더 마감 (도착 {eta_str} > 마감 {last_order_time_str})",
                "guaranteed_dining_minutes": 0,
            }
        
        last_order_margin = int((last_order - eta_time).total_seconds() / 60)
        if last_order_margin < 10:
            return {
                "place_id": place_id,
                "place_name": place_name,
                "eta_time": eta_str,
                "safety_status": "TIGHT",
                "badge_message": f"🟡 아슬아슬 (마감 {last_order_margin}분 전 도착)",
                "guaranteed_dining_minutes": last_order_margin,
            }

    # 3. Safe
    break_margin = int((break_start - eta_time).total_seconds() / 60) if break_start else 60
    return {
        "place_id": place_id,
        "place_name": place_name,
        "eta_time": eta_str,
        "safety_status": "SAFE",
        "badge_message": f"🟢 {eta_str} 도착 예정 (브레이크타임 전 {break_margin}분 여유)",
        "guaranteed_dining_minutes": break_margin,
        "fail_reason": None,
    }
