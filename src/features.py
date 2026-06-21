"""
features.py — Turns a raw candidate record into structured, scoreable signals.

Nothing here calls an LLM and nothing here needs the network — it's all
deterministic feature engineering so it's fast (100K candidates in seconds)
and fully reproducible inside the hackathon's compute sandbox.
"""

import math
import re
from datetime import date
from typing import Dict, Any, List, Tuple

from . import config


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def classify_title(title: str) -> str:
    t = _norm(title)
    for category, keywords in config.TITLE_CATEGORY_KEYWORDS.items():
        if any(kw in t for kw in keywords):
            return category
    if any(m in t for m in config.NON_TECHNICAL_TITLE_MARKERS):
        return "non_technical"
    return "other_technical"


def title_fit_score(candidate: Dict[str, Any]) -> Tuple[float, str]:
    """How well does the *current* title match what this JD is actually for."""
    title = candidate["profile"]["current_title"]
    category = classify_title(title)
    score_map = {
        "ml_ai_eng": 1.0,
        "data_eng": 0.55,
        "swe_backend": 0.45,
        "swe_frontend": 0.20,
        "architecture_only": 0.35,
        "other_technical": 0.30,
        "non_technical": 0.05,
    }
    return score_map.get(category, 0.25), category


def _skill_trust_weight(skill: Dict[str, Any]) -> float:
    """
    Down-weights skills that look keyword-stuffed (claimed but never really used):
    a skill with high proficiency, long duration, and real endorsements counts far
    more than the same skill name with 0 endorsements and a couple months of use.
    """
    prof_weight = {"beginner": 0.35, "intermediate": 0.6, "advanced": 0.85, "expert": 1.0}.get(
        skill.get("proficiency", "beginner"), 0.35
    )
    duration = skill.get("duration_months", 0) or 0
    duration_factor = min(1.0, duration / 24.0)  # saturates at 2 years
    endorsements = skill.get("endorsements", 0) or 0
    endorsement_factor = min(1.0, math.log1p(endorsements) / math.log1p(20))
    # A skill needs *some* duration or endorsement evidence to be trusted; a skill
    # with both at zero is treated as a bare keyword, not a real capability.
    evidence_factor = max(duration_factor, endorsement_factor)
    return prof_weight * (0.35 + 0.65 * evidence_factor)


def skill_group_coverage(skills: List[Dict[str, Any]], groups: Dict[str, set], return_spans: bool = False):
    """For each skill group, return the best (trust-weighted) match found, 0 if none.
    If return_spans is True, returns (coverage_dict, list_of_matched_skill_names)."""
    by_name = {}
    for s in skills:
        name = s.get("name", "")
        by_name.setdefault(name, []).append(s)

    result = {}
    matched_skills = []
    for group_name, members in groups.items():
        best = 0.0
        best_skill_name = None
        for member in members:
            for s in by_name.get(member, []):
                score = _skill_trust_weight(s)
                if score > best:
                    best = score
                    best_skill_name = s.get("name")
        result[group_name] = best
        if best_skill_name:
            matched_skills.append((group_name, best_skill_name, best))
            
    if return_spans:
        return result, matched_skills
    return result


def must_have_skill_fit(skills: List[Dict[str, Any]]) -> Tuple[float, Dict[str, float]]:
    coverage = skill_group_coverage(skills, config.MUST_HAVE_SKILL_GROUPS)
    score = sum(coverage.values()) / max(1, len(coverage))
    return score, coverage


def nice_to_have_skill_fit(skills: List[Dict[str, Any]]) -> Tuple[float, Dict[str, float]]:
    coverage = skill_group_coverage(skills, config.NICE_TO_HAVE_SKILL_GROUPS)
    # Nice-to-haves are additive bonuses, not all-or-nothing: average of top 3 groups hit.
    top = sorted(coverage.values(), reverse=True)[:3]
    score = sum(top) / 3 if top else 0.0
    return score, coverage


def _career_text(candidate: Dict[str, Any]) -> str:
    parts = [candidate["profile"].get("summary", ""), candidate["profile"].get("headline", "")]
    for role in candidate.get("career_history", []):
        parts.append(role.get("title", ""))
        parts.append(role.get("description", ""))
    return " \n ".join(parts).lower()


