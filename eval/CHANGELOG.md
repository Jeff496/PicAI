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
