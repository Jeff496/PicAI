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

*Future entries go here. Each entry should include:*

```
### Run N — <Description> (<Date>)

**What changed:** Brief description of the change (e.g., "Lowered MIN_SCORE from 0.5 to 0.3")
**Why:** Hypothesis for why this should improve quality
**Files modified:** List of changed files

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| F1     | 0.646  | 0.xxx | +0.xxx |

**Observations:** What improved, what regressed, surprising findings
```
