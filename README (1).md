# Redrob Candidate Ranker

A hybrid, explainable candidate-ranking system for the *Senior AI Engineer —
Founding Team* JD. Built for the Redrob "Intelligent Candidate Discovery &
Ranking Challenge" hackathon, and compliant with `submission_spec.md`'s
compute constraints (≤5 min, ≤16GB RAM, CPU only, no network during ranking).

## Quick start

```bash
pip install -r requirements.txt
python rank.py --candidates ./candidates.jsonl.gz --out ./submission.csv
```

That's the single reproduce command. On the real 100K-candidate pool this
completes in ~1.5-2 minutes and uses well under 3GB RAM (benchmarked against a
synthetic 100K-row file: 107s wall time, 2.7GB peak RSS).

Run it against the bundled 50-candidate sample first to sanity-check your
environment:

```bash
python rank.py --candidates sample_data/sample_candidates.json --out outputs/demo_submission.csv --top-n 50
```

## Why this isn't just keyword search

The JD is explicit about the trap it's testing for: *"the right answer is not
'find candidates whose skills section contains the most AI keywords.'"* Three
design choices exist specifically to defeat that trap:

1. **Skill-narrative coherence discount** (`features.skill_narrative_coherence_factor`).
   A skill claim only gets full trust if either (a) the candidate's title is
   already in a technical ML/data category, or (b) their career-history *prose*
   independently corroborates the work (mentions of "ranking layer", "embedding
   drift", "retrieval", etc. — see `config.PRODUCTION_RETRIEVAL_PHRASES`). A
   "Frontend Engineer" with five endorsed "expert" FAISS/OpenSearch skills but
   zero career-history evidence of ever touching search gets that claim
   discounted by up to 60%. This is the single biggest lever against the
   keyword-stuffer trap.

2. **Plain-language credit** (`features.production_retrieval_phrase_score` +
   the semantic similarity component). A candidate who never says "RAG" or
   "Pinecone" but whose career history reads *"owned the ranking layer for an
   e-commerce search product... built the relevance labeling pipeline"* scores
   well anyway, because the semantic-fit component is computed from full
   career-history sentences against JD-facet descriptions written in plain
   language (`jd_requirements.py`), not from a skill-tag dictionary lookup.

3. **Trust-weighted skills, not boolean has/doesn't-have.** Every skill's
   contribution is `proficiency × evidence(duration_months, endorsements)`
   (`features._skill_trust_weight`) — "expert, 0 endorsements, used for 2
   months" counts for a fraction of "advanced, 40 endorsements, used for 3
   years."

## Architecture

```
candidates.jsonl(.gz)
        │
        ▼
 data_loader.py  (streams json / jsonl / jsonl.gz)
        │
        ▼
 honeypot.py  ──► excludes "subtly impossible" profiles before scoring
        │            (impossible skill-duration vs. experience, overlapping
        │             "current" roles, date/duration mismatches, clustered
        │             unsupported "expert" claims)
        ▼
 features.py  ──► per-candidate structured signals:
        │            title category · trust-weighted skill coverage ·
        │            eval-framework / production-retrieval phrase mining ·
        │            experience-years fit curve · career-trajectory stability ·
        │            location fit · notice-period fit · 6 hard-disqualifier checks
        │            (straight from the JD's "explicitly do NOT want" section)
        ▼
 semantic.py  ──► dense/sparse similarity of full career narrative against
        │            6 plain-language JD facets (jd_requirements.py).
        │            Default backend: TF-IDF + cosine (zero network, scales to
        │            100K candidates in seconds). Optional upgrade: a cached
        │            sentence-transformer model (see scripts/precompute_embeddings.py)
        │            for true paraphrase-level matching — swap-in, same interface.
        ▼
 scoring.py   ──► weighted hybrid score (see COMPONENT_WEIGHTS in config.py)
        │            × behavioral modifier (recency, responsiveness, interview
        │              completion, verification, profile completeness — directly
        │              implements the JD's "down-weight unavailable candidates")
        │            − disqualifier penalties
        ▼
 reasoning.py ──► deterministic, fact-grounded "why this candidate" sentence,
        │            built FROM the same sub-scores that drove the rank — not
        │            an independent LLM call, so it can't contradict the rank
        │            and can't hallucinate a skill that isn't in the profile.
        ▼
 ranker.py    ──► selects top N, writes the spec-compliant CSV
```

### Why no LLM call in the ranking step

The spec is explicit: *no hosted LLM API calls during ranking, and calling a
local LLM per-candidate at 100K scale won't fit 5 minutes on CPU either.* The
reasoning generator instead assembles natural-language sentences directly from
the computed sub-scores (`reasoning.py`). This is a deliberate trade-off, and
it has a real upside for the Stage-4 manual review: every claim in the
generated reasoning is traceable to an actual field value, so it structurally
can't hallucinate a skill the candidate doesn't have, and it can't produce
glowing language for a candidate who scored low (the same `disqualifiers` /
`keyword_stuffing_suspected` / sub-score thresholds that drove the rank also
drive which concern sentence gets attached).

If you want to add an LLM-as-judge pass on top of this — e.g., to re-rank only
the top 20-30 after the cheap pipeline has done the heavy lifting — that's a
good Stage-2 enhancement and stays within budget because it's only running on
a few dozen candidates, not 100K. It's not wired in here because it would
violate "no hosted LLM calls during ranking" unless run as a clearly-separated,
optional, local-only step — see "Possible extensions" below.

## Module map

| File | Responsibility |
|---|---|
| `rank.py` | CLI entrypoint (the single reproduce command) |
| `src/config.py` | **The only file you should need to edit if the JD changes** — skill taxonomy, weights, disqualifier thresholds |
| `src/jd_requirements.py` | Plain-language JD facets used for semantic matching |
| `src/data_loader.py` | json / jsonl / jsonl.gz streaming reader |
| `src/features.py` | All structured feature engineering |
| `src/honeypot.py` | Impossible-profile detection |
| `src/semantic.py` | Pluggable TF-IDF / sentence-transformer backend |
| `src/scoring.py` | Combines everything into the final score |
| `src/reasoning.py` | Fact-grounded justification generator |
| `src/ranker.py` | Orchestration + CSV writer |
| `scripts/precompute_embeddings.py` | Optional: cache a real sentence-transformer model ahead of time |
| `tests/test_pipeline.py` | Unit tests for honeypot detection + scoring invariants |

## Honest limitations

- **Honeypot detection is heuristic, not ground truth.** It catches clear
  numeric contradictions (skill duration longer than the candidate's career,
  overlapping "current" roles, date/duration mismatches). It will not catch
  every honeypot in the real dataset, and conservatively only excludes a
  profile when ≥2 independent flags fire, to avoid false-positives on genuine
  candidates with messy-but-real data.
- **Pure-research-only and closed-source-without-external-validation
  disqualifiers** (JD section "what we mean by 5-9 years") aren't implemented
  — the schema doesn't carry a clean "research lab" or "publications" field to
  key off of. Flagged as a known gap rather than faked.
- **TF-IDF is the honest default**, not a corner cut: it's what makes the
  ranking step have zero network dependency and trivial CPU cost at 100K
  scale. The sentence-transformer backend is a real upgrade path (see below)
  for anyone running this with more compute headroom in precomputation.

## Possible extensions (not required, but natural next steps)

1. **Enable real dense embeddings**: run `scripts/precompute_embeddings.py`
   once (needs network, that's fine — it's precomputation, not ranking), then
   `semantic.get_backend("sentence-transformer")` is used automatically.
2. **LLM-as-judge re-rank of the top 20-30** using a small local model (e.g.
   via `llama.cpp` or `ollama`, no hosted API) purely to sanity-check/refine
   the final ordering and reasoning prose — keep it strictly after the cheap
   pipeline has cut 100K down to a few dozen, to stay inside the time budget.
3. **Learning-to-rank**: once `redrob_signals` ground-truth tiers are
   released post-competition, `COMPONENT_WEIGHTS` could be learned (e.g. via
   gradient-boosted ranking) instead of hand-set — the feature vector this
   pipeline already produces per candidate is ready to feed straight into that.

## Methodology summary (for `submission_metadata.yaml`)

> Multi-stage hybrid ranker. Stage 1 excludes heuristically-detected honeypots
> (impossible skill-duration/experience ratios, overlapping current roles,
> date/duration mismatches). Stage 2 computes 9 weighted fit components per
> candidate: title category, trust-weighted must-have/nice-to-have skill
> coverage, evaluation-framework + production-retrieval phrase mining,
> TF-IDF semantic similarity of career narrative against 6 plain-language JD
> facets, experience-years fit curve, career-trajectory stability, location
> fit, and notice-period fit. A skill-narrative-coherence discount defeats
> keyword-stuffing by distrusting AI-skill claims unsupported by title or
> career-history text. Stage 3 applies a behavioral-signal multiplier
> (recency, recruiter responsiveness, interview completion, verification,
> profile completeness) and 6 hard disqualifier penalties taken directly from
> the JD's explicit "do not want" list (consulting-only career, vision/speech-
> only with no NLP, framework-tourism, architecture-only roles, title-chasing,
> no-visa-no-relocation). Stage 4 generates fact-grounded reasoning directly
> from the computed sub-scores (no LLM call, so it can't hallucinate or
> contradict the rank). Runtime on the full 100K pool: ~107s, ~2.7GB RAM.
