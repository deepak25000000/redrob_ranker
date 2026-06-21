#!/usr/bin/env python3
"""
scripts/precompute_embeddings.py — OPTIONAL upgrade path.

Run this once, ahead of time, on a machine with network access, to cache a
real sentence-transformer model locally. After this has run once, rank.py's
"auto" semantic backend will pick it up automatically and the ranking step
itself still makes zero network calls (satisfying the compute constraints —
the network usage happens here, in precomputation, not in the ranking step).

    pip install sentence-transformers
    python scripts/precompute_embeddings.py

This does not change rank.py's behavior unless the import succeeds AND the
model is cached; otherwise rank.py silently keeps using the TF-IDF backend.
"""

import sys


def main():
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print("sentence-transformers not installed. Run: pip install sentence-transformers")
        sys.exit(1)

    print("Downloading + caching all-MiniLM-L6-v2 (small, CPU-friendly, ~80MB)...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    test_vec = model.encode(["sanity check sentence"])
    print(f"Cached OK. Embedding dim: {test_vec.shape[-1]}")
    print("rank.py will now use the sentence-transformer backend automatically.")


if __name__ == "__main__":
    main()
