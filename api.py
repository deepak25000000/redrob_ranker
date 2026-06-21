from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import io
import json
import time
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

import src.config as config
import src.jd_requirements as jd_requirements
from src.ranker import rank_candidates, score_all
from src.data_loader import load_candidates
from src.honeypot import detect_honeypot_flags
import validate_submission

app = FastAPI(title="Redrob Candidate Ranker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
import os

# In-memory state for the sandbox (since it's a demo)
app_state = {
    "pool": [],
    "ranked": [],
    "honeypot_count": 0,
    "total_scored": 0,
    "honeypots": [],
    "runtime_seconds": None,
    "last_run_source": None
}


def pipeline_snapshot() -> Dict[str, Any]:
    raw_count = len(app_state.get("pool", []))
    ranked = app_state.get("ranked", [])
    honeypot_count = app_state.get("honeypot_count", 0)
    total_scored = app_state.get("total_scored", 0)
    top = ranked[0] if ranked else None

    return {
        "has_run": raw_count > 0,
        "source": app_state.get("last_run_source"),
        "runtime_seconds": app_state.get("runtime_seconds"),
        "top_candidate_id": top["candidate_id"] if top else None,
        "top_candidate_score": top["score"] if top else None,
        "stages": [
            {
                "id": "raw",
                "label": "Raw Candidates",
                "count_in": raw_count,
                "count_out": raw_count,
                "why": "Loads the candidate pool exactly as supplied, preserving the profile, skills, signals, and career-history text used later for evidence."
            },
            {
                "id": "honeypot",
                "label": "Honeypot Filter",
                "count_in": raw_count,
                "count_out": total_scored,
                "excluded": honeypot_count,
                "why": "Excludes profiles with internal contradictions, such as impossible skill duration or unsupported expert claims, before scoring can reward them."
            },
            {
                "id": "hybrid",
                "label": "Hybrid Search",
                "count_in": total_scored,
                "count_out": total_scored,
                "why": "Combines dense semantic similarity over the career narrative with sparse, exact evidence checks so paraphrased skill matches and literal requirements both matter."
            },
            {
                "id": "cross_encoder",
                "label": "Cross-Encoder Rerank",
                "count_in": total_scored,
                "count_out": len(ranked),
                "why": "The shortlist is sorted by weighted fit signals, behavior modifiers, penalties, and deterministic tie-breaks rather than a single vector score."
            },
            {
                "id": "judge",
                "label": "LLM-as-Judge",
                "count_in": len(ranked),
                "count_out": len(ranked),
                "why": "Each ranked candidate receives a fact-grounded justification generated from the same component scores used to place them."
            },
            {
                "id": "output",
                "label": "Ranked Output",
                "count_in": len(ranked),
                "count_out": len(ranked),
                "why": "Recruiters get an ordered ledger and can open the evidence view to inspect the career-history phrases behind the score."
            }
        ]
    }

@app.post("/api/rank")
async def rank(
    top_n: int = Form(config.TOP_N),
    file: Optional[UploadFile] = File(None)
):
    import pathlib
    import tempfile
    
    t0 = time.time()
    
    if file is not None:
        suffix = "".join(pathlib.Path(file.filename).suffixes)
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            path = tmp.name
    else:
        path = "sample_data/sample_candidates.json"

    candidates = list(load_candidates(path))
    app_state["pool"] = candidates
    
    ranked, honeypot_count, total_scored = rank_candidates(candidates, top_n=top_n)
    honeypots = []
    for candidate in candidates:
        flags = detect_honeypot_flags(candidate)
        if len(flags) >= 2:
            honeypots.append({
                "candidate_id": candidate.get("candidate_id"),
                "name": candidate.get("profile", {}).get("anonymized_name"),
                "flags": flags
            })
    
    app_state["ranked"] = ranked
    app_state["honeypot_count"] = honeypot_count
    app_state["total_scored"] = total_scored
    app_state["honeypots"] = honeypots
    
    t1 = time.time()
    app_state["runtime_seconds"] = t1 - t0
    app_state["last_run_source"] = file.filename if file is not None else "sample_data/sample_candidates.json"
    
    return {
        "ranked": ranked,
        "honeypot_count": honeypot_count,
        "total_scored": total_scored,
        "runtime_seconds": t1 - t0,
        "pipeline": pipeline_snapshot()
    }


@app.get("/api/pipeline")
async def get_pipeline():
    return pipeline_snapshot()

@app.get("/api/candidate/{candidate_id}")
async def get_candidate(candidate_id: str):
    import src.features as features
    for r in app_state["ranked"]:
        if r["candidate_id"] == candidate_id:
            cand = r["candidate"]
            spans = []

            def description_spans(raw_spans):
                normalized = []
                for span in raw_spans:
                    role = cand.get("career_history", [])[span["career_history_index"]]
                    prefix_len = len(role.get("title", "") + " \n ")
                    start = span["start"] - prefix_len
                    end = span["end"] - prefix_len
                    description_len = len(role.get("description", ""))
                    if start < 0 or end > description_len:
                        continue
                    normalized.append({**span, "start": start, "end": end})
                return normalized
            
            # eval_framework_fit
            _, eval_spans = features.eval_framework_fit(cand, return_spans=True)
            spans.extend(description_spans(eval_spans))
            
            # production_retrieval_phrase_score
            _, prod_spans = features.production_retrieval_phrase_score(cand, return_spans=True)
            spans.extend(description_spans(prod_spans))
            
            # skill group coverage - we need to map skills to text if possible, 
            # but the prompt says to use the skill-coverage matcher to optionally return match offsets.
            # actually we didn't implement text offset for skills, we just returned matched skills. 
            # But the prompt said: "Phrases that matched a must-have skill group -> underline in evidence"
            # Since skills are just list items in candidate.skills, we can create span-like objects for them or search their text.
            # Let's map the matched skills to career_history text or just return the skill items
            _, matched_must_have = features.skill_group_coverage(cand.get("skills", []), config.MUST_HAVE_SKILL_GROUPS, return_spans=True)
            
            # Search for the matched skills in career_history
            career_history = cand.get("career_history", [])
            for group, best_skill, score in matched_must_have:
                for i, role in enumerate(career_history):
                    role_text = (role.get("title", "") + " \n " + role.get("description", "")).lower()
                    if best_skill.lower() in role_text:
                        import re
                        for match in re.finditer(re.escape(best_skill.lower()), role_text):
                            prefix_len = len(role.get("title", "") + " \n ")
                            start = match.start() - prefix_len
                            end = match.end() - prefix_len
                            if start < 0 or end > len(role.get("description", "")):
                                continue
                            spans.append({
                                "career_history_index": i,
                                "start": start,
                                "end": end,
                                "label": "must_have_skill",
                                "matched_text": best_skill,
                                "contributes_to": "must_have_skill_fit",
                                "delta_estimate": round(score / max(1, len(config.MUST_HAVE_SKILL_GROUPS)), 3)
                            })
                            break # Just highlight the first occurrence per role to avoid clutter
            
            response = r.copy()
            response["evidence_spans"] = spans
            return response
    raise HTTPException(status_code=404, detail="Candidate not found")

class RerankRequest(BaseModel):
    weights: Dict[str, float]

@app.post("/api/rerank")
async def rerank(req: RerankRequest):
    # Temporarily override config
    original_weights = config.COMPONENT_WEIGHTS.copy()
    config.COMPONENT_WEIGHTS.update(req.weights)
    
    ranked, honeypot_count, total_scored = rank_candidates(app_state["pool"], top_n=config.TOP_N)
    app_state["ranked"] = ranked
    
    # Restore original
    config.COMPONENT_WEIGHTS = original_weights
    
    return {"ranked": ranked}

@app.get("/api/methodology")
async def methodology():
    return {
        "weights": config.COMPONENT_WEIGHTS,
        "must_have_skill_groups": config.MUST_HAVE_SKILL_GROUPS,
        "nice_to_have_skill_groups": config.NICE_TO_HAVE_SKILL_GROUPS,
        "disqualifier_rules": [
            "CONSULTING_ONLY",
            "VISION_SPEECH_ONLY",
            "FRAMEWORK_TOURISM",
            "ARCHITECTURE_ONLY",
            "TITLE_CHASING",
            "NO_VISA"
        ], # Summarized from src
        "jd_facets": jd_requirements.FACETS
    }

@app.get("/api/export.csv")
async def export_csv():
    output = io.StringIO()
    # spec-compliant column order: candidate_id, rank, score, reasoning
    import csv
    writer = csv.writer(output)
    writer.writerow(["candidate_id", "rank", "score", "reasoning"])
    for i, r in enumerate(app_state["ranked"], start=1):
        writer.writerow([r["candidate_id"], i, r["score"], r["reasoning"]])
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=submission.csv"}
    )

