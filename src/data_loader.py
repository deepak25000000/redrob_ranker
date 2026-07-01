"""
data_loader.py — Reads candidate records from any of the formats the hackathon
bundle ships in: pretty-printed .json (array), .jsonl, or .jsonl.gz.

Streams where possible so a 100K-row / ~465MB uncompressed pool doesn't need to
be held as a giant pretty-printed structure in memory at once.
"""

import gzip
import io
try:
    import orjson
    _loads = orjson.loads
except ImportError:
    import json
    _loads = json.loads
import json as _json_stdlib  # kept for CSV/Excel cell parsing and json.load()
from pathlib import Path
from typing import Iterator, Dict, Any

_READ_BUFFER_SIZE = 1 << 20  # 1 MiB — reduces syscall overhead on large JSONL files


def iter_candidates(path: str) -> Iterator[Dict[str, Any]]:
    """Yield candidate dicts one at a time regardless of source format."""
    p = Path(path)
    suffixes = "".join(p.suffixes).lower()

    if suffixes.endswith(".jsonl.gz"):
        with gzip.open(p, "rt", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    yield _loads(line)

    elif suffixes.endswith(".jsonl"):
        with open(p, "rb", buffering=_READ_BUFFER_SIZE) as f:
            for line in f:
                line = line.strip()
                if line:
                    yield _loads(line)

    elif suffixes.endswith(".json.gz"):
        with gzip.open(p, "rb") as f:
            data = _loads(f.read())
        for rec in data:
            yield rec

    elif suffixes.endswith(".json"):
        with open(p, "rb") as f:
            data = _loads(f.read())
        for rec in data:
            yield rec

    elif suffixes.endswith(".csv"):
        import pandas as pd
        df = pd.read_csv(p)
        records = df.to_dict("records")
        for d in records:
            for k, v in d.items():
                if isinstance(v, str) and (v.startswith('[') or v.startswith('{')):
                    try:
                        d[k] = _loads(v)
                    except Exception:
                        pass
            yield d

    elif suffixes.endswith(".xlsx") or suffixes.endswith(".xls"):
        import pandas as pd
        df = pd.read_excel(p)
        records = df.to_dict("records")
        for d in records:
            for k, v in d.items():
                if isinstance(v, str) and (v.startswith('[') or v.startswith('{')):
                    try:
                        d[k] = _loads(v)
                    except Exception:
                        pass
            yield d

    else:
        raise ValueError(
            f"Unrecognized candidate file extension for '{path}'. "
            "Expected .json, .jsonl, .jsonl.gz, .csv, or .xlsx"
        )


def load_candidates(path: str) -> list:
    """Materialize all candidates into a list (fine up to ~100K small records)."""
    return list(iter_candidates(path))
