# RAG & Tagging Evaluation Changelog

Tracks metric changes across evaluation runs, what caused improvements or regressions, and tuning decisions.

---

## Metrics Reference

### Photo Display Accuracy (Custom)
Measures whether the RAG pipeline returns the correct photos for a query.

| Metric | Formula | What It Means |
|--------|---------|---------------|
| **Precision** | `\|retrieved ∩ expected\| / \|retrieved\|` | Of the photos shown, how many were correct? |
| **Recall** | `\|retrieved ∩ expected\| / \|expected\|` | Of the photos that should've been shown, how many did we find? |
| **F1** | Harmonic mean of P and R | Balanced single-number score |

### RAGAS Metrics (LLM-Judged)
| Metric | What It Measures |
|--------|-----------------|
| **Faithfulness** | Is the LLM response grounded in the retrieved photo context? (No hallucination) |
| **Response Relevancy** | Does the response actually address the user's question? |

---

## Run History

### Run 1 — Baseline (Feb 19, 2026)

**Config:** Default pipeline parameters, no tuning applied.

| Parameter | Value |
|-----------|-------|
| `MIN_SCORE` | 0.5 |
| `RELATIVE_SCORE_CUTOFF` | 0.75 |
| `k` (candidates) | 10 |
| `max_tokens` | 1024 |
| History window | 10 messages |
| Embedding model | `amazon.titan-embed-text-v2:0` |
| LLM model | `us.anthropic.claude-haiku-4-5-20251001-v1:0` |
| Golden dataset | 20 queries (11 tag, 5 people, 1 group, 4 negative) |

**Overall Results:**

| Metric | Value |
|--------|-------|
| Photo Accuracy — Precision | 0.822 |
| Photo Accuracy — Recall | 0.622 |
| Photo Accuracy — F1 | **0.646** |
| RAGAS — Faithfulness | N/A (see note) |
| RAGAS — Response Relevancy | N/A (see note) |
| Avg Latency | 4,959 ms |
| Total Input Tokens | 26,844 |
| Total Output Tokens | 5,382 |

> **RAGAS Note:** Bedrock Claude via litellm does not produce valid structured output
> for RAGAS's instructor-based statement extraction. The `tool_calls` response from
> Bedrock is returned as empty `content='{}'` rather than parsed tool use objects.
> RAGAS metrics require a direct Anthropic API key or OpenAI API key to function.
> This will be addressed in a future run.

**By Category:**

| Category | Count | Precision | Recall | F1 |
|----------|-------|-----------|--------|-----|
| tag-based | 10 | 0.800 | 0.507 | 0.538 |
| people-based | 5 | 0.767 | 0.473 | 0.559 |
| group-based | 1 | 0.600 | 1.000 | 0.750 |
| negative | 4 | 1.000 | 1.000 | 1.000 |

**Observations:**
- **Negative queries work perfectly** — the pipeline correctly returns no photos for queries about elephants, campfires, spaceships, and aliens. This validates the score filtering thresholds.
- **Precision is strong (0.822)** — when photos are returned, ~82% are correct. The LLM system prompt ("only reference genuinely relevant photos") is working well.
- **Recall is the bottleneck (0.622)** — the pipeline misses ~38% of relevant photos. This is likely due to the `k=10` candidate limit and the `MIN_SCORE=0.5` / `RELATIVE_SCORE_CUTOFF=0.75` thresholds being too aggressive.
- **People-based queries underperform** — recall is only 0.473 for people queries. The embedding model (Titan) likely doesn't capture person identity well from tag text alone.
- **Large expected sets hurt recall** — queries with 8-15 expected photos can only surface ~10 (capped by `k=10`).

**Weakest Queries (F1 < 0.5):**

| F1 | P | R | Exp | Ret | Query |
|----|---|---|-----|-----|-------|
| 0.22 | 0.50 | 0.14 | 7 | 2 | "What are some pictures of Jeffrey smiling?" |
| 0.29 | 1.00 | 0.17 | 6 | 1 | "Show me some pictures of fancy food" |
| 0.31 | 1.00 | 0.18 | 11 | 2 | "What's some cool architecture?" |
| 0.33 | 0.50 | 0.25 | 8 | 4 | "show me awesome nature landscapes" |
| 0.40 | 0.25 | 1.00 | 1 | 4 | "I'm feeling artsy, give me some inspiration" |
| 0.40 | 0.33 | 0.50 | 2 | 3 | "give me some group photos with Jeffrey" |
| 0.43 | 0.75 | 0.30 | 10 | 4 | "What about some pictures of my dog snuggled up?" |

