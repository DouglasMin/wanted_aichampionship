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
사용자의 출발지, 도착지, 이동 수단(대중교통, 자가용, 도보, 자전거), 출발 시각, 식사 선호도를 파악하여 경로 상의 최적 맛집을 추천합니다.

[핵심 행동 원칙]
1. 단순 거리 기준 검색이 아닌, **실제 이동 경로 및 환승 허브(양재역 등) 회랑**을 기반으로 탐색합니다.
2. **시공간 안전 가드레일(Temporal Safety Guardrail)**을 반드시 적용합니다:
   - 식당 도착 예정 시각(T_ETA)을 계산하고, 브레이크타임(Break Time)이나 라스트오더(Last Order)에 걸리지 않는 안전한 식당만 추천합니다.
   - 브레이크타임 충돌 식당은 가차없이 탈락시키고 그 이유를 명시합니다.
3. **Pinecone Serverless 리뷰 시맨틱 마이닝**을 통해 조리 속도(5분 컷), 혼밥 난이도, 주차 편의성을 평가합니다.
4. **파레토 다변수 최적화(Pareto Ranking)**를 통해 우회 시간과 맛집 퀄리티 간의 최적 균형점(Top 3)을 제안합니다.
5. 추천 결과는 깔끔한 한국어 브리핑, 우회 시간(+N분), 도착 시각 및 안전 마진 뱃지(🟢 안전 / 🟡 촉박)를 포함하여 친절하게 설명하세요.

[도구 사용 파이프라인]
1. `plan_corridor`: 경로 탐색 및 회랑 내 식당 후보군 추출
2. `verify_temporal_safety`: 후보별 도착 시각 계산 및 브레이크타임/라스트오더 시간표 검증
3. `query_pinecone_reviews`: Pinecone 벡터 검색으로 비정형 리뷰 감성 및 조리속도 마이닝
4. `rank_pareto_dining`: 파레토 최적화 점수 계산 및 최종 Top-3 도출
"""

# Define a collection of tools used by the model
tools = [
    plan_corridor,
    verify_temporal_safety,
    query_pinecone_reviews,
    rank_pareto_dining,
]


def agent_factory():
    cache = {}
    def get_or_create_agent(session_id, user_id):
        key = f"{session_id}/{user_id}"
        if key not in cache:
            # Create an agent for the given session_id and user_id
            cache[key] = Agent(
                model=load_model(),
                session_manager=get_memory_session_manager(session_id, user_id),
                system_prompt=DEFAULT_SYSTEM_PROMPT,
                tools=tools
            )
        return cache[key]
    return get_or_create_agent
get_or_create_agent = agent_factory()


@app.entrypoint
async def invoke(payload, context):
    log.info("Invoking Agent.....")

    session_id = getattr(context, 'session_id', 'default-session')
    user_id = getattr(context, 'user_id', 'default-user')
    agent = get_or_create_agent(session_id, user_id)

    # Execute and format response
    stream = agent.stream_async(payload.get("prompt"))

    async for event in stream:
        # Handle Text parts of the response
        if "data" in event and isinstance(event["data"], str):
            yield event["data"]


if __name__ == "__main__":
    app.run()
