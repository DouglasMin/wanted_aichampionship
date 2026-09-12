import json
from typing import Any
import os
from dotenv import load_dotenv

load_dotenv()

from strands import Agent, tool
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from model.load import load_model
from mcp_client.client import get_streamable_http_mcp_client
from memory.session import get_memory_session_manager

app = BedrockAgentCoreApp()
log = app.logger

# Define a Streamable HTTP MCP Client
mcp_clients = [get_streamable_http_mcp_client()]

from tools.corridor import plan_corridor
from tools.temporal import verify_temporal_safety
from tools.reviews import query_pinecone_reviews
from tools.pareto import rank_pareto_dining

DEFAULT_SYSTEM_PROMPT = """
당신은 국내 최초 시공간 경로 최적화 맛집 에이전트 **WayBite(웨이바이트)**입니다.
사용자의 출발지(origin), 도착지(destination), 이동 수단, 출발 시각, 그리고 원하는 식사 조건(예: 빠른 조리, 혼밥, 고기국수, 국밥 등)을 바탕으로 실제 이동 회랑 상의 최적 맛집을 추천합니다.

[핵심 도구 사용 파이프라인 (반드시 순서대로 도구를 실행하세요)]
1. `plan_corridor`: 출발지와 목적지 간의 실시간 카카오 경로 및 회랑 식당 후보군(candidates)을 조회합니다. 사용자가 특정 음식(예: 고기국수, 국밥, 흑돼지 등)을 원하면 `food_query`에 지정하세요.
2. `verify_temporal_safety`: 후보 식당 리스트(candidates)와 출발 시각(departure_time)을 전달하여, 도착 예정 시각(ETA) 기준 브레이크타임이나 라스트오더에 충돌하는 식당을 탈락(REJECTED)시키고 안전한 식당(SAFE)과 촉박한 식당(TIGHT)을 분류합니다.
3. `query_pinecone_reviews`: Pinecone Serverless 벡터 DB에서 후보 식당들의 비정형 리뷰를 Titan 임베딩 기반으로 시맨틱 마이닝하여 조리 속도(cooking_speed), 혼밥 편의성(solo_dining), 감성 점수(sentiment)를 추출합니다.
4. `rank_pareto_dining`: 후보 식당, 시간 안전 검증 결과, Pinecone 리뷰 메트릭을 결합하여 다변수 파레토 가중치(alpha) 기반 최적 Top 추천 식당을 선정합니다.

[답변 브리핑 가이드라인]
- 전문적이고 신뢰감 넘치는 한국어로 브리핑하세요.
- 총 이동 거리와 소요 시간, 발견된 후보 식당 수와 시공간 안전 가드레일 통과 현황을 명확히 요약하세요.
- 추천 식당별로 우회 시간(+N분), 도착 예정 시각 및 안전 마진(🟢 안심 입장 등), 대표 메뉴 및 Pinecone 리뷰 분석 결과(빠른 조리 점수 등)를 친절히 설명하세요.
- 브레이크타임 충돌로 탈락된 식당이 있다면 해당 식당 이름과 탈락 사유(예: 도착 예정 시각이 브레이크타임과 겹침)를 명시하여 시공간 안전 가드레일이 엄격하게 작동했음을 보여주세요.

[대화형 질의 및 실시간 리스트 갱신 가이드라인]
- 사용자가 추가 대화(예: "영업 시간 늦은 곳 찾아줘", "가장 빠른 곳", "새로운 메뉴 추천해줘", "특정 음식 제외해줘" 등)를 요청할 때:
  - 새로운 메뉴나 조건이 추가되면 `plan_corridor`에 새로운 `food_query`를 주어 새 후보를 탐색하거나,
  - `verify_temporal_safety`와 `rank_pareto_dining`을 실행하여 조건에 맞게 식당 리스트를 재평가/재정렬하세요.
  - 도구를 호출하면 프론트엔드 중앙의 식당 카드 리스트가 실시간으로 자동 소거/추가/재배열됩니다.
"""


# Define a collection of tools used by the model
tools = [
    plan_corridor,
    verify_temporal_safety,
    query_pinecone_reviews,
    rank_pareto_dining,
]


import uuid
from strands.types.agent import ConcurrentInvocationMode

# In-memory agent storage by session_id to maintain multi-turn memory
_agent_sessions: dict[str, Agent] = {}


def get_or_create_agent(session_id: str, user_id: str) -> Agent:
    if session_id in _agent_sessions:
        return _agent_sessions[session_id]

    agent = Agent(
        model=load_model(),
        session_manager=get_memory_session_manager(session_id, user_id),
        system_prompt=DEFAULT_SYSTEM_PROMPT,
        tools=tools,
        concurrent_invocation_mode=ConcurrentInvocationMode.UNSAFE_REENTRANT,
    )
    _agent_sessions[session_id] = agent
    return agent


@app.entrypoint
async def invoke(payload, context):
    log.info("Invoking WayBite Agent.....")

    session_id = payload.get("session_id") or getattr(context, 'session_id', None) or uuid.uuid4().hex
    user_id = payload.get("user_id") or getattr(context, 'user_id', None) or "default-user"

    agent = get_or_create_agent(session_id, user_id)

    prompt = payload.get("prompt", "")
    log.info(f"Prompt: {prompt}")

    # Execute and stream response
    stream = agent.stream_async(prompt)

    seen_tools = set()

    async for event in stream:
        # 1. Tool execution notifications
        if "current_tool_use" in event:
            tool_info = event["current_tool_use"]
            t_name = tool_info.get("name")
            if t_name and t_name not in seen_tools:
                seen_tools.add(t_name)
                yield {
                    "type": "tool_start",
                    "tool": t_name,
                }

        # 2. Extract structured data from tool results (corridor route and Pareto recommendations)
        if "message" in event:
            content = event["message"].get("content", [])
            for item in content:
                if isinstance(item, dict) and "toolResult" in item:
                    tr = item["toolResult"]
                    for piece in tr.get("content", []):
                        if isinstance(piece, dict) and "text" in piece:
                            try:
                                parsed = json.loads(piece["text"])
                                if isinstance(parsed, dict) and parsed.get("status") == "SUCCESS":
                                    if "top_recommendations" in parsed:
                                        yield {
                                            "type": "recommendations",
                                            "payload": parsed,
                                        }
                                    elif "route_coordinates" in parsed:
                                        yield {
                                            "type": "corridor",
                                            "payload": parsed,
                                        }
                            except Exception:
                                pass

        # 3. Stream text reasoning chunks
        if "data" in event and isinstance(event["data"], str):
            yield {
                "type": "text",
                "content": event["data"],
            }

    yield {"type": "done"}


if __name__ == "__main__":
    app.run()

