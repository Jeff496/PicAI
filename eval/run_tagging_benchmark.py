"""
Phase 3a — Tagging Benchmark

Measures Azure Computer Vision tag quality against the hand-labeled ground truth.
Computes precision, recall, F1 overall and per-category, analyzes confidence
distributions, and finds optimal per-category thresholds.

Usage:
    python run_tagging_benchmark.py
    python run_tagging_benchmark.py --threshold 0.6   # override global threshold
    python run_tagging_benchmark.py --provider azure   # tag provider source (default: azure)
"""

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATASETS_DIR = Path(__file__).parent / "datasets"
RESULTS_DIR = Path(__file__).parent / "results"

GROUND_TRUTH_FILE = "tagging_ground_truth.jsonl"
DEFAULT_THRESHOLD = 0.5  # current production threshold

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def load_ground_truth() -> list[dict]:
    """Load the hand-labeled tagging ground truth dataset."""
    path = DATASETS_DIR / GROUND_TRUTH_FILE
    entries = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    print(f"Loaded {len(entries)} labeled photos from {path.name}")
    return entries


# ---------------------------------------------------------------------------
# Metrics computation
# ---------------------------------------------------------------------------


def compute_tag_metrics(correct: list[str], incorrect: list[str], missing: list[str]) -> dict:
    """Compute precision, recall, and F1 for a single photo's tags.

    Precision = |correct| / (|correct| + |incorrect|)
    Recall    = |correct| / (|correct| + |missing|)
    """
    n_correct = len(correct)
    n_incorrect = len(incorrect)
    n_missing = len(missing)

    total_ai = n_correct + n_incorrect
    total_ground = n_correct + n_missing

    if total_ai == 0 and total_ground == 0:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0}
    if total_ai == 0:
        return {"precision": 1.0, "recall": 0.0, "f1": 0.0}
    if total_ground == 0:
        return {"precision": 0.0, "recall": 1.0, "f1": 0.0}

    precision = n_correct / total_ai
    recall = n_correct / total_ground
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
    }


def categorize_tags(entry: dict) -> dict[str, dict]:
    """Break down a photo's tags by their AI category.

    Returns {category: {correct: [...], incorrect: [...], missing: [...]}}
    Missing tags don't have a category from AI, so they go into an 'uncategorized' bucket.
    """
    # Build lookup: tag_lower -> category from AI tags
    tag_to_category: dict[str, str] = {}
    for ai_tag in entry["ai_tags"]:
        tag_to_category[ai_tag["tag"].lower()] = ai_tag["category"]

    by_cat: dict[str, dict] = defaultdict(lambda: {"correct": [], "incorrect": [], "missing": []})

    for tag in entry.get("correct_tags", []):
        cat = tag_to_category.get(tag.lower(), "unknown")
        by_cat[cat]["correct"].append(tag)

    for tag in entry.get("incorrect_tags", []):
        cat = tag_to_category.get(tag.lower(), "unknown")
        by_cat[cat]["incorrect"].append(tag)

    # Missing tags aren't in AI output, so no category — group them separately
    for tag in entry.get("missing_tags", []):
        by_cat["missing_from_ai"]["missing"].append(tag)

    return dict(by_cat)


def build_confidence_map(entry: dict) -> dict[str, float]:
    """Map tag (lowercase) -> confidence from AI tags."""
    return {t["tag"].lower(): t["confidence"] for t in entry["ai_tags"]}


# ---------------------------------------------------------------------------
# Threshold analysis
# ---------------------------------------------------------------------------


