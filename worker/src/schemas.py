"""
Pydantic models for responses the worker receives FROM the frontend API.

The worker has no direct DB access and communicates with the frontend purely
over HTTP with no shared type contract, so a frontend response shape change
could previously flow through silently via `.get(..., default)` chains. These
models make that fail loudly (a logged validation warning) instead, while
still letting the pipeline fall back gracefully rather than crash the job.
"""
from typing import List, Optional
from pydantic import BaseModel


class TopicInfo(BaseModel):
    topicName: str = ''


class ModuleInfo(BaseModel):
    topics: List[TopicInfo] = []


class CourseInfo(BaseModel):
    code: str
    modules: List[ModuleInfo] = []


class CoursesResponse(BaseModel):
    courses: List[CourseInfo] = []


class DuplicateQuestion(BaseModel):
    questionNumber: str = 'Q'
    marks: Optional[float] = None
    extractedText: str = ''
    imageCropS3Key: Optional[str] = None
    topic: Optional[str] = None
    confidence: Optional[float] = None
    # Carried over from the original paper so a duplicate-detected reupload stays
    # semantically searchable too, not just the first copy (see lib/embeddings.ts).
    embedding: Optional[List[float]] = None


class CheckHashResponse(BaseModel):
    exists: bool = False
    existingFileId: Optional[str] = None
    paperId: Optional[str] = None
    year: Optional[int] = None
    questions: List[DuplicateQuestion] = []
