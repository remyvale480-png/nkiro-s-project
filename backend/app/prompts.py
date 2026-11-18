"""Exact LLM system prompt and JSON schema for Piko Math (FastAPI + Gemini)."""

from typing import Literal
from pydantic import BaseModel, Field

CURRICULUM_LABELS = {
    "US_COMMON_CORE": "US Common Core",
    "UK_GCSE_ALEVEL": "UK GCSE / A-Level",
    "IB": "International Baccalaureate (IB)",
    "INDIA_CBSE": "India CBSE / NCERT",
    "KENYA_KCSE": "Kenya KCSE / CBC",
    "NIGERIA_WAEC": "Nigeria WAEC",
}


class StepItem(BaseModel):
    step_number: int = Field(..., ge=1)
    expression_latex: str
    expression_plain: str
    why: str = Field(..., description="1-2 short, friendly sentences in Piko's voice.")


class HintLadder(BaseModel):
    nudge: str
    bigger_hint: str
    next_step: str


class SolveLLMOutput(BaseModel):
    normalized_problem: str
    problem_latex: str
    topic: str
    difficulty: Literal["easy", "medium", "hard"]
    curriculum_tags: list[str]
    piko_greeting: str
    steps: list[StepItem]
    final_answer_latex: str
    final_answer_plain: str
    hints: HintLadder
    confidence: float = Field(..., ge=0.0, le=1.0)


def build_piko_system_prompt(
    curriculum: str,
    grade_level: str,
    notation: str,
    language_code: str = "en",
) -> str:
    curriculum_name = CURRICULUM_LABELS.get(curriculum, "General Mathematics")
    decimal_rule = (
        "Use decimal commas (e.g. 3,5) in prose and '/' for division."
        if notation == "comma_slash"
        else "Use decimal points (e.g. 3.5) and standard division notation."
    )
    return (
        "You are Piko, a friendly, encouraging AI math tutor shaped like the pi symbol (π).\n"
        "Voice rules:\n"
        "- Speak directly to students aged 11-18 in short, simple sentences that translate cleanly.\n"
        "- Be warm, clear, and encouraging—never childish or condescending.\n"
        "- Explain WHY each step works so the student learns the method.\n"
        f"Curriculum: {curriculum_name} | Grade: {grade_level} | Language: {language_code}.\n"
        f"Notation: {decimal_rule}\n"
        "Accuracy rules:\n"
        "- Put valid KaTeX/LaTeX in expression_latex and final_answer_latex.\n"
        "- Put clean ASCII math in final_answer_plain (e.g. 'x = 6', '19/12') for SymPy verification.\n"
        "- Lower confidence below 0.75 if the input is ambiguous or incomplete."
    )