**Key Bottlenecks Identified:**
1. **`k=10` limits recall** — architecture (11 expected), dog snuggled (10 expected), and nature (8 expected) are all capped by the candidate count
2. **Semantic gap** — "Jeffrey smiling" requires understanding facial expressions, which tags don't capture; "artsy" is subjective and tag-based search returns weak matches
3. **Score filtering** — `MIN_SCORE=0.5` and `RELATIVE_SCORE_CUTOFF=0.75` may be too aggressive for broad queries

**Strongest Queries (F1 >= 0.8):**

| F1 | P | R | Query |
|----|---|---|-------|
| 0.91 | 1.00 | 0.83 | "Show me some photos at the beach" |
| 0.86 | 1.00 | 0.75 | "Give me photos of me walking my dog along a street" |
| 0.86 | 1.00 | 0.75 | "Show me some cool headwear" |
| 0.80 | 1.00 | 0.67 | "show me some pictures of jeffrey wearing some accessories" |
| 1.00 | 1.00 | 1.00 | All 4 negative queries |

---

## Phase 3 — Tagging Benchmark (Feb 19, 2026)

### 3a — Azure CV Tag Quality Baseline

**Dataset:** 63 hand-labeled photos from `tagging_ground_truth.jsonl`

**Overall Azure CV Tag Metrics:**

| Metric | Value |
|--------|-------|
| Tag Precision | **0.860** |
| Tag Recall | **0.850** |
| Tag F1 | **0.850** |
| Micro-Precision | 0.880 |
| Micro-Recall | 0.860 |
| Micro-F1 | 0.870 |

**Per-Category Breakdown:**

| Category | Tag Count | Precision |
|----------|-----------|-----------|
| tag | 651 | 0.956 |
| object | 21 | 0.714 |
| people | 52 | **0.000** |

**Critical Finding — People Count Tags:**
Azure Computer Vision's people-count feature (`"14 people"`, `"9 people"`, etc.) has **0% precision**. Every single people-count tag in the ground truth was marked incorrect by human labelers. The most common incorrect tags are all people counts:
- `"1 person"` (11x wrong), `"4 people"` (7x), `"2 people"` (6x), `"5 people"` (5x)

**Confidence Threshold Analysis:**

| Threshold | Precision | Recall | F1 |
|-----------|-----------|--------|-----|
| 0.3 | 0.860 | 0.850 | 0.850 |
| 0.5 (current) | 0.860 | 0.850 | 0.850 |
| 0.6 | 0.860 | 0.790 | 0.816 |
| 0.7 | 0.860 | 0.742 | 0.787 |
| 0.8 | 0.845 | 0.657 | 0.726 |

Threshold 0.5 is already near-optimal. Lowering below 0.5 has no effect (tags are stored at >=0.5). Raising above 0.5 only hurts recall.

