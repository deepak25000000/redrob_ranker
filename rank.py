#!/usr/bin/env python3
"""
rank.py — Single-command entrypoint that produces the submission CSV.

    python rank.py --candidates ./candidates.jsonl.gz --out ./submission.csv

Designed to satisfy submission_spec.md Section 10.3: one command, CPU only,
no network calls, completes well within the 5-minute / 16GB budget for the
structured+TF-IDF scoring path. (If you swap in the optional sentence-transformer
backend, run scripts/precompute_embeddings.py ahead of time — see README.)
"""

import argparse
import sys

from src.ranker import run
from src import config


def main():
    parser = argparse.ArgumentParser(description="Rank candidates for the Redrob Senior AI Engineer JD.")
    parser.add_argument("--candidates", required=True, help="Path to candidates file (.json/.jsonl/.jsonl.gz)")
    parser.add_argument("--out", required=True, help="Path to write the ranked submission CSV")
    parser.add_argument("--top-n", type=int, default=config.TOP_N, help="Number of ranked rows to output (default 100)")
    parser.add_argument("--quiet", action="store_true", help="Suppress progress logging")
    args = parser.parse_args()

    run(args.candidates, args.out, top_n=args.top_n, verbose=not args.quiet)


if __name__ == "__main__":
    sys.exit(main())
