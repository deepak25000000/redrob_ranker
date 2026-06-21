import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from src import config
from src.jd_requirements import JD_FACETS

data = {
    "weights": config.COMPONENT_WEIGHTS,
    "must_have_skill_groups": {k: sorted(list(v)) for k, v in config.MUST_HAVE_SKILL_GROUPS.items()},
    "nice_to_have_skill_groups": {k: sorted(list(v)) for k, v in config.NICE_TO_HAVE_SKILL_GROUPS.items()},
    "jd_facets": JD_FACETS,
    "disqualifier_rules": [
        "CONSULTING_ONLY",
        "VISION_SPEECH_ONLY",
        "FRAMEWORK_TOURISM",
        "ARCHITECTURE_ONLY",
        "TITLE_CHASING",
        "NO_VISA"
    ]
}

out_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "methodology.json")
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w") as f:
    json.dump(data, f, indent=2)

print(f"wrote {out_path}")
