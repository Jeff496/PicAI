"""
Phase 4 — Hyperparameter Sweep for RAG Pipeline

Grid-searches over search parameters (k, minScore, relativeCutoff) by calling
the chat API with per-request overrides. For each combo, runs all golden queries
and computes Photo Display Accuracy (P/R/F1).

Usage:
    # Default grid (100 combos, ~50 min)
    python run_sweep.py

    # Quick grid (fewer combos, ~15 min)
    python run_sweep.py --quick

    # Custom grid
    python run_sweep.py --k 10 15 20 --min-score 0.3 0.4 0.5 --rel-cutoff 0.5 0.6 0.75

    # Dry run (shows grid, doesn't call API)
    python run_sweep.py --dry-run

    # Resume from checkpoint
    python run_sweep.py --resume
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

DATASETS_DIR = Path(__file__).parent / "datasets"
RESULTS_DIR = Path(__file__).parent / "results"
CHECKPOINT_PATH = RESULTS_DIR / "sweep_checkpoint.json"

QUERY_DELAY_SEC = 1.0

# Default grid values
DEFAULT_K = [10, 15, 20, 25, 30]
DEFAULT_MIN_SCORE = [0.3, 0.35, 0.4, 0.45, 0.5]
DEFAULT_REL_CUTOFF = [0.5, 0.6, 0.7, 0.75]

QUICK_K = [10, 20, 30]
QUICK_MIN_SCORE = [0.3, 0.4, 0.5]
QUICK_REL_CUTOFF = [0.5, 0.65, 0.75]

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def load_golden() -> list[dict]:
    path = DATASETS_DIR / "rag_golden.jsonl"
    entries = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    return entries


# ---------------------------------------------------------------------------
# Chat API with search param overrides
# ---------------------------------------------------------------------------


def query_chat(
    question: str,
    group_ids: list[str] | None = None,
    search_params: dict | None = None,
) -> dict:
    body: dict = {"message": question, "userId": USER_ID}
    if group_ids:
        body["groupIds"] = group_ids
    if search_params:
        body["searchParams"] = search_params

    resp = requests.post(CHAT_API_URL, json=body, timeout=60)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


def compute_photo_accuracy(
    retrieved_ids: list[str], expected_ids: list[str]
) -> dict[str, float]:
    retrieved = set(retrieved_ids)
    expected = set(expected_ids)

    if not expected and not retrieved:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0}
    if not expected:
        return {"precision": 0.0, "recall": 1.0, "f1": 0.0}
    if not retrieved:
        return {"precision": 1.0, "recall": 0.0, "f1": 0.0}

    tp = len(retrieved & expected)
    precision = tp / len(retrieved)
    recall = tp / len(expected)
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    return {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4)}


def mean_of(values: list[float]) -> float:
    return round(sum(values) / len(values), 4) if values else 0.0


# ---------------------------------------------------------------------------
# Sweep logic
# ---------------------------------------------------------------------------


def combo_key(k: int, min_score: float, rel_cutoff: float) -> str:
    return f"k={k}_min={min_score}_rel={rel_cutoff}"


def run_combo(
    golden: list[dict],
    k: int,
    min_score: float,
    rel_cutoff: float,
    delay: float,
) -> dict:
    """Run all golden queries for one parameter combo and return aggregate metrics."""
    search_params = {"k": k, "minScore": min_score, "relativeCutoff": rel_cutoff}
    per_query = []
    total_input_tokens = 0
    total_output_tokens = 0
    latencies = []

    for i, entry in enumerate(golden):
        question = entry["question"]
        category = entry["category"]
        group_ids = GROUP_IDS if category == "group-based" else None

        try:
            response = query_chat(question, group_ids, search_params)
            data = response.get("data", {})

            retrieved_ids = [p["photoId"] for p in data.get("photos", [])]
            accuracy = compute_photo_accuracy(retrieved_ids, entry["expected_photo_ids"])

            usage = data.get("usage", {})
            total_input_tokens += usage.get("inputTokens", 0)
            total_output_tokens += usage.get("outputTokens", 0)

            latency = data.get("latency", {})
            if "totalMs" in latency:
                latencies.append(latency["totalMs"])

            per_query.append({
                "question": question,
                "category": category,
                "expected_count": len(entry["expected_photo_ids"]),
                "retrieved_count": len(retrieved_ids),
                "precision": accuracy["precision"],
                "recall": accuracy["recall"],
                "f1": accuracy["f1"],
            })
        except Exception as e:
            per_query.append({
                "question": question,
                "category": category,
                "expected_count": len(entry["expected_photo_ids"]),
                "retrieved_count": 0,
                "precision": 0.0,
                "recall": 0.0,
                "f1": 0.0,
                "error": str(e),
            })

        if i < len(golden) - 1:
            time.sleep(delay)

    # Aggregate
    precisions = [q["precision"] for q in per_query]
    recalls = [q["recall"] for q in per_query]
    f1s = [q["f1"] for q in per_query]

    # By category
    categories: dict[str, list[dict]] = {}
    for q in per_query:
        categories.setdefault(q["category"], []).append(q)

    by_category = {}
    for cat, queries in sorted(categories.items()):
        by_category[cat] = {
            "count": len(queries),
            "precision": mean_of([q["precision"] for q in queries]),
            "recall": mean_of([q["recall"] for q in queries]),
            "f1": mean_of([q["f1"] for q in queries]),
        }

    return {
        "params": {"k": k, "minScore": min_score, "relativeCutoff": rel_cutoff},
        "overall": {
            "precision": mean_of(precisions),
            "recall": mean_of(recalls),
            "f1": mean_of(f1s),
        },
        "by_category": by_category,
        "cost": {
            "total_input_tokens": total_input_tokens,
            "total_output_tokens": total_output_tokens,
        },
        "avg_latency_ms": round(mean_of(latencies)) if latencies else 0,
        "per_query": per_query,
    }


def load_checkpoint() -> dict:
    if CHECKPOINT_PATH.exists():
        with open(CHECKPOINT_PATH) as f:
            return json.load(f)
    return {"completed": {}}


def save_checkpoint(checkpoint: dict):
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(CHECKPOINT_PATH, "w") as f:
        json.dump(checkpoint, f, indent=2)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Phase 4 — RAG Hyperparameter Sweep")
    parser.add_argument("--k", nargs="+", type=int, default=None, help="k values to test")
    parser.add_argument("--min-score", nargs="+", type=float, default=None, help="minScore values")
    parser.add_argument("--rel-cutoff", nargs="+", type=float, default=None, help="relativeCutoff values")
    parser.add_argument("--quick", action="store_true", help="Use smaller grid (~27 combos)")
    parser.add_argument("--delay", type=float, default=QUERY_DELAY_SEC, help="Delay between queries (sec)")
    parser.add_argument("--dry-run", action="store_true", help="Print grid without running")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    args = parser.parse_args()

    # Build grid
    if args.quick:
        k_values = args.k or QUICK_K
        min_values = args.min_score or QUICK_MIN_SCORE
        rel_values = args.rel_cutoff or QUICK_REL_CUTOFF
    else:
        k_values = args.k or DEFAULT_K
        min_values = args.min_score or DEFAULT_MIN_SCORE
        rel_values = args.rel_cutoff or DEFAULT_REL_CUTOFF

    combos = [(k, ms, rc) for k in k_values for ms in min_values for rc in rel_values]

    golden = load_golden()
    total_queries = len(combos) * len(golden)
    est_minutes = total_queries * (args.delay + 1.5) / 60  # ~1.5s per API call + delay

    print(f"=== RAG Hyperparameter Sweep ===")
    print(f"Grid: k={k_values}, minScore={min_values}, relativeCutoff={rel_values}")
    print(f"Combos: {len(combos)}, Queries per combo: {len(golden)}, Total API calls: {total_queries}")
    print(f"Estimated time: ~{est_minutes:.0f} minutes")
    print()

    if args.dry_run:
        print("Dry run — grid preview:")
        for i, (k, ms, rc) in enumerate(combos):
            print(f"  [{i+1:3d}] k={k:2d}  minScore={ms:.2f}  relativeCutoff={rc:.2f}")
        return

    # Load checkpoint if resuming
    checkpoint = load_checkpoint() if args.resume else {"completed": {}}
    already_done = set(checkpoint.get("completed", {}).keys())
    if already_done:
        print(f"Resuming: {len(already_done)} combos already completed, {len(combos) - len(already_done)} remaining")
        print()

    results = list(checkpoint.get("completed", {}).values())
    start_time = time.time()
    combos_remaining = [(k, ms, rc) for k, ms, rc in combos if combo_key(k, ms, rc) not in already_done]

    for idx, (k, ms, rc) in enumerate(combos_remaining):
        key = combo_key(k, ms, rc)
        overall_idx = len(already_done) + idx + 1
        elapsed = time.time() - start_time
        rate = (idx / elapsed * 60) if elapsed > 0 and idx > 0 else 0

        print(f"[{overall_idx}/{len(combos)}] k={k:2d}  minScore={ms:.2f}  relCutoff={rc:.2f}", end="")
        if rate > 0:
            remaining = (len(combos_remaining) - idx) / rate if rate > 0 else 0
            print(f"  ({rate:.1f} combos/min, ~{remaining:.0f} min left)", end="")
        print(" ...", flush=True)

        result = run_combo(golden, k, ms, rc, args.delay)
        results.append(result)

        acc = result["overall"]
        print(f"       P={acc['precision']:.3f}  R={acc['recall']:.3f}  F1={acc['f1']:.3f}  "
              f"tokens={result['cost']['total_input_tokens']+result['cost']['total_output_tokens']}  "
              f"latency={result['avg_latency_ms']}ms")

        # Save checkpoint after each combo
        checkpoint["completed"][key] = result
        save_checkpoint(checkpoint)

    # Sort by F1 descending
    results.sort(key=lambda r: r["overall"]["f1"], reverse=True)

    # Summary
    print()
    print("=" * 80)
    print("  TOP 10 CONFIGURATIONS (by F1)")
    print("=" * 80)
    print(f"{'Rank':>4}  {'k':>3}  {'minScore':>8}  {'relCutoff':>9}  {'Prec':>6}  {'Recall':>6}  {'F1':>6}  {'Tokens':>7}  {'Latency':>8}")
    print("-" * 80)

    for i, r in enumerate(results[:10]):
        p = r["params"]
        a = r["overall"]
        tokens = r["cost"]["total_input_tokens"] + r["cost"]["total_output_tokens"]
        print(f"{i+1:4d}  {p['k']:3d}  {p['minScore']:8.2f}  {p['relativeCutoff']:9.2f}  "
              f"{a['precision']:6.3f}  {a['recall']:6.3f}  {a['f1']:6.3f}  {tokens:7d}  {r['avg_latency_ms']:7d}ms")

    # Baseline comparison
    baseline = next((r for r in results if r["params"]["k"] == 10
                     and r["params"]["minScore"] == 0.5
                     and r["params"]["relativeCutoff"] == 0.75), None)

    best = results[0]
    print()
    print(f"BEST:     k={best['params']['k']}  minScore={best['params']['minScore']}  "
          f"relativeCutoff={best['params']['relativeCutoff']}  "
          f"F1={best['overall']['f1']:.3f}")
    if baseline:
        delta = best["overall"]["f1"] - baseline["overall"]["f1"]
        print(f"BASELINE: k=10  minScore=0.5  relativeCutoff=0.75  "
              f"F1={baseline['overall']['f1']:.3f}")
        print(f"DELTA:    F1 {'+' if delta >= 0 else ''}{delta:.3f}")

    # Category breakdown for best config
    print()
    print("Best config — by category:")
    for cat, metrics in sorted(best["by_category"].items()):
        print(f"  {cat:15s}  P={metrics['precision']:.3f}  R={metrics['recall']:.3f}  F1={metrics['f1']:.3f}  (n={metrics['count']})")

    # Save full results
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "golden_dataset": "eval/datasets/rag_golden.jsonl",
            "total_queries": len(golden),
            "total_combos": len(combos),
            "grid": {
                "k": k_values,
                "minScore": min_values,
                "relativeCutoff": rel_values,
            },
            "chat_api": CHAT_API_URL,
            "userId": USER_ID,
            "elapsed_seconds": round(time.time() - start_time),
        },
        "best": {
            "params": best["params"],
            "overall": best["overall"],
            "by_category": best["by_category"],
            "cost": best["cost"],
            "avg_latency_ms": best["avg_latency_ms"],
        },
        "baseline": {
            "params": baseline["params"] if baseline else None,
            "overall": baseline["overall"] if baseline else None,
        },
        "all_results": [
            {
                "params": r["params"],
                "overall": r["overall"],
                "by_category": r["by_category"],
                "cost": r["cost"],
                "avg_latency_ms": r["avg_latency_ms"],
            }
            for r in results
        ],
    }

    output_path = RESULTS_DIR / "tuning_results.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nResults saved to {output_path}")

    # Clean up checkpoint on successful completion
    if CHECKPOINT_PATH.exists():
        CHECKPOINT_PATH.unlink()
        print("Checkpoint file removed (sweep complete).")


if __name__ == "__main__":
    main()