def analyze_thresholds(
    ground_truth: list[dict],
) -> dict:
    """Analyze how different confidence thresholds affect tag quality.

    For each AI tag across all photos, classify it as correct or incorrect
    based on the ground truth labels. Then sweep thresholds to find optimal
    per-category cutoffs.
    """
    # Collect (confidence, is_correct, category) for every AI tag
    tag_samples: list[dict] = []
    for entry in ground_truth:
        correct_set = {t.lower() for t in entry.get("correct_tags", [])}
        incorrect_set = {t.lower() for t in entry.get("incorrect_tags", [])}

        for ai_tag in entry["ai_tags"]:
            tag_lower = ai_tag["tag"].lower()
            # Only classify tags that are in the ground truth labels
            if tag_lower in correct_set:
                is_correct = True
            elif tag_lower in incorrect_set:
                is_correct = False
            else:
                # Tag not labeled (e.g., manual tags) — skip
                continue
            tag_samples.append({
                "tag": ai_tag["tag"],
                "confidence": ai_tag["confidence"],
                "category": ai_tag["category"],
                "is_correct": is_correct,
            })

    # Sweep thresholds from 0.0 to 1.0
    thresholds = [round(t * 0.05, 2) for t in range(0, 21)]  # 0.00 to 1.00

    # Overall threshold sweep
    overall_sweep = []
    for thresh in thresholds:
        above = [s for s in tag_samples if s["confidence"] >= thresh]
        if not above:
            overall_sweep.append({
                "threshold": thresh,
                "total_tags": 0,
                "correct": 0,
                "incorrect": 0,
                "precision": 0.0,
                "f1": 0.0,
            })
            continue

        correct = sum(1 for s in above if s["is_correct"])
        incorrect = len(above) - correct
        # For recall: count all correct tags in the full dataset (at any confidence)
        total_correct = sum(1 for s in tag_samples if s["is_correct"])
        # Correct tags above threshold / total correct tags
        recall_num = correct
        recall_den = total_correct
        precision = correct / len(above) if above else 0
        recall = recall_num / recall_den if recall_den > 0 else 0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0

        overall_sweep.append({
            "threshold": thresh,
            "total_tags": len(above),
            "correct": correct,
            "incorrect": incorrect,
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
        })

    # Find best overall threshold
    best_overall = max(overall_sweep, key=lambda x: x["f1"])

    # Per-category sweep
    categories = sorted(set(s["category"] for s in tag_samples))
    per_category_sweep: dict[str, list[dict]] = {}
    best_per_category: dict[str, dict] = {}

    for cat in categories:
        cat_samples = [s for s in tag_samples if s["category"] == cat]
        total_correct_in_cat = sum(1 for s in cat_samples if s["is_correct"])
        sweep = []
        for thresh in thresholds:
            above = [s for s in cat_samples if s["confidence"] >= thresh]
            if not above:
                sweep.append({"threshold": thresh, "total_tags": 0, "correct": 0,
                              "incorrect": 0, "precision": 0.0, "recall": 0.0, "f1": 0.0})
                continue
            correct = sum(1 for s in above if s["is_correct"])
            incorrect = len(above) - correct
            precision = correct / len(above) if above else 0
            recall = correct / total_correct_in_cat if total_correct_in_cat > 0 else 0
            f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0
            sweep.append({
                "threshold": thresh,
                "total_tags": len(above),
                "correct": correct,
                "incorrect": incorrect,
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "f1": round(f1, 4),
            })
        per_category_sweep[cat] = sweep
        best_per_category[cat] = max(sweep, key=lambda x: x["f1"])

    # Confidence distribution of correct vs incorrect
    correct_confs = sorted([s["confidence"] for s in tag_samples if s["is_correct"]])
    incorrect_confs = sorted([s["confidence"] for s in tag_samples if not s["is_correct"]])

    return {
        "total_tag_samples": len(tag_samples),
        "total_correct": sum(1 for s in tag_samples if s["is_correct"]),
        "total_incorrect": sum(1 for s in tag_samples if not s["is_correct"]),
        "overall_sweep": overall_sweep,
        "best_overall_threshold": best_overall,
        "per_category_sweep": per_category_sweep,
        "best_per_category_threshold": best_per_category,
        "confidence_distribution": {
            "correct": {
                "count": len(correct_confs),
                "min": round(min(correct_confs), 4) if correct_confs else None,
                "max": round(max(correct_confs), 4) if correct_confs else None,
                "mean": round(sum(correct_confs) / len(correct_confs), 4) if correct_confs else None,
                "median": round(correct_confs[len(correct_confs) // 2], 4) if correct_confs else None,
            },
            "incorrect": {
                "count": len(incorrect_confs),
                "min": round(min(incorrect_confs), 4) if incorrect_confs else None,
                "max": round(max(incorrect_confs), 4) if incorrect_confs else None,
                "mean": round(sum(incorrect_confs) / len(incorrect_confs), 4) if incorrect_confs else None,
                "median": round(incorrect_confs[len(incorrect_confs) // 2], 4) if incorrect_confs else None,
            },
        },
    }


def simulate_threshold(ground_truth: list[dict], threshold: float) -> dict:
    """Re-compute tag metrics after filtering AI tags below a given threshold.

    This simulates what would happen if we changed the CONFIDENCE_THRESHOLD
    in production.
    """
    per_photo = []
    for entry in ground_truth:
        correct_set = {t.lower() for t in entry.get("correct_tags", [])}
        incorrect_set = {t.lower() for t in entry.get("incorrect_tags", [])}
        missing_set = set(t.lower() for t in entry.get("missing_tags", []))

        # Filter AI tags by threshold
        filtered_tags = [t for t in entry["ai_tags"] if t["confidence"] >= threshold]
        filtered_tag_names = {t["tag"].lower() for t in filtered_tags}

        # Recompute correct/incorrect/missing based on filtered tags
        new_correct = [t for t in entry.get("correct_tags", []) if t.lower() in filtered_tag_names]
        new_incorrect = [t for t in entry.get("incorrect_tags", []) if t.lower() in filtered_tag_names]
        # Original missing + correct tags that got filtered out
        new_missing = list(missing_set)
        for t in entry.get("correct_tags", []):
            if t.lower() not in filtered_tag_names:
                new_missing.append(t)

        metrics = compute_tag_metrics(new_correct, new_incorrect, new_missing)
        per_photo.append(metrics)

    n = len(per_photo)
    return {
        "threshold": threshold,
        "precision": round(sum(p["precision"] for p in per_photo) / n, 4),
        "recall": round(sum(p["recall"] for p in per_photo) / n, 4),
        "f1": round(sum(p["f1"] for p in per_photo) / n, 4),
    }


# ---------------------------------------------------------------------------
# Common error patterns
# ---------------------------------------------------------------------------


def find_common_errors(ground_truth: list[dict]) -> dict:
    """Identify the most frequent incorrect and missing tags."""
    incorrect_counts: dict[str, int] = defaultdict(int)
    missing_counts: dict[str, int] = defaultdict(int)

    for entry in ground_truth:
        for tag in entry.get("incorrect_tags", []):
            incorrect_counts[tag.lower()] += 1
        for tag in entry.get("missing_tags", []):
            missing_counts[tag.lower()] += 1

    # Sort by frequency
    top_incorrect = sorted(incorrect_counts.items(), key=lambda x: -x[1])[:20]
    top_missing = sorted(missing_counts.items(), key=lambda x: -x[1])[:20]

    return {
        "top_incorrect_tags": [{"tag": t, "count": c} for t, c in top_incorrect],
        "top_missing_tags": [{"tag": t, "count": c} for t, c in top_missing],
    }


# ---------------------------------------------------------------------------
# Pretty printing
# ---------------------------------------------------------------------------


def print_summary(overall: dict, by_category: dict, threshold_analysis: dict, errors: dict):
    """Print a readable summary to stdout."""
    print("\n" + "=" * 70)
    print("TAGGING BENCHMARK RESULTS")
    print("=" * 70)

    print(f"\nDataset: {overall['total_photos']} labeled photos, "
          f"{overall['total_ai_tags']} AI tags evaluated")

    print(f"\n{'Metric':<20} {'Value':>10}")
    print("-" * 32)
    print(f"{'Precision':<20} {overall['precision']:>10.3f}")
    print(f"{'Recall':<20} {overall['recall']:>10.3f}")
    print(f"{'F1':<20} {overall['f1']:>10.3f}")

    print(f"\n--- Per-Category Breakdown ---")
    print(f"\n{'Category':<20} {'Count':>6} {'Prec':>8} {'Rec':>8} {'F1':>8}")
    print("-" * 54)
    for cat, data in sorted(by_category.items()):
        print(f"{cat:<20} {data['tag_count']:>6} {data['precision']:>8.3f} "
              f"{data['recall']:>8.3f} {data['f1']:>8.3f}")

    print(f"\n--- Confidence Threshold Analysis ---")
    dist = threshold_analysis["confidence_distribution"]
    print(f"\nCorrect tags:   mean conf = {dist['correct']['mean']:.3f}, "
          f"median = {dist['correct']['median']:.3f} "
          f"(n={dist['correct']['count']})")
    print(f"Incorrect tags: mean conf = {dist['incorrect']['mean']:.3f}, "
          f"median = {dist['incorrect']['median']:.3f} "
          f"(n={dist['incorrect']['count']})")

    best = threshold_analysis["best_overall_threshold"]
    print(f"\nBest overall threshold: {best['threshold']:.2f} "
          f"(P={best['precision']:.3f} R={best['recall']:.3f} F1={best['f1']:.3f})")

    print(f"\nBest per-category thresholds:")
    for cat, bt in sorted(threshold_analysis["best_per_category_threshold"].items()):
        print(f"  {cat:<12} threshold={bt['threshold']:.2f}  "
              f"P={bt['precision']:.3f} R={bt['recall']:.3f} F1={bt['f1']:.3f}")

    print(f"\n--- Most Common Errors ---")
    print(f"\nTop incorrect tags (Azure says yes, human says no):")
    for item in errors["top_incorrect_tags"][:10]:
        print(f"  {item['tag']:<30} {item['count']}x")

    print(f"\nTop missing tags (human says yes, Azure missed):")
    for item in errors["top_missing_tags"][:10]:
        print(f"  {item['tag']:<30} {item['count']}x")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Phase 3a — Tagging Benchmark")
    parser.add_argument("--threshold", type=float, default=None,
                        help="Simulate a custom confidence threshold (default: use existing tags as-is)")
    parser.add_argument("--provider", type=str, default="azure",
                        help="Tag provider label for result metadata (default: azure)")
    args = parser.parse_args()

    ground_truth = load_ground_truth()

    # -- Step 1: Per-photo metrics --
    print("\nComputing per-photo tag metrics...")
    per_photo_results = []
    total_correct = 0
    total_incorrect = 0
    total_missing = 0
    total_ai_tags = 0

    for entry in ground_truth:
        correct = entry.get("correct_tags", [])
        incorrect = entry.get("incorrect_tags", [])
        missing = entry.get("missing_tags", [])

        metrics = compute_tag_metrics(correct, incorrect, missing)
        by_cat = categorize_tags(entry)

        total_correct += len(correct)
        total_incorrect += len(incorrect)
        total_missing += len(missing)
        total_ai_tags += len(entry["ai_tags"])

        per_photo_results.append({
            "photoId": entry["photoId"],
            "originalName": entry["originalName"],
            "n_ai_tags": len(entry["ai_tags"]),
            "n_correct": len(correct),
            "n_incorrect": len(incorrect),
            "n_missing": len(missing),
            "metrics": metrics,
            "by_category": {
                cat: compute_tag_metrics(data["correct"], data["incorrect"], data["missing"])
                for cat, data in by_cat.items()
            },
        })

    # -- Step 2: Aggregate metrics --
    n = len(per_photo_results)
    overall = {
        "total_photos": n,
        "total_ai_tags": total_ai_tags,
        "total_correct": total_correct,
        "total_incorrect": total_incorrect,
        "total_missing": total_missing,
        "precision": round(sum(p["metrics"]["precision"] for p in per_photo_results) / n, 4),
        "recall": round(sum(p["metrics"]["recall"] for p in per_photo_results) / n, 4),
        "f1": round(sum(p["metrics"]["f1"] for p in per_photo_results) / n, 4),
    }

    # Micro-averaged metrics (total counts, not per-photo average)
    micro_prec = total_correct / (total_correct + total_incorrect) if (total_correct + total_incorrect) > 0 else 0
    micro_rec = total_correct / (total_correct + total_missing) if (total_correct + total_missing) > 0 else 0
    micro_f1 = (2 * micro_prec * micro_rec / (micro_prec + micro_rec)) if (micro_prec + micro_rec) > 0 else 0
    overall["micro_precision"] = round(micro_prec, 4)
    overall["micro_recall"] = round(micro_rec, 4)
    overall["micro_f1"] = round(micro_f1, 4)

    # -- Step 3: Per-category aggregate --
    cat_agg: dict[str, dict] = defaultdict(lambda: {"correct": 0, "incorrect": 0, "photos": 0})

    for entry in ground_truth:
        correct_set = {t.lower() for t in entry.get("correct_tags", [])}
        incorrect_set = {t.lower() for t in entry.get("incorrect_tags", [])}

        for ai_tag in entry["ai_tags"]:
            tag_lower = ai_tag["tag"].lower()
            cat = ai_tag["category"]
            if tag_lower in correct_set:
                cat_agg[cat]["correct"] += 1
            elif tag_lower in incorrect_set:
                cat_agg[cat]["incorrect"] += 1

    # Count missing tags — these don't have a category
    total_missing_count = sum(len(e.get("missing_tags", [])) for e in ground_truth)

    by_category = {}
    for cat, data in sorted(cat_agg.items()):
        total = data["correct"] + data["incorrect"]
        prec = data["correct"] / total if total > 0 else 0
        # Recall for a category is tricky since missing tags don't have categories
        # Use tag count as the denominator
        by_category[cat] = {
            "tag_count": total,
            "correct": data["correct"],
            "incorrect": data["incorrect"],
            "precision": round(prec, 4),
            # Recall and F1 only meaningful at the photo level
            "recall": round(prec, 4),  # placeholder — true recall needs missing tag categorization
            "f1": round(prec, 4),
        }

    # Better per-category: compute per-photo averages for each category
    cat_photo_metrics: dict[str, list[dict]] = defaultdict(list)
    for result in per_photo_results:
        for cat, metrics in result["by_category"].items():
            if cat != "missing_from_ai":
                cat_photo_metrics[cat].append(metrics)

    for cat in by_category:
        if cat in cat_photo_metrics:
            metrics_list = cat_photo_metrics[cat]
            m = len(metrics_list)
            by_category[cat]["recall"] = round(sum(x["recall"] for x in metrics_list) / m, 4) if m > 0 else 0
            by_category[cat]["f1"] = round(sum(x["f1"] for x in metrics_list) / m, 4) if m > 0 else 0
            by_category[cat]["photo_count"] = m

    # -- Step 4: Confidence threshold analysis --
    print("Analyzing confidence thresholds...")
    threshold_analysis = analyze_thresholds(ground_truth)

    # -- Step 5: Threshold simulation --
    print("Simulating alternative thresholds...")
    simulated_thresholds = []
    for t in [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]:
        sim = simulate_threshold(ground_truth, t)
        simulated_thresholds.append(sim)
        print(f"  threshold={t:.1f}: P={sim['precision']:.3f} R={sim['recall']:.3f} F1={sim['f1']:.3f}")

    # -- Step 6: Common errors --
    errors = find_common_errors(ground_truth)

    # -- Step 7: Weakest photos --
    weakest = sorted(per_photo_results, key=lambda x: x["metrics"]["f1"])[:10]
    strongest = sorted(per_photo_results, key=lambda x: -x["metrics"]["f1"])[:5]

    # -- Print summary --
    print_summary(overall, by_category, threshold_analysis, errors)

    # -- Save results --
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "provider": args.provider,
            "ground_truth_file": GROUND_TRUTH_FILE,
            "total_photos": n,
            "custom_threshold": args.threshold,
        },
        "overall": overall,
        "by_category": by_category,
        "threshold_analysis": threshold_analysis,
        "threshold_simulation": simulated_thresholds,
        "common_errors": errors,
        "weakest_photos": [{
            "photoId": p["photoId"],
            "originalName": p["originalName"],
            "f1": p["metrics"]["f1"],
            "n_correct": p["n_correct"],
            "n_incorrect": p["n_incorrect"],
            "n_missing": p["n_missing"],
        } for p in weakest],
        "strongest_photos": [{
            "photoId": p["photoId"],
            "originalName": p["originalName"],
            "f1": p["metrics"]["f1"],
            "n_correct": p["n_correct"],
            "n_incorrect": p["n_incorrect"],
            "n_missing": p["n_missing"],
        } for p in strongest],
        "per_photo": per_photo_results,
    }

    output_path = RESULTS_DIR / "tagging_baseline.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nResults saved to {output_path}")


if __name__ == "__main__":
    main()
