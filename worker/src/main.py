"""Outbound-only worker. Bind its optional health server to 127.0.0.1."""
import asyncio
import os
from contextlib import asynccontextmanager
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
from src.pipeline.processor import DocumentProcessor

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
HEADERS = {'x-internal-worker-key': os.environ.get('WORKER_INTERNAL_KEY', '')}

async def heartbeat(client, job_id, lease_token):
    while True:
        await asyncio.sleep(60)
        try:
            result = await client.post(f'{FRONTEND_URL}/api/jobs/heartbeat', json={'jobId': job_id, 'leaseToken': lease_token})
            if result.status_code == 409:
                return
        except httpx.HTTPError:
            pass  # If connectivity stays down, the lease expires and the server retries.

async def autonomous_job_poller():
    processor = DocumentProcessor()
    async with httpx.AsyncClient(timeout=20, headers=HEADERS) as client:
        while True:
            try:
                response = await client.post(f'{FRONTEND_URL}/api/jobs/poll')
                response.raise_for_status()
                for job in response.json().get('jobs', []):
                    claim = await client.post(f'{FRONTEND_URL}/api/jobs/claim', json={'jobId': job['id']})
                    claim.raise_for_status()
                    data = claim.json()
                    if not data.get('claimed'):
                        continue
                    job['leaseToken'] = data['leaseToken']
                    task = asyncio.create_task(heartbeat(client, job['id'], data['leaseToken']))
                    try:
                        await asyncio.to_thread(processor.process_job, job['id'], job)
                    except Exception as error:
                        # Never log provider request URLs or credentials.
                        print(f"[Worker] Job {job['id']} failed ({type(error).__name__}); lease recovery will retry.")
                    finally:
                        task.cancel()
                        try:
                            await task
                        except asyncio.CancelledError:
                            pass
            except httpx.ConnectError:
                print('[Worker] Cannot connect to the frontend. Start npm --prefix frontend run dev '
                      'and check FRONTEND_URL in worker/.env matches its port; retrying in 15s.', flush=True)
            except httpx.HTTPStatusError as error:
                status = error.response.status_code
                hint = 'Check WORKER_INTERNAL_KEY matches frontend/.env.' if status in (401, 403) else 'Check the frontend terminal and database connection.'
                print(f'[Worker] Frontend returned HTTP {status}. {hint} Retrying in 15s.', flush=True)
            except (httpx.HTTPError, ValueError, KeyError) as error:
                print(f'[Worker] Poll unavailable ({type(error).__name__}); retrying.')
            await asyncio.sleep(15)

@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(autonomous_job_poller())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

app = FastAPI(title='CPYQ Outbound Worker', lifespan=lifespan)

@app.get('/health')
def health():
    return {'status': 'healthy', 'service': 'CPYQ Ingestion Worker'}
