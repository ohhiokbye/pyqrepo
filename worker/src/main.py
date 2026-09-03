import asyncio
import os
import httpx
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Load .env from repository root (two levels up from worker/src/main.py)
_root_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')
_project_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env')
load_dotenv(_root_env)      # worker/.env (if exists)
load_dotenv(_project_env)   # root .env (fallback, does not overwrite)

from src.pipeline.processor import DocumentProcessor

processor = DocumentProcessor()

class ProcessJobRequest(BaseModel):
    jobId: str
    s3Key: str
    documentType: Optional[str] = "PYQ"
    courseCode: Optional[str] = "BMAT202L"
    year: Optional[int] = None

# Track jobs currently being processed to prevent double-processing
active_jobs: set[str] = set()

async def autonomous_job_poller():
    """
    Autonomous background loop:
    Checks for any pending jobs every 15 seconds and executes the ingestion pipeline.
    Ensures zero manual intervention even if an upload occurred while worker was starting up.
    """
    print("[Poller] Autonomous background poller started.")
    await asyncio.sleep(5)  # Give Next.js time to boot
    
    while True:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get("http://localhost:3000/api/submissions")
                if res.status_code == 200:
                    data = res.json()
                    submissions = data.get("submissions", [])
                    for sub in submissions:
                        file_info = sub.get("file", {})
                        jobs = file_info.get("jobs", [])
                        for job in jobs:
                            job_id = job.get("id")
                            if job.get("status") == "PENDING" and job_id not in active_jobs:
                                active_jobs.add(job_id)
                                s3_key = file_info.get("s3Key")
                                
                                # Correctly detect document type
                                papers_list = file_info.get("papers") or []
                                doc_type = "PYQ" if len(papers_list) > 0 else "STUDY_MATERIAL"
                                paper = papers_list[0] if papers_list else {}
                                course_code = (paper.get("course") or {}).get("code", "UNKNOWN")

                                print(f"[Poller] Discovered PENDING Job: {job_id}. Triggering pipeline autonomously...")
                                file_record = {
                                    "id": job_id,
                                    "s3Key": s3_key,
                                    "documentType": doc_type,
                                    "courseCode": course_code,
                                    "year": paper.get("year")
                                }
                                try:
                                    await asyncio.to_thread(processor.process_job, job_id, file_record)
                                except Exception as proc_err:
                                    print(f"[Poller] Processing error for {job_id}: {proc_err}")
                                finally:
                                    active_jobs.discard(job_id)
        except Exception:
            # Next.js may be restarting or idle; loop continues safely
            pass

        await asyncio.sleep(15)


@asynccontextmanager
async def lifespan(app: FastAPI):
    poller_task = asyncio.create_task(autonomous_job_poller())
    yield
    poller_task.cancel()


app = FastAPI(title="CPYQ Ingestion Worker", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "CPYQ Ingestion Worker",
        "version": "1.0.0"
    }

@app.post("/jobs/process")
async def process_job(request: ProcessJobRequest, background_tasks: BackgroundTasks):
    """
    Direct dispatch endpoint called by Next.js finalize route.
    Guards against double-processing with the shared active_jobs set.
    """
    if request.jobId in active_jobs:
        return {
            "status": "ALREADY_PROCESSING",
            "jobId": request.jobId,
            "message": "Job is already being processed."
        }

    active_jobs.add(request.jobId)

    file_record = {
        "id": request.jobId,
        "s3Key": request.s3Key,
        "documentType": request.documentType,
        "courseCode": request.courseCode,
        "year": request.year
    }

    def run_and_cleanup(job_id: str, record: dict):
        try:
            processor.process_job(job_id, record)
        finally:
            active_jobs.discard(job_id)

    background_tasks.add_task(run_and_cleanup, request.jobId, file_record)
    
    return {
        "status": "ACCEPTED",
        "jobId": request.jobId,
        "message": "Ingestion pipeline running autonomously."
    }
