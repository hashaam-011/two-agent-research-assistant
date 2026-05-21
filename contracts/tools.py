"""Shared tool schemas — both agents import these shapes."""

from typing import TypedDict


class SearchResult(TypedDict):
    title: str
    url: str
    snippet: str


class WebSearchResponse(TypedDict):
    results: list[SearchResult]


def web_search(query: str) -> WebSearchResponse:
    """
    MCP tool: web_search

    Args:
        query: The search query string

    Returns:
        {
            "results": [
                {
                    "title": str,
                    "url": str,
                    "snippet": str
                }
            ]
        }
    """
    raise NotImplementedError("This is a contract stub — import and call the real MCP tool instead.")
