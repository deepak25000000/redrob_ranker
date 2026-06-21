# Redrob Candidate Ranker

A hybrid, explainable candidate-ranking system built for the **Redrob Intelligent Candidate Discovery & Ranking Challenge**, targeting the *Senior AI Engineer — Founding Team* job description.

Fully compliant with `submission_spec.md`'s compute constraints: **≤5 min wall-clock, ≤16 GB RAM, CPU-only, zero network calls during ranking.**

> **TODO before you submit:** every bracketed `[ ]` placeholder below needs your real values. Don't ship this with placeholders still in it — Stage 4 reviewers read this file closely.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Tech Stack](#tech-stack)
3. [Why This Isn't Just Keyword Search](#why-this-isnt-just-keyword-search)
4. [Architecture](#architecture)
5. [Scoring Components](#scoring-components)
6. [Disqualifiers (JD-Derived Hard Filters)](#disqualifiers-jd-derived-hard-filters)
7. [Honeypot Detection](#honeypot-detection)
8. [Spec Compliance Checklist](#spec-compliance-checklist)
9. [Module Map](#module-map)
10. [Testing](#testing)
11. [Honest Limitations](#honest-limitations)
12. [Possible Extensions](#possible-extensions)
13. [AI Tools Used](#ai-tools-used)
14. [Methodology Summary](#methodology-summary-for-submission_metadatayaml)

---

## Quick Start

**Requirements:** Python `[3.11.x]` (match whatever you put in `submission_metadata.yaml`'s `compute.python_version`).

```bash
git clone [your-repo-url]
cd [your-repo-name]
python -m venv .venv && source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

**Reproduce the submission CSV** (single command, matches `reproduce_command` in `submission_metadata.yaml`):

```bash
python rank.py --candidates ./candidates.jsonl.gz --out ./submission.csv
```

Accepts `.json`, `.jsonl`, `.jsonl.gz`, `.csv`, and `.xlsx` — no manual unzip needed.

**Sanity-check on the 50-candidate sample first:**

```bash
python rank.py --candidates sample_data/sample_candidates.json --out outputs/demo_submission.csv --top-n 50
```

**CLI flags:**

| Flag | Required | Description |
|---|---|---|
| `--candidates` | Yes | Path to candidate pool (`.json` / `.jsonl` / `.jsonl.gz` / `.csv` / `.xlsx`) |
| `--out` | Yes | Output CSV path |
| `--top-n` | No (default 100) | Rows to output — use 50 for sample-data sanity checks |
| `[--seed]` | No | [Document if your tie-breaking or any sampling uses one] |

**On the full 100K pool:** benchmarked at `[107s wall time, 2.7GB peak RSS]` on `[CPU model, # cores, RAM — e.g., "AWS c5.2xlarge, 8 vCPU, 16GB"]`. **Fill in the real machine** — Stage 3 reproduces this on their own sandbox, so vague or missing hardware specs look evasive if your numbers don't match theirs.

Before uploading, **rename the output to your registered participant ID** (e.g. `team_xxx.csv`) — `submission.csv` will be auto-rejected per spec Section 2.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Language | Python `[3.11]` | Spec requirement; CPU-only environment |
| Data I/O | `[pandas / orjson / gzip stdlib]` | Streaming JSONL(.gz) read at 100K scale without loading everything into a DataFrame upfront |
| Default semantic backend | TF-IDF + cosine similarity (`scikit-learn`) | Zero network dependency, sub-second on 100K candidates, no GPU — directly satisfies the "no hosted LLM, no GPU" constraint instead of fighting it |
| Optional semantic backend | `sentence-transformers` (e.g. `all-MiniLM-L6-v2` or `bge-small-en`) | Drop-in upgrade for paraphrase-level matching; embeddings are **precomputed offline** (network allowed at this stage — it's not the ranking step) and cached to disk |
| Optional local ANN index | `FAISS` (in-process library, not a server) | If using embeddings at scale, avoids the O(n) brute-force cosine pass — and unlike Qdrant/Chroma run in server mode, it has zero network footprint, so it doesn't risk violating the no-network ranking rule |
| Scoring | Hand-tuned weighted hybrid (NumPy) | Transparent, debuggable, defensible in the Stage 5 interview — no black-box model to explain |
| Output | Python `csv` stdlib | Exact column order control, avoids pandas dtype surprises (e.g. silently rounding `score`) |
| Tests | `pytest` | Honeypot detection + scoring invariants |

**Why not a hosted vector DB (Pinecone/Weaviate/managed Qdrant)?** The compute spec explicitly forbids network calls during ranking and caps RAM at 16GB. A hosted vector DB adds a network dependency for no real benefit at 100K candidates — brute-force cosine similarity over TF-IDF or cached embeddings is faster than a network round-trip per query anyway. If you want the "vector DB" line on your resume, run Qdrant or Chroma in **local/embedded mode** (no server process) — but for this problem size it's complexity without payoff.

---

## Why This Isn't Just Keyword Search

The JD is explicit about the trap it's testing for: *"the right answer is not 'find candidates whose skills section contains the most AI keywords.'"* Three design choices exist specifically to defeat that:

1. **Skill-narrative coherence discount** (`features.skill_narrative_coherence_factor`). A skill claim is only fully trusted if either (a) the candidate's title is already in a technical ML/data category, or (b) their career-history prose independently corroborates the work (mentions of "ranking layer," "embedding drift," "retrieval," etc. — see `config.PRODUCTION_RETRIEVAL_PHRASES`). A "Frontend Engineer" with five endorsed "expert" FAISS/OpenSearch skills but zero career-history evidence of touching search gets that claim discounted by up to `[X]%`. This is the single biggest lever against the keyword-stuffer trap.

2. **Plain-language credit** (`features.production_retrieval_phrase_score` + the semantic similarity component). A candidate who never says "RAG" or "Pinecone" but whose career history reads *"owned the ranking layer for an e-commerce search product... built the relevance labeling pipeline"* scores well anyway, because the semantic-fit component runs full career-history sentences against JD-facet descriptions written in plain language (`jd_requirements.py`), not a skill-tag dictionary lookup.

3. **Trust-weighted skills, not boolean has/doesn't-have.** Every skill's contribution is `proficiency × evidence(duration_months, endorsements)` (`features._skill_trust_weight`) — "expert, 0 endorsements, used 2 months" counts for a fraction of "advanced, 40 endorsements, used 3 years."

---

## Architecture

```
candidates.jsonl(.gz)
        │
        ▼
 data_loader.py   streams json / jsonl / jsonl.gz, never loads the full
        │           100K pool into memory at once
        ▼
 honeypot.py      excludes "subtly impossible" profiles before scoring
        │           (skill-duration exceeding total experience, overlapping
        │           "current" roles, date/duration mismatches, clustered
        │           unsupported "expert" claims). Excludes only on ≥2
        │           independent flags to avoid false-positiving real,
        │           messy-but-genuine candidates.
        ▼
 features.py      per-candidate structured signals: title category ·
        │           trust-weighted skill coverage · eval-framework /
        │           production-retrieval phrase mining · experience-years
        │           fit curve (not a hard cutoff — JD explicitly allows
        │           outliers) · career-trajectory stability · location fit
        │           (graded: Pune/Noida > other Tier-1 India > elsewhere
        │           in India > outside India w/o relocation willingness) ·
        │           notice-period fit (graded curve, not a hard 30-day
        │           cutoff — JD allows a 30-day buyout) · 9 hard
        │           disqualifier checks (see table below)
        ▼
 semantic.py       dense/sparse similarity of full career narrative
        │           against 6 plain-language JD facets (jd_requirements.py).
        │           Default: TF-IDF + cosine — zero network, scales to
        │           100K candidates in seconds. Optional: cached
        │           sentence-transformer embeddings (scripts/
        │           precompute_embeddings.py) for paraphrase-level
        │           matching — same interface, swap-in.
        ▼
 scoring.py        weighted hybrid score (see COMPONENT_WEIGHTS in
        │           config.py) × behavioral modifier (recency,
        │           responsiveness, interview completion, verification,
        │           profile completeness — implements the JD's
        │           "down-weight unavailable candidates" instruction)
        │           − disqualifier penalties. Final score normalized to
        │           [0, 1].
        ▼
 reasoning.py      deterministic, fact-grounded "why this candidate"
        │           sentence, built FROM the same sub-scores that drove
        │           the rank — not an independent LLM call, so it can't
        │           contradict the rank or hallucinate a skill that
        │           isn't in the profile.
        ▼
 ranker.py         sorts by score descending, breaks ties by
                    candidate_id ascending (spec Section 3), assigns
                    ranks 1–100, writes the spec-compliant CSV
```

---

## Scoring Components

Nine weighted fit components feed the hybrid score. Exact weights live in `config.COMPONENT_WEIGHTS` — fill in the real numbers below before you submit, since this table is the fastest way for a Stage 4/5 reviewer to understand your design without reading code:

| Component | What it captures | Default weight |
|---|---|---|
| Title category match | Is the candidate in a technical ML/IR/data role today | `[ ]` |
| Trust-weighted must-have skill coverage | Embeddings/retrieval, vector DB/hybrid search, Python, eval-framework experience | `[ ]` |
| Trust-weighted nice-to-have skill coverage | Fine-tuning, LTR, HR-tech exposure, distributed systems, OSS | `[ ]` |
| Production-retrieval phrase mining | Plain-language evidence of having built ranking/retrieval systems, even without keyword skills | `[ ]` |
| TF-IDF/embedding semantic similarity | Career-narrative fit against 6 JD facets | `[ ]` |
| Experience-years fit curve | Graded fit around the 5–9yr band, not a hard cutoff | `[ ]` |
| Career-trajectory stability | Penalizes title-chasing pattern, rewards 3+ year tenures | `[ ]` |
| Location fit | Graded: Pune/Noida → Tier-1 India → elsewhere → outside India | `[ ]` |
| Notice-period fit | Graded curve favoring ≤30 days, not a hard cutoff | `[ ]` |
| **Behavioral modifier (multiplicative)** | Recency, recruiter response rate, interview completion, verification, profile completeness | applied after the above |

---

## Disqualifiers (JD-Derived Hard Filters)

The JD specifies **9** explicit disqualifier signals across its "what we mean by 5-9 years" and "things we explicitly do NOT want" sections. Honest status:

| # | Disqualifier (from JD) | Implemented? |
|---|---|---|
| 1 | Pure research/academic background, no production deployment | ❌ Not implemented — no clean "research lab" field in schema |
| 2 | AI experience is primarily recent (<12mo) LangChain/OpenAI work, no pre-LLM production ML experience | ❌ Not implemented — would need duration-weighted skill-recency logic not yet built |
| 3 | Senior engineer, 18+ months without writing production code (architecture/tech-lead only) | ✅ Implemented |
| 4 | Title-chasing (Senior→Staff→Principal via 1.5yr company hops) | ✅ Implemented |
| 5 | Framework-tourism (LangChain-tutorial-only signal, no systems depth) | ✅ Implemented |
| 6 | Consulting-only entire career (TCS/Infosys/Wipro/Accenture/Cognizant/Capgemini) with no product-company experience | ✅ Implemented |
| 7 | Primary expertise in CV/speech/robotics with no significant NLP/IR exposure | ✅ Implemented |
| 8 | 5+ years entirely on closed-source proprietary systems, no external validation (papers/talks/OSS) | ❌ Not implemented — no clean signal for "external validation" in schema |
| 9 | Outside India, unwilling to relocate (no visa sponsorship) | ✅ Implemented |

**6 of 9 implemented.** The 3 gaps are real and documented here on purpose — claiming all 9 and getting caught at Stage 5 is worse than disclosing the gap.

---

## Honeypot Detection

Heuristic, not ground truth. Flags fire on:
- Skill `duration_months` exceeding total career duration
- Overlapping `is_current: true` roles
- Internal date/duration arithmetic mismatches
- Clusters of unsupported "expert" proficiency claims with 0 endorsements

A profile is excluded only when **≥2 independent flags** fire, to avoid false-positiving genuine candidates with messy-but-real data. This will not catch every honeypot in the real dataset — it's a precision-over-recall design choice, since the spec's disqualification threshold is **honeypot rate >10% in top 100**, not zero tolerance.

`[Optional but recommended: describe how you spot-checked this — e.g., "manually reviewed N flagged candidates against the honeypot description in redrob_signals_doc.md and confirmed X true positives, Y false positives."]`

---

## Spec Compliance Checklist

Self-check against `submission_spec.md` Section 3 and Section 6 before uploading:

- [ ] Exactly 100 data rows + 1 header row
- [ ] Ranks 1–100, each exactly once (not 0-indexed)
- [ ] Each `candidate_id` unique and exists in `candidates.jsonl`
- [ ] `score` non-increasing as rank increases (enforced by `ranker.py`'s sort)
- [ ] Equal scores broken by `candidate_id` ascending (enforced by `ranker.py`)
- [ ] File is `.csv`, UTF-8, named `<participant_id>.csv` — **not** `submission.csv`
- [ ] Ran `python validate_submission.py <participant_id>.csv` with zero errors
- [ ] `submission_metadata.yaml` at repo root, mirrors portal metadata exactly
- [ ] `reproduce_command` in `submission_metadata.yaml` matches the Quick Start command above, verbatim
- [ ] Reproduce command tested on a clean checkout, not just your dev machine

---

## Module Map

| File | Responsibility |
|---|---|
| `rank.py` | CLI entrypoint (the single reproduce command) |
| `src/config.py` | Skill taxonomy, component weights, disqualifier thresholds — the file to edit if the JD changes |
| `src/jd_requirements.py` | Plain-language JD facets used for semantic matching |
| `src/data_loader.py` | `json` / `jsonl` / `jsonl.gz` / `csv` / `xlsx` streaming reader |
| `src/features.py` | All structured feature engineering |
| `src/honeypot.py` | Impossible-profile detection |
| `src/semantic.py` | Pluggable TF-IDF / sentence-transformer backend |
| `src/scoring.py` | Combines everything into the final score |
| `src/reasoning.py` | Fact-grounded justification generator |
| `src/ranker.py` | Orchestration + CSV writer |
| `scripts/precompute_embeddings.py` | Optional: cache a real sentence-transformer model ahead of time |
| `tests/test_pipeline.py` | Unit tests for honeypot detection + scoring invariants |

---

## Testing

```bash
pip install -r requirements-dev.txt   # if pytest isn't already in requirements.txt
pytest tests/ -v
```

`[Add: what's actually covered — e.g., "honeypot flag thresholds, score monotonicity, tie-break ordering, disqualifier penalty application."]`

---

## Honest Limitations

- **Honeypot detection is heuristic**, conservative by design (≥2-flag rule) to avoid false positives — see [Honeypot Detection](#honeypot-detection).
- **3 of 9 JD disqualifiers are not implemented** (pure-research-only, recent-LangChain-only without pre-LLM experience, closed-source-without-external-validation) — the schema doesn't carry clean fields to key off these, and faking a signal from noise seemed worse than disclosing the gap. See the [Disqualifiers table](#disqualifiers-jd-derived-hard-filters).
- **TF-IDF is the honest default, not a corner cut** — it's what gives the ranking step zero network dependency and trivial CPU cost at 100K scale. The sentence-transformer backend is a real upgrade path for anyone with more precomputation headroom.
- `[Add any other gap you know about — empty skill_assessment_scores handling, candidates with missing education, etc.]`

---

## Possible Extensions

- **Enable real dense embeddings:** run `scripts/precompute_embeddings.py` once (needs network — that's fine, it's precomputation, not ranking), then `semantic.get_backend("sentence-transformer")` is used automatically.
- **LLM-as-judge re-rank of the top 20–30** using a small local model (via `llama.cpp` or `ollama`, no hosted API) purely to sanity-check/refine final ordering and reasoning prose — only after the cheap pipeline has cut 100K down to a few dozen, to stay inside the time budget. Not wired in by default since it isn't needed to hit the spec.
- **Learning-to-rank:** once ground-truth relevance tiers are released post-competition, `COMPONENT_WEIGHTS` could be learned (e.g. gradient-boosted ranking) instead of hand-set — the per-candidate feature vector this pipeline already produces is ready to feed straight into that.

---

## AI Tools Used

`[Fill this in honestly and make sure it matches submission_metadata.yaml's ai_tools_used and ai_usage_summary fields exactly — Stage 5 checks for contradictions between this, the metadata file, and your interview answers.]`

Example: *"Claude was used for architecture discussion and code review during development. GitHub Copilot was used for autocomplete. No candidate data was sent to any external LLM API — the ranking pipeline itself makes zero network calls, consistent with the compute spec."*

---

## Methodology Summary (for `submission_metadata.yaml`)

> Multi-stage hybrid ranker. Stage 1 excludes heuristically-detected honeypots (impossible skill-duration/experience ratios, overlapping current roles, date/duration mismatches; ≥2-flag threshold). Stage 2 computes 9 weighted fit components per candidate: title category, trust-weighted must-have/nice-to-have skill coverage, evaluation-framework + production-retrieval phrase mining, TF-IDF semantic similarity of career narrative against 6 plain-language JD facets, graded experience-years fit, career-trajectory stability, graded location fit, and graded notice-period fit. A skill-narrative-coherence discount defeats keyword-stuffing by distrusting AI-skill claims unsupported by title or career-history text. Stage 3 applies a behavioral-signal multiplier (recency, recruiter responsiveness, interview completion, verification, profile completeness) and 6 of 9 JD-specified hard disqualifier penalties (consulting-only career, vision/speech-only with no NLP, framework-tourism, architecture-only roles, title-chasing, no-visa-no-relocation — 3 disqualifiers around pure-research and closed-source-validation are explicitly not implemented, see README). Stage 4 generates fact-grounded reasoning directly from the computed sub-scores (no LLM call, so it can't hallucinate or contradict the rank). Runtime on the full 100K pool: `[~107s, ~2.7GB RAM on <hardware>]`.

`[This must stay under 200 words per the template — trim if needed once weights/numbers are filled in.]`

---

## License

`[Optional — add MIT or your team's choice if your repo needs to stay public/gradable past the hackathon.]`
