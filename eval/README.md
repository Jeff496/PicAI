# PicAI Evaluation Datasets

Scripts and templates for building golden evaluation datasets to measure RAG retrieval quality and AI tagging accuracy.

## Quick Start

### 1. Export photo catalog (for RAG labeling)

```bash
cd ~/PicAI/backend
npx tsx scripts/export-photo-catalog.ts
```

Outputs `eval/datasets/photo_catalog.json` — a JSON array of all photos with their metadata, AI tags, people, and group info.

### 2. Export tagging data (for tagging labeling)

```bash
cd ~/PicAI/backend
npx tsx scripts/export-tagging-data.ts
```

Outputs `eval/datasets/tagging_export.jsonl` — one JSON line per photo with current AI tags.

### 3. Launch labeling tools

```bash
node ~/PicAI/eval/tools/serve.mjs
```

Then SSH tunnel from your local machine (`ssh -L 8080:localhost:8080 user@pi`) and open:
- Tagging labeler: `http://localhost:8080/tools/tagging-labeler.html`
- RAG query labeler: `http://localhost:8080/tools/rag-query-labeler.html`

## Labeling Tools

### Tagging Labeler (`tools/tagging-labeler.html`)

Visual tool for reviewing AI-generated tags on each photo:
- Click tags to cycle: unlabeled (gray) -> correct (green) -> incorrect (red)
- Press `A` to mark all tags correct, then fix the wrong ones
- Add missing tags via text input
- Arrow keys to navigate between photos
- Press `S` to save `tagging_ground_truth.jsonl`

### RAG Query Labeler (`tools/rag-query-labeler.html`)

Visual tool for building the RAG golden dataset:
- Browse photo grid with search/filter by tag, group, people
- Click photos to select expected results for a query
- Write natural language queries and pick a category
- Entries saved to sidebar, click to edit
- Press `S` to save `rag_golden.jsonl`

### Proxy Server (`tools/serve.mjs`)

Serves the HTML tools and proxies `/api/*` to the PicAI backend (default `http://localhost:3001`), avoiding CORS issues.

```bash
# Custom port and backend
node eval/tools/serve.mjs --port 9090 --backend http://localhost:3001
```

## RAG Golden Dataset

**File:** `eval/datasets/rag_golden.jsonl`

Each line is a JSON object with:

| Field | Type | Description |
|-------|------|-------------|
| `question` | string | Natural language query a user would type in chat |
| `ground_truth_answer` | string | Optional — expected response summary for answer quality scoring |
| `expected_photo_ids` | string[] | Photo IDs that should be retrieved (empty for negative queries) |
| `category` | string | Query category (see below) |

### Query Categories

| Category | Target Count | Description | Example |
|----------|-------------|-------------|---------|
| `tag-based` | 8-10 | Queries about visual content (objects, scenes) | "show me beach photos" |
| `people-based` | 5-8 | Queries about specific people | "photos with Sarah" |
| `temporal` | 5-8 | Queries about time/date | "photos from January" |
| `group-based` | 3-5 | Queries scoped to a group | "Family group photos" |
| `negative` | 5 | Queries that should return no results | "photos of elephants" |

## Tagging Ground Truth Dataset

**File:** `eval/datasets/tagging_ground_truth.jsonl`

Each line is a JSON object with:

| Field | Type | Description |
|-------|------|-------------|
| `photoId` | string | Photo UUID |
| `originalName` | string | Original filename |
| `ai_tags` | object[] | Current AI-generated tags (from export) |
| `correct_tags` | string[] | Tags from `ai_tags` that are correct |
| `missing_tags` | string[] | Tags that should exist but AI missed |
| `incorrect_tags` | string[] | Tags from `ai_tags` that are wrong |

20-30 labeled photos is sufficient for meaningful evaluation.

## Running the Eval Harnesses

### Prerequisites

```bash
cd ~/PicAI/eval
source venv/bin/activate
pip install ragas boto3 datasets litellm
```

### RAG Baseline (Phase 2)

```bash
# Custom metrics only (Photo Display Accuracy) — no AWS creds needed
python run_baseline.py --skip-ragas

# Full run with RAGAS (requires Bedrock access — see CHANGELOG.md for known issues)
AWS_PROFILE=picai-cdk AWS_DEFAULT_REGION=us-east-1 python run_baseline.py
```

Results: `eval/results/baseline.json`

### Tagging Benchmark (Phase 3a)

```bash
python run_tagging_benchmark.py
python run_tagging_benchmark.py --threshold 0.6   # simulate a different threshold
```

Results: `eval/results/tagging_baseline.json`

### Alternative Model Testing (Phase 3b)

```bash
# Run all providers (Rekognition + Claude Haiku Vision)
AWS_PROFILE=picai-cdk AWS_DEFAULT_REGION=us-east-1 python run_alt_tagging.py --fuzzy

# Run one provider only
AWS_PROFILE=picai-cdk AWS_DEFAULT_REGION=us-east-1 python run_alt_tagging.py --provider rekognition --fuzzy

# Dry run (check file paths)
python run_alt_tagging.py --dry-run
```

Results: `eval/results/alt_tagging_results.json`

### Hybrid Strategy Analysis (Phase 3c)

```bash
python run_hybrid_analysis.py
```

Results: `eval/results/hybrid_analysis.json`

Requires `alt_tagging_results.json` and `tagging_baseline.json` from previous phases.

### What each harness measures

| Harness | Metrics | Description |
|---------|---------|-------------|
| `run_baseline.py` | Photo Display Accuracy (P/R/F1) + RAGAS | RAG query quality |
| `run_tagging_benchmark.py` | Tag P/R/F1, per-category, threshold analysis | Azure CV tag quality |
| `run_alt_tagging.py` | Tag P/R/F1 per provider (strict + fuzzy) | Cross-provider comparison |
| `run_hybrid_analysis.py` | 7 strategies evaluated by F1 | Optimal tag configuration |

## File Summary

```
eval/
├── README.md
├── CHANGELOG.md                    # Metric history, observations, tuning log
├── run_baseline.py                 # Phase 2: RAG eval (Photo Display Accuracy + RAGAS)
├── run_tagging_benchmark.py        # Phase 3a: Azure CV tag quality benchmark
├── run_alt_tagging.py              # Phase 3b: Rekognition + Claude Haiku comparison
├── run_hybrid_analysis.py          # Phase 3c: Hybrid strategy evaluation
├── datasets/
│   ├── photo_catalog.json          # Full photo metadata (generated)
│   ├── photo_paths.json            # PhotoId -> file path mapping (generated)
│   ├── tagging_export.jsonl        # Raw AI tags per photo (generated)
│   ├── rag_golden.jsonl            # Golden RAG queries (hand-labeled)
│   └── tagging_ground_truth.jsonl  # Corrected tag labels (hand-labeled)
├── results/                        # Eval output (gitignored)
│   ├── baseline.json               # RAG baseline results
│   ├── tagging_baseline.json       # Azure CV tag quality results
│   ├── alt_tagging_results.json    # Cross-provider comparison results
│   └── hybrid_analysis.json        # Hybrid strategy results
└── tools/
    ├── serve.mjs                   # Local proxy server for labelers
    ├── tagging-labeler.html        # Visual tagging label tool
    └── rag-query-labeler.html      # Visual RAG query builder
```
