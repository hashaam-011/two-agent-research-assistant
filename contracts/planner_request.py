"""Planner Agent request/response contract — POST /agent endpoint."""

from typing import Literal, TypedDict


class PlannerMessage(TypedDict):
    role: Literal["user", "assistant"]
    content: str


class PlannerRequest(TypedDict):
    thread_id: str
    messages: list[PlannerMessage]