def eval_framework_fit(candidate: Dict[str, Any], return_spans: bool = False, text: str = None):
    if not return_spans:
        if text is None:
            text = _career_text(candidate)
        hits = sum(1 for phrase in config.EVAL_FRAMEWORK_PHRASES if phrase in text)
        return min(1.0, hits / 3.0)
        
    spans = []
    hits = 0
    career_history = candidate.get("career_history", [])
    for i, role in enumerate(career_history):
        role_text = (role.get("title", "") + " \n " + role.get("description", "")).lower()
        for phrase in config.EVAL_FRAMEWORK_PHRASES:
            for match in re.finditer(re.escape(phrase), role_text):
                hits += 1
                spans.append({
                    "career_history_index": i,
                    "start": match.start(),
                    "end": match.end(),
                    "label": "eval_framework_phrase",
                    "matched_text": phrase,
                    "contributes_to": "eval_framework_fit",
                    "delta_estimate": round(1.0 / 3.0, 3)
                })
    score = min(1.0, hits / 3.0)
    return score, spans


def production_retrieval_phrase_score(candidate: Dict[str, Any], return_spans: bool = False, text: str = None):
    """
    Catches the JD's explicit "plain-language Tier 5" case: a candidate whose
    career history clearly describes building retrieval/ranking/recommendation
    systems even if their skills list doesn't use the fashionable nouns.
    """
    if not return_spans:
        if text is None:
            text = _career_text(candidate)
        hits = sum(1 for phrase in config.PRODUCTION_RETRIEVAL_PHRASES if phrase in text)
        return min(1.0, hits / 5.0)

    spans = []
    hits = 0
    career_history = candidate.get("career_history", [])
    for i, role in enumerate(career_history):
        role_text = (role.get("title", "") + " \n " + role.get("description", "")).lower()
        for phrase in config.PRODUCTION_RETRIEVAL_PHRASES:
            for match in re.finditer(re.escape(phrase), role_text):
                hits += 1
                spans.append({
                    "career_history_index": i,
                    "start": match.start(),
                    "end": match.end(),
                    "label": "production_retrieval_phrase",
                    "matched_text": phrase,
                    "contributes_to": "semantic_career_fit",
                    "delta_estimate": round(1.0 / 5.0, 3)
                })
    score = min(1.0, hits / 5.0)
    return score, spans


def experience_years_fit(years: float) -> float:
    if config.EXPERIENCE_SWEET_SPOT_MIN <= years <= config.EXPERIENCE_SWEET_SPOT_MAX:
        return 1.0
    if config.EXPERIENCE_IDEAL_MIN <= years <= config.EXPERIENCE_IDEAL_MAX:
        return 0.85
    # Soft decay outside the band rather than a hard cutoff (JD explicitly says
    # it will "seriously consider candidates outside the band if other signals
    # are strong").
    if years < config.EXPERIENCE_IDEAL_MIN:
        gap = config.EXPERIENCE_IDEAL_MIN - years
        return max(0.15, 0.85 - 0.18 * gap)
    gap = years - config.EXPERIENCE_IDEAL_MAX
    return max(0.25, 0.85 - 0.10 * gap)


def career_trajectory_fit(career_history: List[Dict[str, Any]]) -> Tuple[float, Dict[str, Any]]:
    """
    Tenure-stability signal: penalizes title-chasing (many short stints while
    titles escalate) and rewards roles long enough to have actually shipped
    something (the JD wants 3+ year thinking).
    """
    if not career_history:
        return 0.4, {"avg_tenure_months": 0, "short_stints": 0}

    durations = [r.get("duration_months", 0) or 0 for r in career_history]
    avg_tenure = sum(durations) / len(durations)
    short_stints = sum(1 for d in durations if d < 18)
    short_ratio = short_stints / len(durations)

    score = min(1.0, avg_tenure / 30.0)  # ~2.5 years average tenure -> full score
    score -= 0.4 * short_ratio
    score = max(0.1, min(1.0, score))
    return score, {"avg_tenure_months": round(avg_tenure, 1), "short_stints": short_stints}


