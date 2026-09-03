import asyncio
import os
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from src.pipeline.processor import DocumentProcessor

processor = DocumentProcessor()

class ProcessJobRequest(BaseModel):
    jobId: str
    s3Key: str
    documentType: Optional[str] = "PYQ"
    courseCode: Optional[str] = "BCSE302L"
    year: Optional[int] = 2024

async def autonomous_job_poller():
    """
    Autonomous background loop:
    Checks for any pending jobs every 10 seconds and executes the ingestion pipeline.
    Ensures zero manual intervention even if an upload occurred while worker was starting up.
    """
    print("[Poller] Autonomous background poller started.")
    await asyncio.sleep(2)  # Give servers time to initialize
    
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
                            if job.get("status") == "PENDING":
                                job_id = job.get("id")
                                s3_key = file_info.get("s3Key")
                                paper = (file_info.get("papers") or [{}])[0]
                                course_code = (paper.get("course") or {}).get("code", "BCSE302L")
                                doc_type = "PYQ" if paper else "STUDY_MATERIAL"

                                print(f"[Poller] Discovered PENDING Job: {job_id}. Triggering pipeline autonomously...")
                                file_record = {
                                    "id": job_id,
                                    "s3Key": s3_key,
                                    "documentType": doc_type,
                                    "courseCode": course_code,
                                    "year": 2024
                                }
                                # Execute processing asynchronously
                                await asyncio.to_thread(processor.process_job, job_id, file_record)
        except Exception:
            # Next.js may be restarting or idle; loop continues safely
            pass

        await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the autonomous poller when FastAPI boots
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
    Direct dispatch endpoint: Runs processing autonomously in background tasks.
    """
    file_record = {
        "id": request.jobId,
        "s3Key": request.s3Key,
        "documentType": request.documentType,
        "courseCode": request.courseCode,
        "year": request.year
    }

    # Non-blocking execution in background
    background_tasks.add_task(processor.process_job, request.jobId, file_record)
    
    return {
        "status": "ACCEPTED",
        "jobId": request.jobId,
        "message": "Ingestion pipeline running autonomously."
    }
