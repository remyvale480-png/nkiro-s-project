"""SymPy symbolic verification engine for Piko Math."""

from __future__ import annotations
import re
from dataclasses import dataclass
from sympy import Eq, Symbol, simplify, sympify
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)


@dataclass
class VerificationOutcome:
    status: str  # "verified" | "unverified" | "mismatch"
    message: str


def normalize_ascii_math(raw: str) -> str:
    s = raw.strip()
    s = (
        s.replace("×", "*")
        .replace("·", "*")
        .replace("÷", "/")
        .replace("−", "-")
        .replace("²", "**2")
        .replace("³", "**3")
        .replace("^", "**")
        .replace("π", "pi")
    )
    s = re.sub(r"(\d),(\d)", r"\1.\2", s)
    return re.sub(r"\s+", " ", s).strip()


def verify_with_sympy(
    normalized_problem: str,
    final_answer_plain: str,
    confidence: float,
) -> VerificationOutcome:
    if confidence < 0.75:
        return VerificationOutcome(
            status="unverified",
            message="Piko has lower confidence on this reading. Please check each step carefully.",
        )

    prob = normalize_ascii_math(normalized_problem)
    ans = normalize_ascii_math(final_answer_plain)
    if not prob or not ans:
        return VerificationOutcome(
            status="unverified",
            message="Expression could not be parsed for symbolic verification.",
        )

    try:
        # Equation verification by root substitution
        if "=" in prob and prob.count("=") == 1:
            lhs_str, rhs_str = [p.strip() for p in prob.split("=")]
            lhs = parse_expr(lhs_str, transformations=TRANSFORMATIONS)
            rhs = parse_expr(rhs_str, transformations=TRANSFORMATIONS)
            free_vars = list((lhs - rhs).free_symbols)

            if len(free_vars) == 1:
                var = free_vars[0]
                candidates = [c.strip() for c in re.split(r",|\bor\b|\band\b|;", ans) if c.strip()]
                checked = False
                for cand in candidates:
                    val_str = cand.split("=")[-1].strip() if "=" in cand else cand
                    val_expr = parse_expr(val_str, transformations=TRANSFORMATIONS)
                    residual = simplify((lhs - rhs).subs(var, val_expr))
                    checked = True
                    if residual != 0:
                        return VerificationOutcome(
                            status="mismatch",
                            message="SymPy substitution check disagreed with the proposed solution.",
                        )
                if checked:
                    return VerificationOutcome(
                        status="verified",
                        message="Verified symbolically with SymPy root substitution.",
                    )

        # Direct expression equivalence check (simplify(prob - ans) == 0)
        if "=" not in prob:
            ans_clean = ans.split("=")[-1].strip() if "=" in ans else ans
            prob_expr = parse_expr(prob, transformations=TRANSFORMATIONS)
            ans_expr = parse_expr(ans_clean, transformations=TRANSFORMATIONS)
            if simplify(prob_expr - ans_expr) == 0:
                return VerificationOutcome(
                    status="verified",
                    message="Verified symbolically with SymPy equivalence check.",
                )
            return VerificationOutcome(
                status="mismatch",
                message="SymPy equivalence check disagreed with the final answer.",
            )

        return VerificationOutcome(
            status="unverified",
            message="Multi-variable or word-problem form; please review the reasoning steps.",
        )
    except Exception:
        return VerificationOutcome(
            status="unverified",
            message="SymPy could not auto-verify this expression format.",
        )
