"""
honeypot.py — Heuristic detection of "subtly impossible" profiles.

The hackathon doc tells us honeypots look fine on the surface but contain
internal contradictions (e.g. claimed skill duration longer than the candidate
has been working at all, or several "expert" skills with zero usage evidence).
We don't need to catch 100% of them — we need to keep honeypot-rate in the
top 100 under the 10% disqualification threshold, so a conservative heuristic
that flags clear contradictions is the right level of effort for this stage.

This is heuristic, not ground truth — the README is explicit that it's not
necessary to special-case honeypots if the ranker is "reading profiles", but
since impossible profiles by definition can't be assessed honestly, we exclude
flagged ones rather than let arithmetic noise rank them by accident.
"""

from typing import Dict, Any, List


def detect_honeypot_flags(candidate: Dict[str, Any]) -> List[str]:
    flags = []
    profile = candidate["profile"]
    years_exp = profile.get("years_of_experience", 0) or 0
    max_plausible_months = years_exp * 12 + 12  # generous slack for concurrent/overlapping use

    # 1. Skill duration exceeds total plausible career length.
    for skill in candidate.get("skills", []):
        duration = skill.get("duration_months", 0) or 0
        if duration > max_plausible_months:
            flags.append(f"skill_duration_exceeds_experience:{skill.get('name')}")

    # 2. Cluster of "expert" skills with zero supporting evidence.
    expert_no_evidence = [
        s for s in candidate.get("skills", [])
        if s.get("proficiency") == "expert"
        and (s.get("endorsements", 0) or 0) == 0
        and (s.get("duration_months", 0) or 0) <= 3
    ]
    if len(expert_no_evidence) >= 2:
        flags.append("multiple_unsupported_expert_skills")

    # 3. More than one concurrent "is_current" role (impossible timeline).
    current_roles = [r for r in candidate.get("career_history", []) if r.get("is_current")]
    if len(current_roles) > 1:
        flags.append("multiple_concurrent_current_roles")

    # 4. Sum of career_history duration_months wildly exceeds total experience.
    total_role_months = sum((r.get("duration_months", 0) or 0) for r in candidate.get("career_history", []))
    if total_role_months > max_plausible_months * 1.15:
        flags.append("career_history_duration_exceeds_experience")

    # 5. start_date/end_date span disagrees sharply with stated duration_months.
    for r in candidate.get("career_history", []):
        start = r.get("start_date")
        end = r.get("end_date")
        duration = r.get("duration_months", 0) or 0
        if start and end:
            try:
                sy, sm, _ = [int(x) for x in start.split("-")]
                ey, em, _ = [int(x) for x in end.split("-")]
                computed_months = (ey - sy) * 12 + (em - sm)
                if computed_months >= 0 and abs(computed_months - duration) > 6:
                    flags.append(f"date_duration_mismatch:{r.get('company')}")
            except Exception:
                pass

    return flags


def is_honeypot(candidate: Dict[str, Any], min_flags: int = 2) -> bool:
    return len(detect_honeypot_flags(candidate)) >= min_flags
