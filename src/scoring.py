"""
scoring.py — Combines every signal into one explainable score per candidate.

Hybrid = (structured rule-based fit components) + (dense/sparse semantic
similarity component), combined as a weighted sum, then multiplied by a
behavioral-activity modifier, then reduced by any hard disqualifier penalties.

Every sub-score that goes into the final number is kept on the result object
specifically so reasoning.py can generate justifications that are *computed
from*, not independent of, the rank — directly addressing the spec's
"rank consistency" and "no hallucination" review checks.
"""

import math
from typing import Dict, Any, List

import numpy as np

from . import config, features, honeypot
from .jd_requirements import JD_FACET_NAMES, JD_FACET_TEXTS


def behavioral_modifier(signals: Dict[str, Any]) -> float:
    """
    A perfect-on-paper candidate who hasn't logged in for 6 months and ignores
    recruiters is, per the JD's own framing, "not actually available" — this
    multiplier implements that down-weighting directly.
    """
    score = 1.0

    # Recency of activity: decay based on days since last_active_date.
    from datetime import date
    last_active = features.parse_date(signals.get("last_active_date", ""))
    if last_active:
        days_inactive = (date(2026, 6, 19) - last_active).days
        if days_inactive <= 30:
            recency_factor = 1.08
        elif days_inactive <= 90:
            recency_factor = 1.0
        elif days_inactive <= 180:
            recency_factor = 0.88
        else:
            recency_factor = 0.70
    else:
        recency_factor = 0.85
    score *= recency_factor

    # Recruiter responsiveness.
    response_rate = signals.get("recruiter_response_rate", 0.3) or 0.0
    score *= (0.75 + 0.45 * response_rate)  # ranges ~0.75 to 1.20

    # Open to work is a meaningful positive signal for an active search.
    if signals.get("open_to_work_flag"):
        score *= 1.05

    # Interview completion: flakiness on scheduled interviews is a real cost.
    interview_completion = signals.get("interview_completion_rate", 0.5) or 0.0
    score *= (0.85 + 0.25 * interview_completion)

    # Verification / trust signals (small effect, profile legitimacy).
    verified_count = sum([
        bool(signals.get("verified_email")),
        bool(signals.get("verified_phone")),
        bool(signals.get("linkedin_connected")),
    ])
    score *= (0.95 + 0.02 * verified_count)

    # Profile completeness — low-effort profiles are a weak signal of intent.
    completeness = signals.get("profile_completeness_score", 50) or 0
    score *= (0.92 + 0.0016 * completeness)  # 0 -> 0.92, 100 -> 1.08

    return float(np.clip(score, config.BEHAVIORAL_MODIFIER_MIN, config.BEHAVIORAL_MODIFIER_MAX))


def compute_disqualifiers(candidate: Dict[str, Any]) -> List[str]:
    """Returns reason codes for every hard disqualifier rule that fired."""
    reasons = []
    career = candidate.get("career_history", [])
    skills = candidate.get("skills", [])
    title = candidate["profile"]["current_title"]
    signals = candidate["redrob_signals"]

    if features.is_consulting_only_career(career):
        reasons.append("consulting_only_career")

    if features.is_vision_speech_robotics_only(skills):
        reasons.append("vision_speech_only_no_nlp")

    if features.is_framework_tourist(candidate):
        reasons.append("framework_tourist")

    if features.is_architecture_only(title, career):
        reasons.append("architecture_only_no_recent_code")

    _, traj_meta = features.career_trajectory_fit(career)
    if traj_meta["short_stints"] >= 3 and len(career) >= 3:
        reasons.append("title_chasing_pattern")

    _, outside_india = features.location_fit(candidate["profile"])
    if outside_india and not signals.get("willing_to_relocate", False):
        reasons.append("no_visa_sponsorship_no_relocation")

    return reasons


DISQUALIFIER_PENALTY_MAP = {
    "consulting_only_career": config.PENALTY_CONSULTING_ONLY_CAREER,
    "vision_speech_only_no_nlp": config.PENALTY_PURE_VISION_SPEECH_ROBOTICS_NO_NLP,
    "framework_tourist": config.PENALTY_FRAMEWORK_TOURIST,
    "architecture_only_no_recent_code": config.PENALTY_ARCHITECTURE_ONLY_NO_RECENT_CODE,
    "title_chasing_pattern": config.PENALTY_TITLE_CHASER,
    "no_visa_sponsorship_no_relocation": config.PENALTY_NO_VISA_NO_RELOCATE_OUTSIDE_INDIA,
}


