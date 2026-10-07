"""Validate only against the dedicated local database; never touch the app database."""
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit, urlunsplit

root = Path(__file__).resolve().parents[1]
source = root / '.env'
value = next(line.split('=', 1)[1].strip().strip('\"\'') for line in source.read_text().splitlines() if line.startswith('DATABASE_URL='))
url = urlsplit(value)
if url.hostname not in {'localhost', '127.0.0.1'}:
    raise SystemExit('Validation requires a local database URL')
env = {**os.environ, 'DATABASE_URL': urlunsplit((url.scheme, url.netloc, '/cpyq_notes_validation', url.query, '')), 'CPYQ_INTEGRATION': '1'}
action = sys.argv[1] if len(sys.argv) > 1 else 'test'
if action == 'bootstrap':
    admin_url = urlunsplit((url.scheme, url.netloc, '/postgres', '', ''))
    exists = subprocess.run(['psql', admin_url, '-Atc', "SELECT 1 FROM pg_database WHERE datname = 'cpyq_notes_validation'"], capture_output=True, text=True, check=True)
    if not exists.stdout.strip():
        subprocess.run(['psql', admin_url, '-c', 'CREATE DATABASE cpyq_notes_validation'], check=True)
    command = ['./node_modules/.bin/prisma', 'migrate', 'deploy']
elif action == 'migrate':
    command = ['./node_modules/.bin/prisma', 'migrate', 'deploy']
elif action == 'test':
    command = ['npm', 'run', 'test', '--', *sys.argv[2:]]
elif action == 'browser':
    command = ['node', 'tests/browser-smoke.mjs']
else:
    command = ['npm', 'run', action, '--', *sys.argv[2:]]
subprocess.run(command, cwd=root / 'frontend', env=env, check=True)
