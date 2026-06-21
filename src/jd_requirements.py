"""
jd_requirements.py — Canonical text representations of what the JD is actually
asking for, used as the "query side" of the semantic similarity match.

These are deliberately written in the language a candidate's *career history*
would use if they'd actually done the work — not in JD-buzzword form — so that
a plain-language candidate ("built a recommendation system that improved
conversion") scores well against them even without saying "RAG" or "Pinecone".
"""

JD_FACETS = {
    "embeddings_retrieval": (
        "Built and deployed an embeddings-based retrieval system to real users in "
        "production. Worked with sentence embeddings, dense vector representations, "
        "or transformer-based encoders. Handled embedding drift, index refresh, and "
        "retrieval quality regression over time in a live system."
    ),
    "vector_db_hybrid_search": (
        "Operated a vector database or hybrid search infrastructure in production: "
        "combined dense vector retrieval with traditional keyword or BM25 search. "
        "Owned the operational side of a search index serving real query traffic."
    ),
    "ranking_recommendation": (
        "Owned the ranking layer of a search, recommendation, or discovery product. "
        "Trained and shipped ranking models, designed features from user behavior and "
        "content signals, and iterated on what to optimize for in collaboration with product."
    ),
    "evaluation_rigor": (
        "Designed an evaluation framework for a ranking or retrieval system: offline "
        "metrics like NDCG, MRR, or MAP, correlated against online A/B test outcomes, "
        "to know whether a model change actually helped real users."
    ),
    "shipper_not_just_researcher": (
        "Shipped a working system fast even when the underlying approach was not yet "
        "optimal, then iterated based on real user feedback rather than waiting for a "
        "perfect solution. Comfortable owning both the modeling and the product tradeoffs."
    ),
    "ideal_candidate_narrative": (
        "Six to eight years of experience, several years in applied ML or AI roles at a "
        "product company rather than a pure services or consulting firm. Has shipped an "
        "end-to-end ranking, search, or recommendation system to real users at meaningful "
        "scale, and has strong, defensible opinions about retrieval, evaluation, and when "
        "to fine-tune versus prompt an LLM."
    ),
}

JD_FACET_NAMES = list(JD_FACETS.keys())
JD_FACET_TEXTS = list(JD_FACETS.values())
