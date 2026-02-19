"""
Phase 2 — RAGAS Baseline + Photo Display Accuracy

Runs all golden queries against the live chat API, computes custom retrieval
metrics (Photo Display Accuracy) and optionally RAGAS LLM-judged metrics
(Faithfulness, ResponseRelevancy), then saves results to eval/results/baseline.json.

Usage:
    # Full run (custom metrics + RAGAS via Bedrock)
    AWS_PROFILE=picai-cdk AWS_DEFAULT_REGION=us-east-1 python run_baseline.py

    # Custom metrics only (no AWS credentials needed)
    python run_baseline.py --skip-ragas
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CHAT_API_URL = "https://eh874zrdv2.execute-api.us-east-1.amazonaws.com/v1/chat"
USER_ID = "b1741581-3d2a-4591-a0ea-8f15ff8b5db7"
GROUP_IDS = ["9c8d74a6-e5fc-4ee1-a898-bddaaaa0d4f2"]

JUDGE_LLM_MODEL = "bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0"
JUDGE_EMBED_MODEL = "bedrock/amazon.titan-embed-text-v2:0"

DATASETS_DIR = Path(__file__).parent / "datasets"
RESULTS_DIR = Path(__file__).parent / "results"

QUERY_DELAY_SEC = 1.0  # delay between API calls

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def load_golden() -> list[dict]:
    """Load the golden RAG evaluation dataset."""
    path = DATASETS_DIR / "rag_golden.jsonl"
    entries = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    print(f"Loaded {len(entries)} golden queries from {path.name}")
    return entries


# ---------------------------------------------------------------------------
# Chat API
# ---------------------------------------------------------------------------


def query_chat(question: str, group_ids: list[str] | None = None) -> dict:
    """Call the chat API and return the parsed JSON response."""
    body: dict = {"message": question, "userId": USER_ID}
    if group_ids:
        body["groupIds"] = group_ids

    resp = requests.post(CHAT_API_URL, json=body, timeout=60)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Photo Display Accuracy
# ---------------------------------------------------------------------------


def compute_photo_accuracy(
    retrieved_ids: list[str], expected_ids: list[str]
) -> dict[str, float]:
    """Compute precision, recall, and F1 for photo retrieval."""
    retrieved = set(retrieved_ids)
    expected = set(expected_ids)

    # True negative: both empty
    if not expected and not retrieved:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0}
    # False positive: retrieved photos when none expected
    if not expected:
        return {"precision": 0.0, "recall": 1.0, "f1": 0.0}
    # Miss: expected photos but retrieved none
    if not retrieved:
        return {"precision": 1.0, "recall": 0.0, "f1": 0.0}

    tp = len(retrieved & expected)
    precision = tp / len(retrieved)
    recall = tp / len(expected)
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    return {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4)}


# ---------------------------------------------------------------------------
# Context reconstruction for RAGAS
# ---------------------------------------------------------------------------


def build_context_string(photo: dict) -> str:
    """Build a text context from a photo's metadata (tags, people, dates)."""
    parts = []
    name = photo.get("originalName", "unknown")
    parts.append(f"Photo: {name}")

    tags = photo.get("tags", [])
    if tags:
        parts.append(f"Tags: {', '.join(tags)}")

    people = photo.get("people", [])
    if people:
        parts.append(f"People: {', '.join(people)}")

    taken_at = photo.get("takenAt")
    if taken_at:
        parts.append(f"Taken: {taken_at}")

    uploaded_at = photo.get("uploadedAt")
    if uploaded_at:
        parts.append(f"Uploaded: {uploaded_at}")

    group_name = photo.get("groupName")
    if group_name:
        parts.append(f"Group: {group_name}")

    score = photo.get("score")
    if score is not None:
        parts.append(f"Similarity: {score:.3f}")

    return " | ".join(parts)


# ---------------------------------------------------------------------------
# RAGAS evaluation
# ---------------------------------------------------------------------------


