"""
config.py — Encodes the Senior AI Engineer JD as structured, scoreable requirements.

This is deliberately the *only* file that should need editing if the JD changes.
Every weight, skill group, and disqualifier rule lives here so the scoring logic
in scoring.py stays generic and auditable.
"""

# ---------------------------------------------------------------------------
# Skill taxonomy — groups of synonymous / equivalent skills.
# A candidate "has" a group if they have ANY skill in it; trust in that group
# is weighted by proficiency + duration_months + endorsements (see features.py)
# so a skill listed with 0 endorsements and 2 months duration counts for far
# less than the same skill with real depth behind it. This is the main defense
# against keyword-stuffed profiles.
# ---------------------------------------------------------------------------

MUST_HAVE_SKILL_GROUPS = {
    "embeddings_retrieval": {
        "Embeddings", "Sentence Transformers", "Hugging Face Transformers",
        "Information Retrieval", "Recommendation Systems", "Vector Search",
        "BGE", "E5",
    },
    "vector_db_hybrid_search": {
        "Pinecone", "Weaviate", "Qdrant", "Milvus", "OpenSearch",
        "Elasticsearch", "FAISS", "BM25", "Haystack",
    },
    "python": {"Python"},
}

NICE_TO_HAVE_SKILL_GROUPS = {
    "fine_tuning": {"LoRA", "QLoRA", "PEFT", "Fine-tuning LLMs"},
    "learning_to_rank": {"XGBoost", "LightGBM", "Learning to Rank", "Machine Learning"},
    "mlops": {"MLflow", "Weights & Biases", "MLOps", "BentoML", "Kubeflow"},
    "deep_learning_stack": {"PyTorch", "TensorFlow", "Deep Learning", "scikit-learn"},
    "llm_tooling": {"LangChain", "Prompt Engineering", "Reinforcement Learning"},
    "distributed_systems": {"Kafka", "Kubernetes", "Microservices", "Spark", "gRPC"},
}

# Free-text phrases that signal real evaluation-framework experience even when
# the exact words don't appear in the structured skills list (this is what
# catches "plain-language" candidates who built the thing but didn't label it).
EVAL_FRAMEWORK_PHRASES = [
    "ndcg", "mrr", "map", "offline-online correlation", "offline to online",
    "a/b test", "ab test", "click-through", "relevance labeling",
    "experimentation framework", "evaluation framework", "precision",
    "recall", "revenue-per-search", "online correlation",
]

# Phrases in career_history descriptions that indicate genuine production
# embeddings/retrieval/ranking work, independent of whether the skill list
# names the exact tool. This is the core "semantic gap" catcher the JD asks for.
PRODUCTION_RETRIEVAL_PHRASES = [
    "embedding", "retrieval", "ranking model", "ranking layer", "search product",
    "discovery feed", "recommendation system", "vector search", "semantic search",
    "learning-to-rank", "feature pipeline", "relevance", "hybrid retrieval",
    "re-ranking", "reranking", "index refresh", "search infrastructure",
]

# Companies considered "pure consulting" for the consulting-only disqualifier.
CONSULTING_FIRMS = {
    "tcs", "infosys", "wipro", "accenture", "cognizant", "capgemini", "hcl",
}

# Titles that map to each broad role category (lower-cased substring match).
TITLE_CATEGORY_KEYWORDS = {
    "ml_ai_eng": [
        "machine learning", "ml engineer", "ai engineer", "applied ml",
        "recommendation systems engineer", "nlp engineer", "search engineer",
        "data scientist", "research scientist", "ranking engineer",
        "computer vision engineer",
    ],
    "swe_backend": [
        "software engineer", "backend engineer", "full stack", "devops",
        "cloud engineer", "java developer", ".net developer", "mobile developer",
        "qa engineer", "site reliability",
    ],
    "data_eng": ["data engineer", "analytics engineer"],
    "swe_frontend": ["frontend engineer", "front end", "ui engineer"],
    "architecture_only": ["architect", "tech lead", "engineering manager", "principal engineer"],
}

NON_TECHNICAL_TITLE_MARKERS = [
    "marketing manager", "operations manager", "hr manager", "accountant",
    "business analyst", "sales executive", "customer support", "project manager",
    "civil engineer", "mechanical engineer", "graphic designer", ".net developer"
    if False else None,  # placeholder kept out intentionally
]
NON_TECHNICAL_TITLE_MARKERS = [m for m in NON_TECHNICAL_TITLE_MARKERS if m]

# Preferred locations, in descending priority. Matched against profile.location/country.
PRIMARY_LOCATIONS = ["pune", "noida"]
SECONDARY_INDIA_LOCATIONS = ["hyderabad", "mumbai", "delhi", "gurgaon", "gurugram", "ncr"]

# ---------------------------------------------------------------------------
# Component weights for the final hybrid score.
# These sum to 1.0 across the "fit" components; the behavioral modifier and
# disqualifier penalties are applied multiplicatively/subtractively afterward,
# not as part of this sum.
# ---------------------------------------------------------------------------
COMPONENT_WEIGHTS = {
    "title_fit": 0.14,
    "must_have_skill_fit": 0.24,
    "nice_to_have_skill_fit": 0.06,
    "eval_framework_fit": 0.08,
    "semantic_career_fit": 0.22,   # dense/TF-IDF similarity of career narrative to JD
    "experience_years_fit": 0.08,
    "career_trajectory_fit": 0.08,  # tenure stability, title-chasing penalty lives here
    "location_fit": 0.06,
    "notice_period_fit": 0.04,
}
assert abs(sum(COMPONENT_WEIGHTS.values()) - 1.0) < 1e-9

# Behavioral modifier bounds (multiplicative on top of the fit score).
BEHAVIORAL_MODIFIER_MIN = 0.55
BEHAVIORAL_MODIFIER_MAX = 1.15

# Hard disqualifier penalties (subtracted from final score, can drive it negative —
# negative-scoring candidates are excluded from the top 100 before ranking).
PENALTY_CONSULTING_ONLY_CAREER = 0.45
PENALTY_PURE_VISION_SPEECH_ROBOTICS_NO_NLP = 0.30
PENALTY_FRAMEWORK_TOURIST = 0.30          # only recent (<12mo) LangChain+OpenAI, no depth
PENALTY_ARCHITECTURE_ONLY_NO_RECENT_CODE = 0.20
PENALTY_TITLE_CHASER = 0.18
PENALTY_NO_VISA_NO_RELOCATE_OUTSIDE_INDIA = 0.35

# Experience band (years) — soft curve, not a hard cutoff per the JD's own framing.
EXPERIENCE_IDEAL_MIN = 5
EXPERIENCE_IDEAL_MAX = 9
EXPERIENCE_SWEET_SPOT_MIN = 6
EXPERIENCE_SWEET_SPOT_MAX = 8

# Notice period thresholds (days).
NOTICE_FULL_SCORE_MAX_DAYS = 30
NOTICE_BUYOUT_MAX_DAYS = 30

TOP_N = 100