def is_consulting_only_career(career_history: List[Dict[str, Any]]) -> bool:
    if not career_history:
        return False
    companies = [_norm(r.get("company", "")) for r in career_history]
    return all(any(firm in c for firm in config.CONSULTING_FIRMS) for c in companies)


def is_framework_tourist(candidate: Dict[str, Any]) -> bool:
    """Only AI exposure is recent (<12mo) LangChain/Prompt Engineering, nothing deeper."""
    skills = candidate.get("skills", [])
    ai_relevant = {"LangChain", "Prompt Engineering"}
    has_only_shallow_ai = False
    deeper_ai_present = False
    for s in skills:
        name = s.get("name", "")
        if name in config.MUST_HAVE_SKILL_GROUPS["embeddings_retrieval"] | \
           config.MUST_HAVE_SKILL_GROUPS["vector_db_hybrid_search"] | \
           config.NICE_TO_HAVE_SKILL_GROUPS["fine_tuning"] | \
           config.NICE_TO_HAVE_SKILL_GROUPS["deep_learning_stack"]:
            if (s.get("duration_months", 0) or 0) >= 12:
                deeper_ai_present = True
        if name in ai_relevant and (s.get("duration_months", 0) or 0) < 12:
            has_only_shallow_ai = True
    return has_only_shallow_ai and not deeper_ai_present


def is_vision_speech_robotics_only(skills: List[Dict[str, Any]]) -> bool:
    vision_speech = {
        "Image Classification", "Object Detection", "OpenCV", "YOLO", "CNN",
        "GANs", "Speech Recognition", "TTS",
    }
    nlp_ir = config.MUST_HAVE_SKILL_GROUPS["embeddings_retrieval"] | \
        config.MUST_HAVE_SKILL_GROUPS["vector_db_hybrid_search"] | {"NLP"}
    names = {s.get("name", "") for s in skills}
    has_vision_speech = bool(names & vision_speech)
    has_nlp_ir = bool(names & nlp_ir)
    # Only a disqualifier if vision/speech is their *whole* AI surface area.
    return has_vision_speech and not has_nlp_ir and len(names & vision_speech) >= 3


def skill_narrative_coherence_factor(title_category: str, retrieval_phrase_score: float) -> float:
    """
    The JD is explicit that the trap to avoid is rewarding a skills list full of
    AI keywords when the title and career narrative don't back it up. This factor
    discounts must-have / nice-to-have skill scores when there's no independent
    textual evidence (career_history descriptions) that the candidate actually did
    the work, and their title isn't already in a technical AI/ML/data category.
    A genuine ML/data title gets full trust even with thin narrative evidence
    (career text can be terse); everyone else needs the narrative to back the
    skill claims up.
    """
    if title_category in ("ml_ai_eng", "data_eng"):
        return 1.0
    if retrieval_phrase_score >= 0.4:
        return 1.0
    if retrieval_phrase_score >= 0.2:
        return 0.7
    return 0.4


def is_architecture_only(title: str, career_history: List[Dict[str, Any]]) -> bool:
    category = classify_title(title)
    if category != "architecture_only":
        return False
    current = next((r for r in career_history if r.get("is_current")), None)
    if not current:
        return True
    return (current.get("duration_months", 0) or 0) >= 18  # been "just architecture" a while


def location_fit(profile: Dict[str, Any]) -> Tuple[float, bool]:
    location = _norm(profile.get("location", ""))
    country = _norm(profile.get("country", ""))
    willing_to_relocate = None  # filled by caller using redrob_signals; placeholder here

    if any(loc in location for loc in config.PRIMARY_LOCATIONS):
        return 1.0, False
    if any(loc in location for loc in config.SECONDARY_INDIA_LOCATIONS):
        return 0.8, False
    if country == "india":
        return 0.6, False
    return 0.25, True  # outside India — flagged for the no-visa disqualifier check


def notice_period_fit(notice_period_days: int) -> float:
    if notice_period_days <= config.NOTICE_FULL_SCORE_MAX_DAYS:
        return 1.0
    if notice_period_days <= 60:
        return 0.75
    if notice_period_days <= config.NOTICE_BUYOUT_MAX_DAYS + 60:
        return 0.55
    return 0.35


def parse_date(s: str):
    try:
        y, m, d = s.split("-")
        return date(int(y), int(m), int(d))
    except Exception:
        return None
