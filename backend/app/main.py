"""Production FastAPI service for Piko Math."""

import os
from datetime import date
from fastapi import FastAPI, Header, HTTPException, Request
from google import genai
from google.genai import types
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from .prompts import SolveLLMOutput, build_piko_system_prompt
from .verifier import normalize_ascii_math, verify_with_sympy

DAILY_FREE_QUOTA = 5
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Piko Math API", version="1.0.0")

_solution_cache: dict[str, dict] = {}
_daily_quota: dict[str, tuple[str, int]] = {}
_review_queue: list[dict] = []


class SolveRequest(BaseModel):
    problem: str
    curriculum: str = "US_COMMON_CORE"
    grade_level: str = "Grade 8"
    notation: str = "point_obelus"
    language: str = "en"


def choose_model(problem: str) -> str:
    complex_markers = ("\\int", "\\sum", "sin", "cos", "tan", "derivative", "integral", "prove")
    if len(problem) > 42 or any(m in problem.lower() for m in complex_markers):
        return "gemini-4-hydrogen"
    return "gemini-3.1-flash-lite"


@app.post("/api/solve")
@limiter.limit("30/minute")
async def solve_problem(
    request: Request,
    payload: SolveRequest,
    x_piko_client_id: str | None = Header(default=None),
):
    client_key = x_piko_client_id or get_remote_address(request)
    cache_key = f"{payload.curriculum}::{payload.notation}::{normalize_ascii_math(payload.problem).lower()}"
    if cache_key in _solution_cache:
        return {**_solution_cache[cache_key], "cached": True}

    today = date.today().isoformat()
    q_date, used = _daily_quota.get(client_key, (today, 0))
    if q_date != today:
        used = 0
    if used >= DAILY_FREE_QUOTA:
        raise HTTPException(status_code=429, detail="Daily free solve quota reached.")

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured.")

    ai = genai.Client(api_key=api_key)
    model_name = choose_model(payload.problem)
    sys_prompt = build_piko_system_prompt(
        payload.curriculum, payload.grade_level, payload.notation, payload.language
    )

    resp = ai.models.generate_content(
        model=model_name,
        contents=f"Solve this math problem step by step:\n{payload.problem}",
        config=types.GenerateContentConfig(
            system_instruction=sys_prompt,
            response_mime_type="application/json",
            response_schema=SolveLLMOutput,
        ),
    )
    parsed = SolveLLMOutput.model_validate_json(resp.text)
    outcome = verify_with_sympy(
        parsed.normalized_problem, parsed.final_answer_plain, parsed.confidence
    )

    _daily_quota[client_key] = (today, used + 1)
    result = {
        **parsed.model_dump(),
        "verification_status": outcome.status,
        "verification_message": outcome.message,
        "model_used": model_name,
        "cached": False,
        "remaining_quota": max(0, DAILY_FREE_QUOTA - (used + 1)),
    }
    if outcome.status == "verified":
        _solution_cache[cache_key] = result
    return result
