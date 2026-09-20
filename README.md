# CPYQ Lib 📚

> **Syllabus-grounded academic question bank and conversational tutor for university students.**

CPYQ Lib transforms scattered question papers (CAT 1, CAT 2, FAT) and course curricula into a structured knowledge base. Instead of browsing isolated questions, students get an AI tutor whose answers are strictly grounded in their official course syllabus and past examination papers.

---

## ⚡ What It Does

1. **Ingestion & Segmentation Pipeline**: Ingests scanned PDFs, performs OCR (Tesseract / GLM-OCR), segments individual multi-part questions (`Q1`, `Q2(a)`), extracts high-resolution diagram crops, and maps questions to syllabus modules and topics.
2. **Conversational Academic Tutor (`/`)**: A ChatGPT-style tutor grounded in the university course syllabus, historical question trends, and marks distribution.
3. **Exam Papers Viewer (`/papers`)**: Complete exam paper viewer filtered by Course, Exam Type (CAT 1 / CAT 2 / FAT), and Year with original paper crop snippets.
4. **Contributor Upload Portal (`/upload`)**: Streamlined portal for students to upload new exam papers and notes with bitwise SHA-256 deduplication.

---

## 🏗️ Architecture

```text
CPYQ/
├── frontend/           # Next.js 16 (App Router), React 19, Tailwind CSS v4, Prisma ORM
│   ├── src/app/        # / (Tutor), /papers (Exam Papers), /upload (Uploads)
│   ├── src/components/ # Tutor workspace, context bar, crop lightbox, API key modal
│   └── prisma/         # Schema, migrations, course/syllabus seeds
├── worker/             # Python 3.10+ async pipeline daemon
│   ├── src/pipeline/   # Processor: validation -> hash -> OCR -> segment -> classify
│   └── src/providers/  # Modular OCR (Tesseract, GLM-OCR) and LLM (Gemini, Mock)
├── docker-compose.yml  # PostgreSQL 16 with pgvector extension
└── local_storage/      # Local object storage for uploads and question crops
```

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- Node.js 20+ & npm
- Python 3.10+
- Docker & Docker Compose
- Tesseract OCR (`sudo apt install tesseract-ocr`)

### 1. Start the Database
```bash
docker compose up -d
```
*(Starts PostgreSQL + pgvector on port `5433` bound to localhost)*

### 2. Run the Frontend
```bash
cd frontend
npm install

# Setup local environment
cp .env.example .env # or configure DATABASE_URL and GEMINI_API_KEY

# Push schema and seed courses
npx prisma db push
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### 3. Run the Ingestion Worker
In another terminal:
```bash
cd worker
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Setup environment
cp .env.example .env

# Start pipeline daemon
python3 src/main.py
```

---

## 🤝 How You Can Help

We welcome contributions from friends and the open-source community!

### 🎯 High-Priority Areas

- **Question Paper Ingestion**: Upload clear PDF scans for courses missing in the bank.
- **Syllabus Expansion**: Add course modules and topic trees in `frontend/prisma/seed.ts`.
- **OCR & Vision Improvements**: Improve formula/matrix extraction and test `GLM-OCR` for handwritten exam sheets.
- **Phase 2: Semantic Intelligence**:
  - Implement question embeddings via `pgvector` to detect duplicate or same-concept questions across semesters.
- **Student UX**: UI polish, LaTeX math rendering for equations, and mobile responsiveness.

---

## 🛠️ Contribution Workflow

1. Fork the repository & create your branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Ensure everything builds cleanly with zero errors:
   ```bash
   cd frontend && npx tsc --noEmit
   ```
3. Commit with concise messages:
   ```bash
   git commit -m "feat: add latex formula rendering to paper view"
   ```
4. Push to your fork and open a Pull Request!

---

## 📄 License
MIT © 2026 CPYQ Lib Contributors
