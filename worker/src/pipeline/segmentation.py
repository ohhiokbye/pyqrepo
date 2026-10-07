"""Conservative deterministic segmentation; ambiguous papers are retried privately."""
import re

NUMBER = re.compile(r'^\s*(?:Q(?:uestion)?\s*\.?\s*)?(\d{1,2})(?:\s*[.)]|\s*\(([a-z])\)|\s*$)\s*(.*)$', re.I)
SUBPART = re.compile(r'^\s*\(([a-z])\)\s+(.+)$', re.I)
MARKS = re.compile(r'\[\s*(\d+(?:\.\d+)?)\s*(?:marks?)?\s*\]|\(\s*(\d+(?:\.\d+)?)\s*marks?\s*\)|(\d+(?:\.\d+)?)\s*marks?\b', re.I)


def segment_pages(pages, image_paths=None):
    if image_paths:
        from src.pipeline.table_segmentation import segment_table_pages
        table_questions = segment_table_pages(pages, image_paths, MARKS)
        if table_questions is not None:
            return table_questions
    questions, current, parent = [], None, None
    for page in pages:
        for index, line in enumerate(page['lines']):
            text = line['text'].strip()
            match = NUMBER.match(text)
            # Marks, CO/BT columns and numbered examples are not question headings.
            # Bare/table numbering must be at the left edge of the page. Explicit
            # Q/Question headings remain supported anywhere in the document.
            polygon = line.get('polygon') or []
            if match and polygon and not re.match(r'^\s*Q(?:uestion)?', text, re.I):
                if min(point[0] for point in polygon) > page['width'] * .15:
                    match = None
            sub = SUBPART.match(text)
            label = None
            if match:
                parent = int(match.group(1))
                label = f'Q{parent}' + (f'({match.group(2).lower()})' if match.group(2) else '')
            elif sub and parent is not None:
                label = f'Q{parent}({sub.group(1).lower()})'
            if label:
                # A parent heading without marks is shared context for its subparts.
                if current and sub and current['questionNumber'] == f'Q{parent}' and not MARKS.search(current['extractedText']):
                    current['questionNumber'] = label
                else:
                    current = {'questionNumber': label, 'extractedText': '', 'marks': None, 'spans': []}
                    questions.append(current)
            if current:
                # Do not absorb exam footer or page markers into a question.
                if re.match(r'^(?:Page\s+\d+|---|End of (?:paper|question))', text, re.I):
                    continue
                current['extractedText'] += ('\n' if current['extractedText'] else '') + text
                current['spans'].append({'pageIndex': page['pageIndex'], 'lineIndex': index})
    for question in questions:
        matches = list(MARKS.finditer(question['extractedText']))
        if matches:
            question['marks'] = float(next(group for group in matches[-1].groups() if group))
        else:
            # Common table layouts have a trailing numeric marks column.
            tail = question['extractedText'].splitlines()[-1].strip()
            if re.fullmatch(r'\d{1,2}', tail) and len(question['extractedText'].splitlines()) > 1:
                question['marks'] = float(tail)
    return questions


def quality_checks(pages, questions, coverage, topic_validated, text, supplied_year=None, detected_year=None):
    reasons = []
    if not pages or any(not page['lines'] for page in pages):
        reasons.append('Page coverage: at least one page has no recognized text')
    if any(page['confidence'] < .80 for page in pages):
        reasons.append('OCR confidence: at least one page is below 0.80')
    labels = [q['questionNumber'] for q in questions]
    if not labels or len(labels) != len(set(labels)):
        reasons.append('Numbering: missing or repeated question labels')
    numbers = sorted(set(int(re.search(r'\d+', label).group()) for label in labels))
    if numbers and numbers != list(range(1, numbers[-1] + 1)):
        reasons.append('Numbering: question sequence has gaps')
    if any(q.get('numberingValidated') is False for q in questions):
        reasons.append('Numbering: table row number could not be validated')
    if coverage < .55:
        reasons.append('Segmentation coverage is below 55%')
    if any(q.get('marks') is None or q['marks'] <= 0 for q in questions):
        reasons.append('Marks: missing or invalid question marks')
    if any(q.get('markConsistency') is False for q in questions):
        reasons.append('Marks: subpart sum conflicts with the table marks column')
    maximum = re.search(r'(?:max(?:imum)?\.?\s*marks|total\s*marks)\s*[:=\-]?\s*(\d+)', text, re.I)
    choice = bool(re.search(r'\b(?:OR|any\s+\w+\s+questions|answer\s+\w+\s+of)\b', text, re.I))
    if maximum and not choice and abs(sum(q.get('marks') or 0 for q in questions) - int(maximum.group(1))) > .01:
        reasons.append('Marks: extracted sum does not match the printed total')
    if any(not q.get('imageCropS3Key') or not q.get('boundingBox') for q in questions):
        reasons.append('Crop agreement: question coordinates or uploaded crop are missing')
    if not topic_validated:
        reasons.append('Topic mapping: unavailable syllabus/model or ambiguous topic match')
    if supplied_year and detected_year and supplied_year != detected_year:
        reasons.append('Year: supplied year conflicts with printed exam year')
    return reasons
