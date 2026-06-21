import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.honeypot import detect_honeypot_flags
from src.features import (
    title_fit_score, skill_narrative_coherence_factor,
    experience_years_fit, notice_period_fit, is_consulting_only_career,
)
from src.scoring import score_all
from src.data_loader import load_candidates

SAMPLE_PATH = os.path.join(os.path.dirname(__file__), "..", "sample_data", "sample_candidates.json")


def _minimal_candidate(**overrides):
    base = {
        "candidate_id": "CAND_0009999",
        "profile": {
            "anonymized_name": "Test Person", "headline": "x", "summary": "x",
            "location": "Pune, Maharashtra", "country": "India",
            "years_of_experience": 6.0, "current_title": "Software Engineer",
            "current_company": "Acme", "current_company_size": "201-500",
            "current_industry": "Software",
        },
        "career_history": [{
            "company": "Acme", "title": "Software Engineer", "start_date": "2020-01-01",
            "end_date": None, "duration_months": 60, "is_current": True,
            "industry": "Software", "company_size": "201-500", "description": "did stuff",
        }],
        "education": [],
        "skills": [],
        "redrob_signals": {
            "profile_completeness_score": 70, "signup_date": "2024-01-01",
            "last_active_date": "2026-06-01", "open_to_work_flag": True,
            "profile_views_received_30d": 10, "applications_submitted_30d": 2,
            "recruiter_response_rate": 0.5, "avg_response_time_hours": 50,
            "skill_assessment_scores": {}, "connection_count": 100,
            "endorsements_received": 5, "notice_period_days": 30,
            "expected_salary_range_inr_lpa": {"min": 10, "max": 20},
            "preferred_work_mode": "hybrid", "willing_to_relocate": True,
            "github_activity_score": -1, "search_appearance_30d": 10,
            "saved_by_recruiters_30d": 1, "interview_completion_rate": 0.6,
            "offer_acceptance_rate": -1, "verified_email": True,
            "verified_phone": True, "linkedin_connected": True,
        },
    }
    base.update(overrides)
    return base


def test_honeypot_flags_impossible_skill_duration():
    c = _minimal_candidate()
    c["skills"] = [{"name": "Python", "proficiency": "expert", "endorsements": 5, "duration_months": 500}]
    flags = detect_honeypot_flags(c)
    assert any("skill_duration_exceeds_experience" in f for f in flags)


def test_honeypot_flags_concurrent_current_roles():
    c = _minimal_candidate()
    c["career_history"] = [
        {**c["career_history"][0], "company": "A", "is_current": True},
        {**c["career_history"][0], "company": "B", "is_current": True},
    ]
    flags = detect_honeypot_flags(c)
    assert "multiple_concurrent_current_roles" in flags


def test_clean_candidate_has_no_honeypot_flags():
    c = _minimal_candidate()
    c["skills"] = [{"name": "Python", "proficiency": "advanced", "endorsements": 10, "duration_months": 36}]
    flags = detect_honeypot_flags(c)
    assert flags == []


def test_title_fit_ranks_ml_role_above_non_technical():
    ml_score, _ = title_fit_score(_minimal_candidate(profile={
        **_minimal_candidate()["profile"], "current_title": "Recommendation Systems Engineer"
    }))
    non_tech_score, _ = title_fit_score(_minimal_candidate(profile={
        **_minimal_candidate()["profile"], "current_title": "Marketing Manager"
    }))
    assert ml_score > non_tech_score


def test_skill_narrative_coherence_full_trust_for_ml_title():
    factor = skill_narrative_coherence_factor("ml_ai_eng", retrieval_phrase_score=0.0)
    assert factor == 1.0


def test_skill_narrative_coherence_discounts_unsupported_claims():
    factor = skill_narrative_coherence_factor("swe_frontend", retrieval_phrase_score=0.0)
    assert factor < 1.0


def test_experience_years_fit_peaks_in_sweet_spot():
    assert experience_years_fit(7) >= experience_years_fit(2)
    assert experience_years_fit(7) >= experience_years_fit(20)


def test_notice_period_fit_prefers_sub_30():
    assert notice_period_fit(15) > notice_period_fit(90)


def test_consulting_only_career_detection():
    c = _minimal_candidate()
    c["career_history"] = [
        {**c["career_history"][0], "company": "TCS"},
        {**c["career_history"][0], "company": "Infosys"},
    ]
    assert is_consulting_only_career(c["career_history"]) is True

    c["career_history"].append({**c["career_history"][0], "company": "Swiggy"})
    assert is_consulting_only_career(c["career_history"]) is False


def test_score_all_is_deterministic_and_sorted():
    candidates = load_candidates(SAMPLE_PATH)
    results_a, hp_a = score_all(candidates)
    results_b, hp_b = score_all(candidates)
    assert hp_a == hp_b
    assert [r["candidate_id"] for r in results_a] == [r["candidate_id"] for r in results_b]
    scores = [r["score"] for r in results_a]
    assert scores == sorted(scores, reverse=True)


def test_strongest_sample_candidate_ranks_first():
    # CAND_0000031 is a recommendation-systems engineer with deep, well-evidenced
    # production retrieval/embeddings experience — the clearest fit in the sample set.
    candidates = load_candidates(SAMPLE_PATH)
    results, _ = score_all(candidates)
    assert results[0]["candidate_id"] == "CAND_0000031"


if __name__ == "__main__":
    import pytest
    sys.exit(pytest.main([__file__, "-v"]))
