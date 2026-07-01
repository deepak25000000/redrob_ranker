# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A hybrid, explainable candidate-ranking system for the Redrob "Senior AI Engineer — Founding Team" hiring challenge. Given a pool of candidate JSON profiles, it scores and ranks the top 100 with a human-readable justification per candidate. Two entry points share the same scoring core (`src/`):

- **CLI** (`rank.py`) — the actual challenge deliverable: one command, CPU-only, no network, produces a spec-compliant `submission.csv`.
- **Web app** (`api.py` FastAPI + `frontend/` React SPA) — an interactive demo/explorer over the same pipeline, deployed to Hugging Face Spaces (backend) and Vercel (frontend).

## Commands

Backend / CLI (run from repo root):

```bash
pip install -r requirements.txt              # core deps (TF-IDF path only)
pip install fastapi uvicorn python-multipart # extra deps for the API

# Produce the submission CSV (the deliverable)
python rank.py --candidates ./candidates.jsonl.gz --out ./submission.csv
python rank.py --candidates sample_data/sample_candidates.json --out outputs/demo.csv --top-n 50  # quick sanity check

python -m pytest tests/ -v                    # run all tests
python -m pytest tests/test_pipeline.py::test_strongest_sample_candidate_ranks_first -v  # single test

uvicorn api:app --reload --port 8000          # run the API alone
python validate_submission.py <path.csv>      # validate a CSV against challenge rules
python scripts/export_methodology_json.py     # regenerate frontend/public/methodology.json from config
```

Full stack (root `package.json`):

```bash
npm run install-all   # pip deps + fastapi/uvicorn + frontend npm install
npm run dev           # concurrently: uvicorn (:8000) + vite dev server; `predev` regenerates methodology.json
```

Frontend (from `frontend/`):

```bash
npm run dev      # vite dev server, proxies /api -> VITE_API_URL or http://localhost:8000
npm run build    # tsc -b && vite build  (also the type-check gate)
npm run lint     # eslint
```

## Architecture

Data flows one direction through `src/`, and both the CLI and the API call the same functions — never duplicate scoring logic in `api.py`.

```
candidates file  ->  data_loader  ->  honeypot filter  ->  scoring  ->  reasoning  ->  top-100 CSV / JSON
(json / jsonl / jsonl.gz / csv / xlsx / xls)            (excludes, not          (features + semantic)   (justification per row)
                                     penalizes)
```

- **`src/config.py`** — the single source of truth for *what the JD wants*: skill taxonomy, weights, disqualifier penalties, location/experience bands. **If the target role changes, this is the only file that should need editing.** `COMPONENT_WEIGHTS` must sum to 1.0 (asserted at import).
- **`src/data_loader.py`** — streams candidate records from `.json` / `.jsonl` / `.jsonl.gz` / `.csv` / `.xlsx`; avoids materializing the full ~465MB/100K pool where possible. Uses `orjson` if installed, else stdlib `json`.
- **`src/honeypot.py`** — flags "subtly impossible" profiles (skill duration > career length, overlapping current roles, date/duration mismatches, clustered unsupported "expert" skills). A candidate is *excluded entirely* (not scored) at **≥2 flags** — see `score_all`.
- **`src/features.py`** — all deterministic, no-LLM, no-network feature engineering. Every sub-score comes from here.
- **`src/semantic.py`** — pluggable "meaning, not keywords" layer behind one interface. Default `TfidfSemanticBackend` (scikit-learn, zero network). Optional `SentenceTransformerBackend` is opt-in and requires a pre-cached model (`scripts/precompute_embeddings.py`); the ranking step itself never hits the network. `get_backend("auto")` falls back to TF-IDF on any failure.
- **`src/jd_requirements.py`** — JD facets written in *candidate career-history language* (not buzzwords). These are the "query side" of the semantic similarity match, so plain-language candidates score well.
- **`src/scoring.py`** — `score_all()` combines everything: `final = fit_score (weighted sum of components) × behavioral_modifier − disqualifier_penalties`. Uses a bounded heap to keep only top-N while scoring, with deterministic tie-breaking. Keeps every sub-score on the result dict so reasoning can cite it.
- **`src/reasoning.py`** — generates the "why" string **from the same sub-scores that produced the rank** (deliberately not an LLM call). Phrasing varies via a deterministic hash of `candidate_id`, so reruns are stable and reproducible.
- **`src/ranker.py`** — thin orchestration (`run`, `rank_candidates`, `write_submission_csv`) that the CLI and API both call.

### Key design invariants (don't break these)

- **No network, no LLM, no GPU in the ranking path.** This is a hard challenge constraint. `requirements.txt` is intentionally minimal (numpy/scikit-learn/pandas/orjson/openpyxl). Anything heavier must be optional and opt-in via the semantic backend, precomputed offline.
- **Determinism / reproducibility.** Same input must yield the same ranking and same reasoning text every run (see `test_score_all_is_deterministic_and_sorted`). Avoid unseeded randomness and wall-clock-dependent logic in scoring/reasoning. Note `behavioral_modifier` hardcodes a reference date (`date(2026, 6, 19)`) for recency decay rather than using "today".
- **Explainability over accuracy tricks.** Sub-scores must stay attached to results and reasoning must only assert facts present in the candidate record — no hallucinated claims. Keyword-stuffing defense lives in `skill_narrative_coherence_factor` + trust-weighted skills; preserve it.

### Web layer

- `api.py` holds ranked results in a module-level `app_state` dict (in-memory, single-process demo — not durable). Endpoints: `POST /api/rank`, `GET /api/pipeline`, `GET /api/candidate/{id}` (adds `evidence_spans` — character offsets into career-history text for UI highlighting), `POST /api/rerank` (live weight tweaking), `GET /api/methodology`, `GET /api/export.csv`, `POST /api/validate`, `GET /api/honeypots`. In production it also serves the built SPA from `frontend/dist`; static mounts are registered **after** API routes so the catch-all can't shadow `/api/*`.
- `app.py` is just `from api import app` (deployment entrypoint shim).
- Frontend: React 19 + Vite + Tailwind + react-router. Routes in `frontend/src/App.tsx` (`/`, `/run`, `/results`, `/results/:id`, `/methodology`, `/honeypots`, `/export`). API base URL resolves from `VITE_API_URL`, defaulting to the HF Space (`frontend/src/lib/api.ts`). `frontend/public/methodology.json` is generated from `src/config.py` — regenerate it (via the script or `npm run dev`'s `predev`) after changing weights/skill groups, don't hand-edit.

## Deployment

- **Backend** → Hugging Face Spaces via `Dockerfile` (multi-stage: builds frontend, then serves both from `uvicorn api:app` on port 7860). Pushed to the `hf` git remote.
- **Frontend** → Vercel (`frontend/vercel.json` rewrites all routes to `index.html` for SPA routing).
