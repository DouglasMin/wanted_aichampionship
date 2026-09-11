import os
import logging
logger = logging.getLogger(__name__)

# ExaAI provides information about code through web searches, crawling and code context searches through their platform. Requires no authentication
EXAMPLE_MCP_ENDPOINT = "https://mcp.exa.ai/mcp"

def get_streamable_http_mcp_client():
    """Returns None as WayBite uses native Strands tools."""
    return None
