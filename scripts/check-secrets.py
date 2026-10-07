"""Check commit candidates and Git history without printing matched secret values."""
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
patterns = {
    'AWS access key': re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'Google API key': re.compile(r'\bAIza[0-9A-Za-z_-]{35}\b'),
    'Groq API key': re.compile(r'\bgsk_[0-9A-Za-z]{30,}\b'),
    'GitHub token': re.compile(r'\b(?:gh[pousr]_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{50,})\b'),
    'Private key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    'Credential URL': re.compile(r'\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s/:]+:([^\s@]+)@'),
}
allowed_passwords = {'cpyq_password', 'test', 'password', 'postgres', 'example', 'YOUR_PASSWORD', '<password>'}

def findings(text):
    result = []
    for label, pattern in patterns.items():
        for match in pattern.finditer(text):
            if label == 'Credential URL' and match.group(1) in allowed_passwords:
                continue
            result.append((text.count('\n', 0, match.start()) + 1, label))
    return result

paths = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=root).decode().split('\0')
issues = []
for name in filter(None, paths):
    path = root / name
    if not path.is_file():
        continue
    if path.name.startswith('.env') and path.name != '.env.example':
        issues.append((name, 0, 'Environment file is a commit candidate'))
        continue
    if path.stat().st_size > 3_000_000:
        continue
    text = path.read_text(errors='replace')
    issues.extend((name, line, label) for line, label in findings(text))
# Includes deleted credentials and all local branches; no remote fetch or Git mutation.
history = subprocess.check_output(['git', 'log', '--all', '--format=', '-p', '--no-ext-diff'], cwd=root).decode(errors='replace')
issues.extend(('Git history diff', line, label) for line, label in findings(history))
for name, line, label in issues:
    print(f'{name}:{line}: {label} (value redacted)')
print(f'Secret pattern check: {len(issues)} findings across {len(list(filter(None, paths)))} candidate paths and local history.')
raise SystemExit(bool(issues))
