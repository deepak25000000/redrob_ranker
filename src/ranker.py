"""
ranker.py — Orchestrates the full pipeline: load -> score -> select top N -> write CSV.

This is the module rank.py (the CLI) calls. Kept separate from the CLI so it's
also directly unit-testable / importable from a notebook or the hackathon
sandbox without going through argparse.
"""

import csv
import time
from typing import List, Dict, Any

from . import config
from .data_loader import load_candidates
from .scoring import score_all
from .reasoning import generate_reasoning


def rank_candidates(candidates: List[Dict[str, Any]], top_n: int = config.TOP_N):
    results, honeypot_count, honeypots_info = score_all(candidates, top_n=top_n)
    top = results[:top_n]

    for r in top:
        r["reasoning"] = generate_reasoning(r)

    return top, honeypot_count, len(candidates) - honeypot_count, honeypots_info


def write_submission_csv(ranked: List[Dict[str, Any]], out_path: str) -> None:
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["candidate_id", "rank", "score", "reasoning"])
        for i, r in enumerate(ranked, start=1):
            writer.writerow([r["candidate_id"], i, r["score"], r["reasoning"]])


def run(candidates_path: str, out_path: str, top_n: int = config.TOP_N, verbose: bool = True):
    t0 = time.time()
    candidates = load_candidates(candidates_path)
    t1 = time.time()
    if verbose:
        print(f"Loaded {len(candidates)} candidates in {t1 - t0:.2f}s")

    effective_n = min(top_n, len(candidates))
    if effective_n < top_n and verbose:
        print(
            f"WARNING: only {len(candidates)} candidates available — "
            f"writing top {effective_n}, not the required {top_n}. "
            "Run against the full candidates.jsonl(.gz) for a spec-compliant submission."
        )

    ranked, honeypot_count, scored_count, _honeypots_info = rank_candidates(candidates, top_n=effective_n)
    t2 = time.time()
    if verbose:
        print(f"Scored {scored_count} candidates ({honeypot_count} excluded as honeypots) in {t2 - t1:.2f}s")

    write_submission_csv(ranked, out_path)
    t3 = time.time()
    if verbose:
        print(f"Wrote {len(ranked)} rows to {out_path} in {t3 - t2:.2f}s")
        print(f"Total runtime: {t3 - t0:.2f}s")

    return ranked, honeypot_count
