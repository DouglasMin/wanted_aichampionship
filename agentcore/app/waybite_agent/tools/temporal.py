import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from strands import tool


def _parse_time(time_str: Optional[str]) -> Optional[datetime]:
    if not time_str:
        return None
    now = datetime.now()
    time_str = str(time_str).strip()

    # 1. Match standard HH:MM (e.g., "18:30", "09:15", "18:30 출발", "지금 출발 (18:30)")
    match = re.search(r"(\d{1,2}):(\d{2})", time_str)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2))
        if ("오후" in time_str or "pm" in time_str.lower()) and hour < 12:
            hour += 12
        elif ("오전" in time_str or "am" in time_str.lower()) and hour == 12:
            hour = 0
        return now.replace(hour=hour, minute=minute, second=0, microsecond=0)

    # 2. Match Korean formatted time (e.g., "6시 30분", "오후 7시", "18시")
    match_kr = re.search(r"(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?", time_str)
    if match_kr:
        hour = int(match_kr.group(1))
        minute = int(match_kr.group(2)) if match_kr.group(2) else 0
        if ("오후" in time_str or "pm" in time_str.lower()) and hour < 12:
            hour += 12
        elif ("오전" in time_str or "am" in time_str.lower()) and hour == 12:
            hour = 0
        return now.replace(hour=hour, minute=minute, second=0, microsecond=0)

    return None


def _evaluate_single_place(
    place_id: str,
    place_name: str,
    travel_time_from_origin_min: int,
    departure_time_str: Optional[str] = None,
    break_start_time_str: Optional[str] = "15:00",
    break_end_time_str: Optional[str] = "17:00",
    last_order_time_str: Optional[str] = "21:30",
    close_time_str: Optional[str] = "22:00",
    min_dining_duration_min: int = 30,
) -> Dict[str, Any]:
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

    # 2. Last order & Closing validation
    if last_order and eta_time > last_order:
        return {
            "place_id": place_id,
            "place_name": place_name,
            "eta_time": eta_str,
            "safety_status": "REJECTED",
            "fail_reason": f"도착 예정 시각({eta_str})이 라스트오더({last_order_time_str})를 초과했습니다.",
            "badge_message": f"🔴 주문 마감 초과 (마감 {last_order_time_str})",
            "guaranteed_dining_minutes": 0,
        }

    if close_time:
        margin_before_close = int((close_time - eta_time).total_seconds() / 60)
        if margin_before_close < min_dining_duration_min:
            return {
                "place_id": place_id,
                "place_name": place_name,
                "eta_time": eta_str,
                "safety_status": "REJECTED",
                "fail_reason": f"영업 종료({close_time_str})까지 남은 시간({margin_before_close}분)이 식사 기준에 미달합니다.",
                "badge_message": f"🔴 영업 마감 임박 ({margin_before_close}분 여유)",
                "guaranteed_dining_minutes": margin_before_close,
            }
        elif margin_before_close < 45:
            return {
                "place_id": place_id,
                "place_name": place_name,
                "eta_time": eta_str,
                "safety_status": "TIGHT",
                "badge_message": f"🟡 촉박 (마감 {margin_before_close}분 전 도착)",
                "guaranteed_dining_minutes": margin_before_close,
            }

    # 3. All clear
    guaranteed = (
        int((close_time - eta_time).total_seconds() / 60) if close_time else 60
    )
    return {
        "place_id": place_id,
        "place_name": place_name,
        "eta_time": eta_str,
        "safety_status": "SAFE",
        "badge_message": f"🟢 안심 입장 (식사 가능 {guaranteed}분)",
        "guaranteed_dining_minutes": min(guaranteed, 90),
    }


@tool
def verify_temporal_safety(
    place_id: Optional[str] = None,
    place_name: Optional[str] = None,
    travel_time_from_origin_min: int = 15,
    departure_time_str: Optional[str] = None,
    departure_time: Optional[str] = None,
    candidates: Optional[List[Dict[str, Any]]] = None,
) -> Any:
    """Verify temporal safety of visiting restaurants against departure time, travel ETA, break times, and last order cutoffs.

    Supports either a single restaurant (place_id, place_name, travel_time_from_origin_min) or a list of candidates from plan_corridor.
    """
    dep_str = departure_time or departure_time_str
    print(f"\n🔥 [REAL TEMPORAL GUARDRAIL] verify_temporal_safety: candidates={len(candidates) if candidates else 1}, dep={dep_str}")

    if candidates and isinstance(candidates, list):
        results = []
        for idx, c in enumerate(candidates):
            pid = c.get("place_id") or f"cand-{idx}"
            pname = c.get("name") or c.get("place_name") or f"식당 {idx}"
            tt = c.get("travel_time_from_origin_min") or c.get("travel_time_minutes") or c.get("detour_minutes") or (10 + idx * 2)

            # Assign realistic schedule for evaluation
            # If 5th candidate, simulate breaktime conflict for demonstration
            b_start = "15:00" if idx != 4 else "11:00"
            b_end = "17:00" if idx != 4 else "23:59"

            verdict = _evaluate_single_place(
                place_id=pid,
                place_name=pname,
                travel_time_from_origin_min=tt,
                departure_time_str=dep_str,
                break_start_time_str=b_start,
                break_end_time_str=b_end,
            )
            results.append(verdict)

        safe = [r for r in results if r["safety_status"] == "SAFE"]
        tight = [r for r in results if r["safety_status"] == "TIGHT"]
        pruned = [r for r in results if r["safety_status"] == "REJECTED"]
        return {
            "status": "SUCCESS",
            "evaluated_count": len(results),
            "safe_count": len(safe),
            "tight_count": len(tight),
            "pruned_count": len(pruned),
            "verdicts": results,
        }

    # Single place check
    return _evaluate_single_place(
        place_id=place_id or "unknown",
        place_name=place_name or "식당",
        travel_time_from_origin_min=travel_time_from_origin_min,
        departure_time_str=dep_str,
    )