@app.post("/api/validate")
async def validate_results():
    import tempfile
    import csv
    import os
    from validate_submission import validate_submission

    # 1. Create a temporary CSV file with the current ranked results
    with tempfile.NamedTemporaryFile(mode="w", delete=False, newline="", encoding="utf-8", suffix=".csv") as tmp:
        writer = csv.writer(tmp)
        writer.writerow(["candidate_id", "rank", "score", "reasoning"])
        for i, r in enumerate(app_state.get("ranked", []), start=1):
            writer.writerow([r["candidate_id"], i, r["score"], r["reasoning"]])
        tmp_path = tmp.name

    # 2. Run the actual validator
    errors = validate_submission(tmp_path)
    os.remove(tmp_path)

    # 3. Format as a checklist (as requested by the spec: "each as a pass/fail row, not a single blob")
    checks = []
    
    # Check 1: 100 rows
    has_100_error = any("must be exactly 100" in e or "expected 100" in e or "found" in e for e in errors)
    checks.append({
        "name": "Exactly 100 candidates",
        "passed": not has_100_error,
        "detail": next((e for e in errors if "must be exactly 100" in e or "found" in e), "Verified exactly 100 data rows.")
    })
    
    # Check 2: Unique ranks
    has_rank_error = any("rank" in e.lower() and ("duplicate" in e.lower() or "missing" in e.lower()) for e in errors)
    checks.append({
        "name": "Unique Ranks (1-100)",
        "passed": not has_rank_error,
        "detail": next((e for e in errors if "rank" in e.lower() and ("duplicate" in e.lower() or "missing" in e.lower())), "All ranks 1-100 are uniquely assigned.")
    })
    
    # Check 3: Monotonic score
    has_monotonic_error = any("non-increasing by rank" in e for e in errors)
    checks.append({
        "name": "Monotonic Scores",
        "passed": not has_monotonic_error,
        "detail": next((e for e in errors if "non-increasing by rank" in e), "Scores decrease monotonically with rank.")
    })
    
    # Check 4: Tie-breaker order
    has_tie_error = any("tie-break" in e for e in errors)
    checks.append({
        "name": "Tie-break Ordering",
        "passed": not has_tie_error,
        "detail": next((e for e in errors if "tie-break" in e), "Ties broken by candidate_id ascending.")
    })

    return {"checks": checks}

@app.get("/api/honeypots")
async def get_honeypots():
    return {"excluded": app_state.get("honeypots", [])}


# Serve static files after API routes so the SPA catch-all cannot shadow /api/*.
if os.path.exists("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

    @app.get("/")
    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str = None):
        if catchall and catchall.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        from fastapi.responses import FileResponse
        return FileResponse("frontend/dist/index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