def score_all(candidates: List[Dict[str, Any]], semantic_backend=None) -> List[Dict[str, Any]]:
    """
    Scores every candidate and returns a list of result dicts, UNSORTED.
    Honeypots are excluded outright (not merely penalized) and reported separately.
    """
    # ---- Build the corpus once for the semantic backend (fit on candidate pool + JD facets) ----
    candidate_texts = [features._career_text(c) for c in candidates]

    if semantic_backend is None:
        from .semantic import get_backend
        semantic_backend = get_backend("auto")

    semantic_backend.fit(candidate_texts + JD_FACET_TEXTS)
    candidate_matrix = semantic_backend.transform(candidate_texts)
    jd_matrix = semantic_backend.transform(JD_FACET_TEXTS)

    # Mean similarity of each candidate against all JD facets = semantic_career_fit.
    sims = []
    for i in range(len(JD_FACET_TEXTS)):
        row = jd_matrix[i] if not hasattr(jd_matrix, "toarray") else jd_matrix[i]
        sims.append(semantic_backend.similarity(candidate_matrix, row))
    sims = np.vstack(sims)  # shape: (n_facets, n_candidates)
    semantic_scores = sims.mean(axis=0)
    # Normalize to a 0-1 band using wide percentile bounds (1st/99th, not 5th/95th)
    # so the scale is set by genuine outliers rather than getting crushed by the
    # bulk cluster of mediocre-fit candidates that real recruiting pools are mostly
    # made of. A true standout (e.g. a candidate whose raw similarity is 4-5x the
    # pool median) should land near 1.0; a candidate barely above median should NOT
    # land near 1.0 just because most of the pool is irrelevant.
    lo = float(np.percentile(semantic_scores, 1))
    hi = max(float(np.percentile(semantic_scores, 99)), float(np.max(semantic_scores)) * 0.97)
    span = max(1e-6, hi - lo)
    semantic_scores_norm = np.clip((semantic_scores - lo) / span, 0.0, 1.0)

    results = []
    honeypot_count = 0

    for idx, candidate in enumerate(candidates):
        flags = honeypot.detect_honeypot_flags(candidate)
        if len(flags) >= 2:
            honeypot_count += 1
            continue  # excluded entirely, not ranked

        profile = candidate["profile"]
        signals = candidate["redrob_signals"]

        t_score, title_category = features.title_fit_score(candidate)
        mh_score, mh_coverage = features.must_have_skill_fit(candidate["skills"])
        nh_score, nh_coverage = features.nice_to_have_skill_fit(candidate["skills"])
        eval_score = features.eval_framework_fit(candidate)
        retrieval_phrase_score = features.production_retrieval_phrase_score(candidate)

        coherence_factor = features.skill_narrative_coherence_factor(title_category, retrieval_phrase_score)
        peak_group_coverage = max(mh_coverage.values()) if mh_coverage else 0.0
        keyword_stuffing_suspected = coherence_factor < 1.0 and peak_group_coverage >= 0.5
        mh_score = mh_score * coherence_factor
        nh_score = nh_score * coherence_factor

        exp_score = features.experience_years_fit(profile["years_of_experience"])
        traj_score, traj_meta = features.career_trajectory_fit(candidate["career_history"])
        loc_score, outside_india = features.location_fit(profile)
        notice_score = features.notice_period_fit(signals.get("notice_period_days", 60))

        # eval_framework_fit blends literal phrase mining with the retrieval-phrase
        # signal, since real evaluation rigor and real retrieval work tend to co-occur.
        eval_combined = 0.6 * eval_score + 0.4 * retrieval_phrase_score

        fit_score = (
            config.COMPONENT_WEIGHTS["title_fit"] * t_score
            + config.COMPONENT_WEIGHTS["must_have_skill_fit"] * mh_score
            + config.COMPONENT_WEIGHTS["nice_to_have_skill_fit"] * nh_score
            + config.COMPONENT_WEIGHTS["eval_framework_fit"] * eval_combined
            + config.COMPONENT_WEIGHTS["semantic_career_fit"] * semantic_scores_norm[idx]
            + config.COMPONENT_WEIGHTS["experience_years_fit"] * exp_score
            + config.COMPONENT_WEIGHTS["career_trajectory_fit"] * traj_score
            + config.COMPONENT_WEIGHTS["location_fit"] * loc_score
            + config.COMPONENT_WEIGHTS["notice_period_fit"] * notice_score
        )

        modifier = behavioral_modifier(signals)
        disqualifiers = compute_disqualifiers(candidate)
        penalty = sum(DISQUALIFIER_PENALTY_MAP[r] for r in disqualifiers)

        final_score = fit_score * modifier - penalty

        results.append({
            "candidate_id": candidate["candidate_id"],
            "score": round(float(final_score), 6),
            "fit_score": round(float(fit_score), 4),
            "behavioral_modifier": round(float(modifier), 4),
            "penalty": round(float(penalty), 4),
            "disqualifiers": disqualifiers,
            "keyword_stuffing_suspected": keyword_stuffing_suspected,
            "title_category": title_category,
            "title_fit": round(float(t_score), 3),
            "must_have_skill_fit": round(float(mh_score), 3),
            "must_have_skill_coverage": mh_coverage,
            "nice_to_have_skill_coverage": nh_coverage,
            "eval_framework_fit": round(float(eval_combined), 3),
            "semantic_career_fit": round(float(semantic_scores_norm[idx]), 3),
            "experience_years_fit": round(float(exp_score), 3),
            "career_trajectory_fit": round(float(traj_score), 3),
            "career_trajectory_meta": traj_meta,
            "location_fit": round(float(loc_score), 3),
            "notice_period_fit": round(float(notice_score), 3),
            "candidate": candidate,  # kept for reasoning generation; stripped before CSV export
        })

    results.sort(key=lambda r: r["candidate_id"])  # stable pre-sort for deterministic tie-breaks
    results.sort(key=lambda r: r["score"], reverse=True)

    return results, honeypot_count