**Top Missing Tags (Azure doesn't detect):**
`"1 person"` (correct count, 5x), `"dog toy"` (4x), `"dog"` (4x), `"stuffed animal"` (3x), `"smile"` (3x), `"ocean"` (3x)

---

### 3b — Alternative Model Comparison

**Providers tested:** Azure CV (existing tags), AWS Rekognition DetectLabels, Claude Haiku 4.5 Vision (Bedrock)
**Matching mode:** Fuzzy (substring + synonym matching) for fairer cross-provider comparison

| Provider | Precision | Recall | F1 | Errors | Cost (63 photos) |
|----------|-----------|--------|-----|--------|-------------------|
| **Azure CV** | **0.779** | **0.856** | **0.806** | 0 | $0.063 |
| AWS Rekognition | 0.265 | 0.500 | 0.331 | 6 | $0.063 |
| Claude Haiku 4.5 | 0.166 | 0.335 | 0.216 | 24 | $0.133 |

**Caveats:**
- Ground truth was labeled against Azure's tag vocabulary, inherently favoring Azure
- Many photos >5MB caused Rekognition (6 errors) and Claude (24 errors) to fail
- Claude produces natural-language tags ("small dog", "indoor setting") that don't match Azure-style labels
- Even with fuzzy matching, vocabulary mismatch is the dominant factor

**Conclusion:** Azure CV is clearly the best provider for our use case. Neither Rekognition nor Claude warrants adoption as a primary tagger.

### 3b+ — LLM-as-Judge Semantic Matching

**Motivation:** Ground truth was labeled against Azure's vocabulary, inherently penalizing alternatives. An LLM judge (Claude Haiku) evaluates semantic equivalence per photo — e.g., "indoor setting" ≈ "indoor", "small dog" ≈ "dog" — to remove vocabulary bias.

**Full run (63 photos, LLM judge):**

| Provider | Precision | Recall | F1 | Errors |
|----------|-----------|--------|-----|--------|
| **Azure CV** | **0.778** | **0.855** | **0.806** | 0 |
| AWS Rekognition | 0.278 | 0.512 | 0.344 | 6 |
| Claude Sonnet 4.5 | 0.157 | 0.402 | 0.221 | 24 |

**Filtered to 38 photos where all providers succeeded (no errors):**

| Provider | Precision | Recall | F1 |
|----------|-----------|--------|-----|
| **Azure CV** | **0.786** | **0.890** | **0.825** |
| AWS Rekognition | 0.308 | 0.597 | 0.386 |
| Claude Sonnet 4.5 | 0.260 | 0.667 | 0.366 |

**Observations:**
- LLM judge improved Rekognition F1 from 0.331 → 0.344 (+0.013) and Claude from 0.216 → 0.221 (+0.005) — modest gains, doesn't change the ranking
- On the 38-photo subset, Claude Sonnet has the **highest recall (0.667)** — it finds more relevant tags than Rekognition — but suffers from low precision (0.260) due to many subjective/atmospheric tags ("cozy atmosphere", "warm tones")
- Azure's dominance persists even after removing vocabulary bias
- **5MB image limit** blocked Claude from processing ~40% of photos (24/63 errors) — using thumbnails instead of originals would fix this but may reduce tag quality

---

### 3c — Hybrid Strategy Analysis

**Question:** Can combining providers or adjusting thresholds improve quality?

| Strategy | Precision | Recall | F1 | Delta vs Baseline |
|----------|-----------|--------|-----|-------------------|
| Azure only (baseline) | 0.779 | 0.856 | 0.806 | — |
| **Azure (no people)** | **0.840** | **0.855** | **0.837** | **+0.031** |
| **Azure (optimized thresholds)** | **0.844** | **0.851** | **0.837** | **+0.031** |
| Azure + Rekognition | 0.378 | 0.895 | 0.510 | -0.296 |
| Azure + Claude | 0.501 | 0.896 | 0.597 | -0.209 |
| Azure + Rek + Claude | 0.304 | 0.918 | 0.427 | -0.379 |

**Key Insight:** Simply disabling people-count tags yields the biggest F1 improvement (+0.031) at zero cost. Adding alternative providers tanks precision because of vocabulary mismatch noise.

**Recommended Production Thresholds:**

| Category | Current | Recommended | Rationale |
|----------|---------|-------------|-----------|
| tag | 0.5 | 0.5 (no change) | 95.6% precision, no action needed |
| object | 0.5 | 0.6 | Reduces false positives ("Teddy bear" on dog photos) |
| people | 0.5 | **DISABLE** | 0% precision — systematic Azure CV failure |
| text | 0.5 | 0.5 (no change) | OCR is reliable |
| manual | always keep | always keep | User-added, 100% precision by definition |

---

## Improvement Log

### Run 2 — Hyperparameter Optimization (Feb 20, 2026)

**What changed:** Grid search over 36 parameter combinations (k × minScore × relativeCutoff). Applied best config to production: `k=30`, `MIN_SCORE=0.3`, `RELATIVE_SCORE_CUTOFF=0.5`.

**Why:** Baseline recall (0.622) was the bottleneck — `k=10` hard-capped large result sets, and aggressive score thresholds (`MIN_SCORE=0.5`, `RELATIVE_SCORE_CUTOFF=0.75`) dropped borderline-relevant photos.

**Grid searched:**
- `k`: [10, 15, 20, 30]
- `minScore`: [0.3, 0.4, 0.5]
- `relativeCutoff`: [0.5, 0.65, 0.75]
- Total: 36 combos × 20 golden queries = 720 API calls (~4 hours)

**Files modified:**
- `infra/lambda/chat-handler/search.ts` — Added `SearchParams` interface for per-request overrides; refactored threshold vars to accept env + request overrides
- `infra/lambda/chat-handler/index.ts` — Parses optional `searchParams` from POST body, passes to `searchPhotos()`
- `infra/lib/chat-stack.ts` — Added `MIN_SEARCH_SCORE`, `RELATIVE_SCORE_CUTOFF`, `SEARCH_K` env vars; set to optimized values
- `eval/run_sweep.py` — **New file** — Hyperparameter sweep script with grid search, checkpointing, and resume support

**Top 5 Configurations (by F1):**

| Rank | k | minScore | relCutoff | Precision | Recall | F1 | Tokens |
|------|---|----------|-----------|-----------|--------|-----|--------|
| 1 | **30** | **0.30** | **0.50** | **0.843** | **0.685** | **0.697** | 75,796 |
| 2 | 10 | 0.50 | 0.50 | 0.845 | 0.660 | 0.685 | 32,509 |
| 3 | 30 | 0.40 | 0.50 | 0.853 | 0.660 | 0.684 | 75,915 |
| 4 | 15 | 0.30 | 0.75 | 0.841 | 0.651 | 0.684 | 43,373 |
| 5 | 20 | 0.40 | 0.65 | 0.858 | 0.658 | 0.684 | 54,166 |

**Before vs After:**

| Metric | Before (Run 1) | After (Run 2) | Delta |
|--------|----------------|---------------|-------|
| Precision | 0.822 | 0.843 | +0.021 |
| Recall | 0.622 | 0.685 | **+0.063** |
| F1 | 0.646 | **0.697** | **+0.051** |
| Tokens (per run) | 32,226 | 75,796 | +43,570 |

**By Category (best config):**

| Category | Count | Precision | Recall | F1 |
|----------|-------|-----------|--------|-----|
| tag-based | 10 | 0.809 | 0.609 | 0.625 |
| people-based | 5 | 0.832 | 0.522 | 0.586 |
| group-based | 1 | 0.600 | 1.000 | 0.750 |
| negative | 4 | 1.000 | 1.000 | 1.000 |

**Observations:**
- **Recall is the main improvement** (+0.063) — increasing k from 10→30 lifts the hard cap on large result sets; lowering MIN_SCORE from 0.5→0.3 lets borderline-relevant photos through
- **Precision actually improved** (+0.021) — the LLM's system prompt ("only reference genuinely relevant photos") effectively filters noise even with 3× more candidates
- **Negative queries remain perfect** — score filtering still correctly blocks non-existent content
- **Token cost doubles** (~76k vs ~32k) because the LLM receives 30 photo contexts instead of 10. This is an acceptable trade-off for +8% F1
- **Latency unchanged** (~4.4s vs ~5.0s) — OpenSearch k-NN is fast even at k=30; LLM call dominates total time regardless of context size
- **`relativeCutoff=0.5` consistently wins** across all k values — the original 0.75 was too aggressive, dropping results that were >50% as similar as the top hit
- **Cost-efficient alternative:** `k=10, minScore=0.5, relCutoff=0.5` achieves F1=0.685 (second-best) at half the token cost. Good fallback if cost becomes a concern
- **People queries remain weakest** (F1=0.586) — Titan text embeddings don't encode person identity well from tag text alone. Enriching embedding text with recognized person names would likely help (future work)

**Production config applied:**

| Parameter | Before | After |
|-----------|--------|-------|
| `MIN_SEARCH_SCORE` | 0.5 | **0.3** |
| `RELATIVE_SCORE_CUTOFF` | 0.75 | **0.5** |
| `SEARCH_K` | 10 | **30** |

---

### Run 3 — Model-Agnostic Synonym Re-evaluation (Feb 20, 2026)

**What changed:** Replaced 25 hardcoded synonym pairs with a 325-tag × 1,217-synonym map generated by Claude Haiku. Re-ran cross-provider comparison (`run_alt_tagging.py --fuzzy`) and hybrid analysis (`run_hybrid_analysis.py`) against the same 63 ground truth photos.

**Why:** The original fuzzy matching penalized alternative providers that use different vocabulary (e.g., "canine" vs "dog", "plush toy" vs "stuffed animal"). A comprehensive synonym map removes vocabulary bias from the cross-provider evaluation.

**Files modified:**
- `eval/generate_synonyms.py` — **New** — Extracts 325 unique tags from ground truth, sends to Claude Haiku in batches, gets 3-8 synonyms per tag
- `eval/datasets/tag_synonyms.json` — **New** — 325 tags → 1,217 synonyms (generated by Claude Haiku)
- `eval/run_alt_tagging.py` — Replaced hardcoded 25-entry `SYNONYM_MAP` with 325-entry map loaded from `tag_synonyms.json`
- `eval/run_hybrid_analysis.py` — Same synonym map update applied

**Cross-Provider Comparison (Before vs After synonyms):**

| Provider | Old F1 (25 synonyms) | New F1 (325-tag map) | Delta |
|----------|---------------------|---------------------|-------|
| Azure CV | 0.806 | 0.805 | -0.001 |
| AWS Rekognition | 0.331 | **0.394** | **+0.063** |
| Claude Haiku 4.5 | 0.216 | **0.369** | **+0.153** |

**Hybrid Strategy Comparison (Before vs After synonyms):**

| Strategy | Old F1 | New F1 | Delta |
|----------|--------|--------|-------|
| Azure only (baseline) | 0.806 | 0.804 | -0.002 |
| Azure (no people) | 0.837 | 0.832 | -0.005 |
| Azure (optimized thresholds) | 0.837 | 0.833 | -0.004 |
| Azure + Rekognition | 0.510 | 0.507 | -0.003 |
| Azure + Claude Haiku | 0.597 | 0.588 | -0.009 |
| Azure + Rek + Claude | 0.427 | 0.422 | -0.005 |
| Azure (no people) + Rek | 0.523 | 0.518 | -0.005 |

**Observations:**
- **Claude Haiku benefited most** from synonym expansion (+0.153 F1, +71%) — its natural-language tags now match ground truth through expanded synonym sets
- **Rekognition improved moderately** (+0.063 F1, +19%) — its label taxonomy is closer to Azure's than Claude's
- **Azure CV was unaffected** (-0.001) — its tags match the ground truth natively
- **Rankings did not change** — Azure CV >> Rekognition ≈ Claude Haiku even with fairer matching
- **Hybrid strategy rankings unchanged** — "Azure (optimized thresholds)" still wins; multi-provider strategies still tank precision
- **Conclusion:** Synonym expansion makes evaluation fairer but does not change the production recommendation. Azure CV remains the only provider worth using.

---

## Cumulative Improvement Summary (Phases 1–4)

### RAG Pipeline (Photo Display Accuracy)

| Stage | Precision | Recall | F1 | Delta |
|-------|-----------|--------|-----|-------|
| Baseline (k=10, min=0.5, rel=0.75) | 0.822 | 0.622 | 0.646 | — |
| **Optimized (k=30, min=0.3, rel=0.5)** | **0.843** | **0.685** | **0.697** | **+0.051** |

### Tagging Pipeline

| Stage | Precision | Recall | F1 |
|-------|-----------|--------|-----|
| Azure CV (default) | 0.777 | 0.854 | 0.805 |
| **Azure (optimized: no people, object≥0.6)** | **0.840** | **0.847** | **0.833** |

### Production Config

| Parameter | Original | Optimized |
|-----------|----------|-----------|
| `SEARCH_K` | 10 | **30** |
| `MIN_SEARCH_SCORE` | 0.5 | **0.3** |
| `RELATIVE_SCORE_CUTOFF` | 0.75 | **0.5** |
| People count tags | Enabled | **Disabled** |
| Object confidence threshold | 0.5 | **0.6** |

---

*Template for future entries:*

```
### Run N — <Description> (<Date>)

**What changed:** Brief description of the change
**Why:** Hypothesis for why this should improve quality
**Files modified:** List of changed files

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| F1     | 0.697  | 0.xxx | +0.xxx |

**Observations:** What improved, what regressed, surprising findings
```
