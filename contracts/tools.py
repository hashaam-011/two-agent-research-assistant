"""Shared tool schemas — type contracts for the web_search MCP tool."""

from typing import TypedDict


class SearchResult(TypedDict):
    title: str
    url: str
    snippet: str


class WebSearchResponse(TypedDict):
    results: list[SearchResult]
