# CPYQ Lib 📚

> **Syllabus-grounded academic question bank and conversational AI tutor for university students.**

CPYQ Lib transforms scattered past exam papers (CAT 1, CAT 2, FAT) and university curricula into a structured, searchable, and AI-grounded knowledge base. Instead of browsing isolated questions or getting unverified answers, students interact with a conversational tutor whose explanations are strictly grounded in their official course syllabus, past exam questions (PYQs), marks distribution, and visual question paper snippets.

---

## ⚡ Core Features

### 🎓 1. Conversational Academic Tutor (`/`)
- **Syllabus & PYQ Grounding**: Answers questions using university course curricula and verified past exam papers as reference context.
- **Asymmetric Semantic Search**: Uses Gemini vector embeddings (`768` dims) and PostgreSQL `pgvector` (`<=>` cosine distance) to retrieve questions based on *conceptual meaning* rather than naive keyword matching.
- **Interactive Grounded PYQs Panel**: Side-by-side drawer displaying retrieved past questions, marks, year, exam category, and high-resolution paper crop snippets.
- **Course & Topic Context Bar**: Drill down directly by Program $\rightarrow$ Semester $\rightarrow$ Subject $\rightarrow$ Module / Topic.
- **Flexible AI Providers**: Supports custom student Gemini API keys stored locally in-browser or uses server-configured keys, with multi-tier model fallbacks.

### 📑 2. Exam Papers Explorer (`/papers`)
- **Paper-First View**: Full examination papers grouped by Course, Exam Type (CAT 1, CAT 2, FAT), and Year.
- **Visual Question Snippets**: Renders high-resolution image crops clipped directly from the scanned PDF alongside cleaned text and marks.
- **URL-Synced Filters**: Filter state is reflected directly in the URL for bookmarking and easy sharing among students.

### 📤 3. Contributor Upload Portal (`/upload`)
- **Passphrase-Protected Ingestion**: Secures uploads with rate limiting and passphrase authentication (`UPLOAD_PASSPHRASE`).
- **Two-Phase Upload Flow**: Pre-flight validation (`/api/upload/init`), HMAC-signed upload tokens (`/api/local-upload`), and atomic finalization (`/api/upload/finalize`).
- **Bitwise Deduplication**: Instant SHA-256 hash checks (`/api/files/check-hash`) skip reprocessing if an identical PDF has already been ingested.

### ⚙️ 4. Autonomous Processing Worker (`worker/`)
- **Resilient OCR Engine**: Adaptive matrix scaling eliminates image decompression bombs on high-DPI scans; PIL contrast preprocessing sharpens faint text. Supports Tesseract and Hugging Face `GLM-OCR`.
- **Zero-Loss Question Segmentation**: Structural extraction with deterministic regex fallback (`_regex_segment_questions`) — zero character truncation.
- **Page-Accurate Question Cropping**: Automatically locates question headers and clips tight bounding-box PNG snippets from the original pages.
- **Vector Embedding Pipeline**: Generates `RETRIEVAL_DOCUMENT` embeddings at ingestion time and stores them directly in PostgreSQL via `pgvector`.
- **Dual-Pickup Architecture**: Direct frontend dispatch with an autonomous polling backup (`/api/jobs/claim`) ensuring jobs are never lost or double-processed.

---

## 🔄 How It Works

### 1. Ingestion & Question Extraction Flow

```mermaid
flowchart TD
    A["Student / Contributor uploads PDF (/upload)"] --> B["SHA-256 Hash & Deduplication Check"]
    B -- "Duplicate Found" --> C["Link to existing paper & reuse questions"]
    B -- "New File" --> D["Adaptive Scale OCR (Tesseract / GLM-OCR)"]
    D --> E["Question Segmentation (Gemini + Regex Fallback)"]
    E --> F["Generate Per-Question PNG Crops from PDF Pages"]
    F --> G["Classify Syllabus Module & Topic"]
    G --> H["Embed Question Text (RETRIEVAL_DOCUMENT, 768 dims)"]
    H --> I["Atomic Upsert to PostgreSQL + pgvector via /api/jobs/update"]
```

### 2. Semantic Tutor Retrieval Flow

```mermaid
flowchart TD
    Q["Student asks question in Tutor (/api/tutor/chat)"] --> E["Generate Query Embedding (RETRIEVAL_QUERY)"]
    E --> V["pgvector Cosine Distance Search (<=>) scoped to course/topic"]
    V -- ">= 3 matches" --> R["Fetch Top Question Rows & Visual Crops"]
    V -- "No / Sparse embeddings" --> L["Fallback: Lexical Topic & Keyword Search"]
    R --> P["Build Grounding Prompt (Syllabus + Verified PYQs)"]
    L --> P
    P --> T["Stream Gemini Tutor Response + Grounded Question Cards"]
```

