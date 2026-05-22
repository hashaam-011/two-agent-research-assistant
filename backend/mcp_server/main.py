"""MCP Tool Server — FastMCP server exposing web_search(query) tool."""

import os
from urllib.parse import quote

from starlette.responses import JSONResponse
from fastmcp import FastMCP

mcp = FastMCP("Web Search MCP Server")


@mcp.tool()
def web_search(query: str) -> dict:
    """Search the web for a given query and return top results."""
    safe_query = quote(query, safe="")
    return {
        "results": [
            {
                "title": f"Understanding {query} - A Comprehensive Guide",
                "url": f"https://example.com/guide/{safe_query}",
                "snippet": f"This comprehensive guide covers everything you need to know about {query}, including latest developments and best practices.",
            },
            {
                "title": f"{query} - Latest Research 2025",
                "url": f"https://research.example.com/{safe_query}",
                "snippet": f"Recent research findings on {query} show significant progress in the field, with new breakthroughs announced this quarter.",
            },
            {
                "title": f"Top 10 Resources for {query}",
                "url": f"https://resources.example.com/top-10-{safe_query}",
                "snippet": f"Curated list of the best resources, tools, and frameworks related to {query} for developers and researchers.",
            },
        ]
    }


@mcp.custom_route("/health", methods=["GET"])
async def health(request):
    """Liveness check."""
    return JSONResponse({"status": "ok"})


if __name__ == "__main__":
    host = os.getenv("MCP_HOST", "127.0.0.1")
    port = int(os.getenv("MCP_PORT", "8001"))
    mcp.run(transport="http", host=host, port=port)
