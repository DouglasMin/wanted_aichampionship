"""Corridor route discretization and restaurant candidate retrieval tool."""

import os
from typing import Any, Dict, List, Optional
from strands import tool

DEMO_ROUTES = {
    "yangjae": {
        "route_name": "판교역 -> 강남역 (신분당선/대중교통)",
        "transport_mode": "TRANSIT",
        "base_duration_min": 24,
        "base_distance_m": 12500,
        "transfer_nodes": [
            {
                "node_name": "양재역 (환승역)",
                "line_name": "신분당선 -> 3호선",
                "lat": 37.4844,
                "lng": 127.0345,
                "eta_from_origin_min": 14,
            }
        ],
        "candidates": [
            {
                "place_id": "rest-yj-01",
                "name": "백소정 양재역점",
                "category": "일식 > 돈카츠/소바",
                "address": "서울 서초구 남부순환로 2584",
                "lat": 37.4847,
                "lng": 127.0341,
                "rating": 4.6,
                "review_count": 312,
                "detour_minutes": 5,
                "travel_time_from_origin_min": 16,
                "operating_hours": {
                    "day_of_week": 5,
                    "is_closed": False,
                    "open_time": "11:00",
                    "close_time": "21:00",
                    "break_start_time": "15:00",
                    "break_end_time": "17:00",
                    "last_order_time": "14:30",
                    "dinner_last_order_time": "20:30",
                },
                "source_url": "https://place.map.kakao.com/yj01",
            },
            {
                "place_id": "rest-yj-02",
                "name": "산동칼국수 양재본점",
                "category": "한식 > 칼국수/만두",
                "address": "서울 서초구 강남대로37길 32",
                "lat": 37.4855,
                "lng": 127.0332,
                "rating": 4.8,
                "review_count": 890,
                "detour_minutes": 7,
                "travel_time_from_origin_min": 18,
                "operating_hours": {
                    "day_of_week": 5,
                    "is_closed": False,
                    "open_time": "11:00",
                    "close_time": "21:30",
                    "break_start_time": "15:30",
                    "break_end_time": "17:00",
                    "last_order_time": "15:00",
                    "dinner_last_order_time": "21:00",
                },
                "source_url": "https://place.map.kakao.com/yj02",
            },
            {
                "place_id": "rest-yj-03",
                "name": "임병주산동손칼국수",
                "category": "한식 > 미쉐린 빕구르망 칼국수",
                "address": "서울 서초구 강남대로37길 63",
                "lat": 37.4862,
                "lng": 127.0315,
                "rating": 4.5,
                "review_count": 1420,
                "detour_minutes": 11,
                "travel_time_from_origin_min": 20,
                "operating_hours": {
                    "day_of_week": 5,
                    "is_closed": False,
                    "open_time": "11:00",
                    "close_time": "21:00",
                    "break_start_time": "15:00",
                    "break_end_time": "17:00",
                    "last_order_time": "14:30",
                    "dinner_last_order_time": "20:30",
                },
                "source_url": "https://place.map.kakao.com/yj03",
            },
        ],
    },
    "gangneung": {
        "route_name": "서울 -> 강릉 (영동고속도로/드라이브)",
        "transport_mode": "CAR",
        "base_duration_min": 150,
        "base_distance_m": 210000,
        "transfer_nodes": [],
        "candidates": [
            {
                "place_id": "rest-gn-01",
                "name": "평창 한우마을 면온점",
                "category": "한식 > 소고기구이",
                "address": "강원 평창군 봉평면 진조길 10-25",
                "lat": 37.5812,
                "lng": 128.3241,
                "rating": 4.7,
                "review_count": 520,
                "detour_minutes": 6,
                "travel_time_from_origin_min": 90,
                "operating_hours": {
                    "day_of_week": 5,
                    "is_closed": False,
                    "open_time": "11:00",
                    "close_time": "21:30",
                    "break_start_time": "15:00",
                    "break_end_time": "16:30",
                    "last_order_time": "14:30",
                    "dinner_last_order_time": "20:30",
                },
                "source_url": "https://place.map.kakao.com/gn01",
            },
            {
                "place_id": "rest-gn-02",
                "name": "횡성축협한우프라자 우천점",
                "category": "한식 > 한우구이",
                "address": "강원 횡성군 우천면 한우로 1422",
                "lat": 37.4421,
                "lng": 128.0673,
                "rating": 4.5,
                "review_count": 640,
                "detour_minutes": 4,
                "travel_time_from_origin_min": 70,
                "operating_hours": {
                    "day_of_week": 5,
                    "is_closed": False,
                    "open_time": "11:00",
                    "close_time": "21:00",
                    "break_start_time": "15:00",
                    "break_end_time": "17:00",
                    "last_order_time": "14:20",
                    "dinner_last_order_time": "20:00",
                },
                "source_url": "https://place.map.kakao.com/gn02",
            },
        ],
    },
}


@tool
def plan_corridor(
    origin: str,
    destination: str,
    transport_mode: str = "TRANSIT",
    detour_budget_min: int = 15,
    corridor_radius_m: int = 600,
) -> Dict[str, Any]:
    """Search for travel corridor route and retrieve initial restaurant candidates along the path.

    Args:
        origin: Departure location or coordinate (e.g., '판교역' or '서울역')
        destination: Destination location or coordinate (e.g., '강남역' or '강릉역')
        transport_mode: Mode of transportation ('CAR', 'TRANSIT', 'WALK', 'BICYCLE')
        detour_budget_min: Maximum acceptable detour time in minutes (default: 15)
        corridor_radius_m: Search buffer radius from trajectory in meters (default: 600)

    Returns:
        Dictionary containing route trajectory, base duration, and restaurant candidates along the corridor.
    """
    mode = transport_mode.upper()
    key = "yangjae"
    if "강릉" in destination or "평창" in destination or mode == "CAR":
        key = "gangneung"

    scenario = DEMO_ROUTES.get(key, DEMO_ROUTES["yangjae"])

    filtered_candidates = [
        c for c in scenario["candidates"]
        if c.get("detour_minutes", 0) <= detour_budget_min
    ]

    return {
        "status": "SUCCESS",
        "route_name": scenario["route_name"],
        "transport_mode": mode,
        "base_duration_min": scenario["base_duration_min"],
        "base_distance_m": scenario["base_distance_m"],
        "transfer_nodes": scenario["transfer_nodes"],
        "detour_budget_min": detour_budget_min,
        "corridor_radius_m": corridor_radius_m,
        "candidate_count": len(filtered_candidates),
        "candidates": filtered_candidates,
    }