---

## 🏗️ Architecture

```text
CPYQ/
├── frontend/                 # Next.js 16 (App Router), React 19, Tailwind CSS v4, Prisma ORM
│   ├── src/app/
│   │   ├── page.tsx          # Academic Tutor workspace (/)
│   │   ├── papers/           # Full exam paper explorer (/papers)
│   │   ├── upload/           # Contributor paper upload portal (/upload)
│   │   └── api/              # Tutor chat, upload init/finalize, job claims & updates
│   ├── src/components/       # TutorChat, GroundedQuestionsPanel, PaperView, ApiKeyModal
│   ├── src/lib/              # embeddings.ts (pgvector raw SQL), data layers, rate limiting
│   └── prisma/               # schema.prisma (pgvector support), seed.ts (curricula)
├── worker/                   # Python 3.10+ autonomous pipeline daemon
│   ├── src/pipeline/         # processor.py: OCR, cropping, segmentation, embedding
│   ├── src/providers/        # ocr.py (Tesseract, GLM-OCR), llm.py (Gemini, mock)
│   └── tests/                # Unit & integration tests for worker logic
├── docker-compose.yml        # PostgreSQL 16 + pgvector container
└── local_storage/            # Object store for uploaded PDFs and question crops
```

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- **Node.js 20+** & **npm**
- **Python 3.10+**
- **Docker & Docker Compose**
- **Tesseract OCR** (`sudo apt install tesseract-ocr` or `brew install tesseract`)

---

### 1. Start the Vector Database
```bash
docker compose up -d
```
*(Starts PostgreSQL 16 with `pgvector` on port `5433`)*

---

### 2. Setup & Run the Frontend
```bash
cd frontend
npm install

# Copy and configure environment variables
cp ../.env.example .env

# Push Prisma schema and seed initial university courses & syllabus trees
npx prisma db push
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### 3. Setup & Run the Ingestion Worker
In a second terminal:
```bash
cd worker
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start the background pipeline daemon
python3 src/main.py
```

---

## ⚙️ Environment Variables Reference

Create a `.env` in the root (or frontend / worker directories) based on `.env.example`:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string with port `5433` | `postgresql://cpyq_user:cpyq_password@localhost:5433/cpyq?schema=public` |
| `UPLOAD_PASSPHRASE` | Secret passphrase required to upload papers | `change-me` |
| `WORKER_INTERNAL_KEY` | Shared secret for worker to report results to `/api/jobs/update` | Generate a 32-byte hex string |
| `GEMINI_API_KEY` | Google Gemini API key for embeddings, segmentation & tutor | Required for Gemini features |
| `LLM_PROVIDER` | LLM backend for worker (`gemini` or `mock`) | `gemini` |
| `OCR_PROVIDER` | OCR engine (`tesseract` or `glm-ocr`) | `tesseract` |
| `STORAGE_DRIVER` | Storage system for files and crops | `local` |
| `FRONTEND_URL` | Base URL used by the worker to reach the Next.js API | `http://localhost:3000` |

---

## 🧪 Testing & Verification

Run tests to ensure everything is clean before pushing changes:

```bash
# 1. Type check frontend Next.js code
cd frontend
npx tsc --noEmit

# 2. Run worker pipeline unit tests
cd ../worker
source venv/bin/activate
pytest
```

---

## 🤝 How You Can Contribute

We welcome contributions from students, developers, and open-source enthusiasts!

### 🎯 High-Impact Areas to Work On
- **Course & Syllabus Expansion**: Add modules, reference textbooks, and topic trees in `frontend/prisma/seed.ts`.
- **Question Paper Ingestion**: Upload clean PDF scans for courses that need coverage.
- **LaTeX Math Rendering**: Add KaTeX or MathJax rendering for mathematical formulas and matrix equations in questions.
- **Vision OCR Optimization**: Benchmark and optimize `GLM-OCR` for handwritten exam sheets and diagrams.
- **Student UX Improvements**: Mobile responsiveness, dark mode refinements, and study collection bookmarks.

---

## 🛠️ Contribution Workflow

1. Fork the repository and create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Verify code passes type checks and tests:
   ```bash
   cd frontend && npx tsc --noEmit
   ```
3. Commit with concise, descriptive commit messages:
   ```bash
   git commit -m "feat: add latex formula rendering to paper view"
   ```
4. Push to your fork and submit a Pull Request!

---

## 📄 License
MIT © 2026 CPYQ Lib Contributors
