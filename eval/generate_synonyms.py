"""
Generate model-agnostic synonym mappings for ground truth tags.

Takes unique tags from tagging_ground_truth.jsonl and uses Claude to generate
acceptable synonyms/variants that other vision models might use for the same
concept. Saves as datasets/tag_synonyms.json.

Usage:
    AWS_PROFILE=picai-cdk AWS_DEFAULT_REGION=us-east-1 python generate_synonyms.py

    # Dry run (show tags, don't call API)
    python generate_synonyms.py --dry-run
"""

import argparse
import json
import sys
from pathlib import Path

import boto3

DATASETS_DIR = Path(__file__).parent / "datasets"
GROUND_TRUTH_PATH = DATASETS_DIR / "tagging_ground_truth.jsonl"
SYNONYMS_PATH = DATASETS_DIR / "tag_synonyms.json"

MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0"


def extract_unique_tags() -> list[str]:
    """Extract all unique tags from ground truth (correct + missing + incorrect)."""
    tags = set()
    with open(GROUND_TRUTH_PATH) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            for t in entry.get("correct_tags", []):
                tags.add(t.lower().strip())
            for t in entry.get("missing_tags", []):
                tags.add(t.lower().strip())
            # Include incorrect tags too — other models might legitimately produce them
            for t in entry.get("incorrect_tags", []):
                tags.add(t.lower().strip())
    return sorted(tags)


def generate_synonyms_batch(client, tags: list[str]) -> dict[str, list[str]]:
    """Send a batch of tags to Claude and get synonym mappings back."""
    prompt = f"""I have a set of photo tags used as ground truth labels for evaluating AI vision models. Different models use different vocabulary for the same concepts (e.g., Azure says "dog" but Rekognition says "Canine" and Claude says "small fluffy dog").

For each tag below, generate 3-8 acceptable synonyms or variant phrasings that other vision models might use for the SAME visual concept. Include:
- Singular/plural forms
- More specific terms (e.g., "dog" → "puppy", "golden retriever", "canine")
- More general terms (e.g., "golden retriever" → "dog", "animal")
- Common alternative phrasings (e.g., "indoor" → "interior", "inside")
- Descriptive variants (e.g., "beach" → "sandy shore", "coastline")

Do NOT include unrelated concepts. Only true synonyms or closely related variants.

For people-count tags like "1 person", "2 people", etc., just return an empty list [] since these are exact counts.

Return ONLY a valid JSON object mapping each tag to its synonym array. No markdown, no explanation.

Tags:
{json.dumps(tags)}"""

    response = client.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 8192,
            "messages": [{"role": "user", "content": prompt}],
        }),
    )

    result = json.loads(response["body"].read())
    text = result["content"][0]["text"]

    # Parse JSON response (strip any markdown fences if present)
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    return json.loads(text)


def main():
    parser = argparse.ArgumentParser(description="Generate tag synonym mappings")
    parser.add_argument("--dry-run", action="store_true", help="Show tags without calling API")
    parser.add_argument("--batch-size", type=int, default=50, help="Tags per API call")
    args = parser.parse_args()

    all_tags = extract_unique_tags()
    print(f"Extracted {len(all_tags)} unique tags from ground truth")

    if args.dry_run:
        for t in all_tags:
            print(f"  {t}")
        return

    client = boto3.client("bedrock-runtime", region_name="us-east-1")
    synonyms: dict[str, list[str]] = {}

    # Process in batches to stay within token limits
    batches = [all_tags[i:i + args.batch_size] for i in range(0, len(all_tags), args.batch_size)]

    for i, batch in enumerate(batches):
        print(f"Processing batch {i + 1}/{len(batches)} ({len(batch)} tags)...")
        try:
            batch_result = generate_synonyms_batch(client, batch)
            synonyms.update(batch_result)
            print(f"  Got synonyms for {len(batch_result)} tags")
        except Exception as e:
            print(f"  ERROR: {e}")
            # Fall back to empty synonyms for this batch
            for tag in batch:
                if tag not in synonyms:
                    synonyms[tag] = []

    # Ensure every tag has an entry (even if empty)
    for tag in all_tags:
        if tag not in synonyms:
            synonyms[tag] = []

    # Save
    DATASETS_DIR.mkdir(parents=True, exist_ok=True)
    with open(SYNONYMS_PATH, "w") as f:
        json.dump(synonyms, f, indent=2, sort_keys=True)

    total_synonyms = sum(len(v) for v in synonyms.values())
    tags_with_synonyms = sum(1 for v in synonyms.values() if v)
    print(f"\nSaved {len(synonyms)} tag entries to {SYNONYMS_PATH}")
    print(f"  {tags_with_synonyms} tags have synonyms ({total_synonyms} total synonyms)")
    print(f"  {len(synonyms) - tags_with_synonyms} tags have empty synonym lists")

    # Show a few examples
    print("\nExamples:")
    examples = ["dog", "indoor", "beach", "food", "tree", "building", "sunset"]
    for ex in examples:
        if ex in synonyms and synonyms[ex]:
            print(f"  {ex}: {synonyms[ex]}")


if __name__ == "__main__":
    main()