def run_ragas_metrics(golden: list[dict], results: list[dict]) -> dict | None:
    """Run RAGAS Faithfulness and ResponseRelevancy on collected results.

    Returns a dict mapping question index -> {faithfulness, response_relevancy}
    or None if RAGAS setup fails.
    """
    try:
        import litellm
        from ragas.dataset_schema import EvaluationDataset, SingleTurnSample
        from ragas.embeddings.base import embedding_factory
        from ragas.llms import llm_factory
        from ragas.metrics._answer_relevance import ResponseRelevancy
        from ragas.metrics._faithfulness import Faithfulness
    except ImportError as e:
        print(f"  RAGAS import error: {e}")
        return None

    print("\nSetting up RAGAS with Bedrock via litellm...")
    print("  NOTE: Bedrock Claude structured output via litellm has known issues.")
    print("  If RAGAS fails, use --skip-ragas and see CHANGELOG.md for details.")
    try:
        llm = llm_factory(
            JUDGE_LLM_MODEL,
            provider="litellm",
            client=litellm.completion,
            adapter="instructor",
            top_p=None,  # Bedrock rejects temperature + top_p together
        )
        emb = embedding_factory(
            provider="litellm",
            model=JUDGE_EMBED_MODEL,
        )
    except Exception as e:
        print(f"  RAGAS LLM/embedding setup failed: {e}")
        return None

    # Build RAGAS samples
    samples = []
    for entry, result in zip(golden, results):
        contexts = result.get("contexts", [])
        # RAGAS needs at least one context string
        if not contexts:
            contexts = ["No matching photos were found."]

        samples.append(
            SingleTurnSample(
                user_input=entry["question"],
                response=result["response_text"],
                retrieved_contexts=contexts,
            )
        )

    dataset = EvaluationDataset(samples=samples)

    print(f"Running RAGAS metrics on {len(samples)} samples...")
    try:
        from ragas import evaluate

        ragas_result = evaluate(
            dataset=dataset,
            metrics=[Faithfulness(llm=llm), ResponseRelevancy(llm=llm, embeddings=emb)],
        )
    except Exception as e:
        print(f"  RAGAS evaluate() failed: {e}")
        return None

    # Extract per-sample scores
    df = ragas_result.to_pandas()
    per_query = {}
    for i, row in df.iterrows():
        faith = row.get("faithfulness", float("nan"))
        relevancy = row.get("response_relevancy", float("nan"))
        per_query[i] = {
            "faithfulness": round(float(faith), 4) if not (isinstance(faith, float) and faith != faith) else None,
            "response_relevancy": round(float(relevancy), 4) if not (isinstance(relevancy, float) and relevancy != relevancy) else None,
        }

    # Compute means, skipping NaN values
    faith_scores = [v["faithfulness"] for v in per_query.values() if v["faithfulness"] is not None]
    relevancy_scores = [v["response_relevancy"] for v in per_query.values() if v["response_relevancy"] is not None]
    mean_faith = sum(faith_scores) / len(faith_scores) if faith_scores else float("nan")
    mean_rel = sum(relevancy_scores) / len(relevancy_scores) if relevancy_scores else float("nan")

    print(f"  RAGAS complete. Mean faithfulness={mean_faith:.3f}, "
          f"response_relevancy={mean_rel:.3f} "
          f"({len(faith_scores)}/{len(per_query)} samples scored)")
    return per_query


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------


def mean_of(values: list[float]) -> float:
    return round(sum(values) / len(values), 4) if values else 0.0


def aggregate_results(
    per_query: list[dict], ragas_enabled: bool
) -> tuple[dict, dict]:
    """Compute overall and per-category aggregates.

    Returns (overall_dict, by_category_dict).
    """
    # -- By category --
    categories: dict[str, list[dict]] = {}
    for q in per_query:
        cat = q["category"]
        categories.setdefault(cat, []).append(q)

    by_category = {}
    for cat, queries in sorted(categories.items()):
        acc = {
            "precision": mean_of([q["photo_accuracy"]["precision"] for q in queries]),
            "recall": mean_of([q["photo_accuracy"]["recall"] for q in queries]),
            "f1": mean_of([q["photo_accuracy"]["f1"] for q in queries]),
        }
        entry: dict = {"count": len(queries), "photo_accuracy": acc}
        if ragas_enabled and queries[0].get("ragas"):
            entry["ragas"] = {
                "faithfulness": mean_of([q["ragas"]["faithfulness"] for q in queries]),
                "response_relevancy": mean_of([q["ragas"]["response_relevancy"] for q in queries]),
            }
        by_category[cat] = entry

    # -- Overall --
    overall_acc = {
        "precision": mean_of([q["photo_accuracy"]["precision"] for q in per_query]),
        "recall": mean_of([q["photo_accuracy"]["recall"] for q in per_query]),
        "f1": mean_of([q["photo_accuracy"]["f1"] for q in per_query]),
    }
    latencies = [q["latency"].get("totalMs", 0) for q in per_query if q.get("latency")]
    total_input = sum(q["usage"].get("inputTokens", 0) for q in per_query if q.get("usage"))
    total_output = sum(q["usage"].get("outputTokens", 0) for q in per_query if q.get("usage"))

    overall: dict = {
        "photo_accuracy": overall_acc,
        "avg_latency_ms": round(mean_of(latencies)),
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
    }

    if ragas_enabled and per_query[0].get("ragas"):
        overall["ragas"] = {
            "faithfulness": mean_of([q["ragas"]["faithfulness"] for q in per_query]),
            "response_relevancy": mean_of([q["ragas"]["response_relevancy"] for q in per_query]),
        }

    return overall, by_category


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="RAG Evaluation Baseline")
    parser.add_argument("--skip-ragas", action="store_true", help="Skip RAGAS metrics (no Bedrock needed)")
    args = parser.parse_args()

    golden = load_golden()

    # -- Step 1: Run all queries against the chat API --
    print(f"\nRunning {len(golden)} queries against {CHAT_API_URL}...")
    raw_results: list[dict] = []

    for i, entry in enumerate(golden):
        question = entry["question"]
        category = entry["category"]
        group_ids = GROUP_IDS if category == "group-based" else None

        print(f"  [{i+1}/{len(golden)}] ({category}) {question[:60]}...")

        try:
            response = query_chat(question, group_ids)
            data = response.get("data", {})

            retrieved_photos = data.get("photos", [])
            retrieved_ids = [p["photoId"] for p in retrieved_photos]

            # Build context strings for RAGAS
            contexts = [build_context_string(p) for p in retrieved_photos]

            raw_results.append({
                "question": question,
                "category": category,
                "expected_photo_ids": entry["expected_photo_ids"],
                "retrieved_photo_ids": retrieved_ids,
                "response_text": data.get("response", ""),
                "contexts": contexts,
                "latency": data.get("latency", {}),
                "usage": data.get("usage", {}),
            })
        except Exception as e:
            print(f"    ERROR: {e}")
            raw_results.append({
                "question": question,
                "category": category,
                "expected_photo_ids": entry["expected_photo_ids"],
                "retrieved_photo_ids": [],
                "response_text": f"ERROR: {e}",
                "contexts": [],
                "latency": {},
                "usage": {},
            })

        if i < len(golden) - 1:
            time.sleep(QUERY_DELAY_SEC)

    # -- Step 2: Compute Photo Display Accuracy --
    print("\nComputing Photo Display Accuracy...")
    for result in raw_results:
        result["photo_accuracy"] = compute_photo_accuracy(
            result["retrieved_photo_ids"], result["expected_photo_ids"]
        )

    overall_f1 = mean_of([r["photo_accuracy"]["f1"] for r in raw_results])
    overall_prec = mean_of([r["photo_accuracy"]["precision"] for r in raw_results])
    overall_rec = mean_of([r["photo_accuracy"]["recall"] for r in raw_results])
    print(f"  Overall — Precision: {overall_prec:.3f}  Recall: {overall_rec:.3f}  F1: {overall_f1:.3f}")

    # -- Step 3: RAGAS metrics (optional) --
    ragas_enabled = not args.skip_ragas
    if ragas_enabled:
        ragas_scores = run_ragas_metrics(golden, raw_results)
        if ragas_scores is not None:
            for i, result in enumerate(raw_results):
                result["ragas"] = ragas_scores.get(i, {})
        else:
            print("  RAGAS metrics skipped due to errors.")
            ragas_enabled = False

    # -- Step 4: Aggregate and save --
    per_query_output = []
    for result in raw_results:
        entry: dict = {
            "question": result["question"],
            "category": result["category"],
            "expected_photo_ids": result["expected_photo_ids"],
            "retrieved_photo_ids": result["retrieved_photo_ids"],
            "photo_accuracy": result["photo_accuracy"],
            "response_text": result["response_text"],
            "latency": result["latency"],
            "usage": result["usage"],
        }
        if ragas_enabled and result.get("ragas"):
            entry["ragas"] = result["ragas"]
        per_query_output.append(entry)

    overall, by_category = aggregate_results(per_query_output, ragas_enabled)

    output = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "golden_dataset": "eval/datasets/rag_golden.jsonl",
            "total_queries": len(golden),
            "chat_api": CHAT_API_URL,
            "userId": USER_ID,
            "ragas_enabled": ragas_enabled,
        },
        "overall": overall,
        "by_category": by_category,
        "per_query": per_query_output,
    }

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = RESULTS_DIR / "baseline.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nResults saved to {output_path}")
    print(f"Overall Photo Display Accuracy — P: {overall_prec:.3f}  R: {overall_rec:.3f}  F1: {overall_f1:.3f}")
    if ragas_enabled and "ragas" in overall:
        print(f"RAGAS — Faithfulness: {overall['ragas']['faithfulness']:.3f}  "
              f"ResponseRelevancy: {overall['ragas']['response_relevancy']:.3f}")


if __name__ == "__main__":
    main()
