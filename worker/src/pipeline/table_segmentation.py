"""Read ruled exam tables as main-question rows, keeping subparts together."""
import re


def _box(line):
    polygon = line.get('polygon') or []
    if not polygon:
        return None
    return (min(p[0] for p in polygon), min(p[1] for p in polygon),
            max(p[0] for p in polygon), max(p[1] for p in polygon))


def _rules(image_path, width, height):
    import cv2
    image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if image is None:
        return []
    scale = min(1., 1200 / image.shape[1])
    if scale < 1:
        image = cv2.resize(image, None, fx=scale, fy=scale)
    lines = cv2.createLineSegmentDetector().detect(image)[0]
    if lines is None:
        return []
    segments = []
    for x1, y1, x2, y2 in lines[:, 0]:
        x1, x2 = float(x1 / scale), float(x2 / scale)
        y1, y2 = float(y1 / scale), float(y2 / scale)
        if abs(x2-x1) < width * .1 or abs(y2-y1) > abs(x2-x1) * .1:
            continue
        # Evaluate tilted borders at the centre of the description column.
        y = y1 + (width * .45-x1) * (y2-y1)/(x2-x1)
        if 0 <= y <= height:
            segments.append((y, min(x1, x2), max(x1, x2)))
    groups = []
    for segment in sorted(segments):
        if groups and segment[0]-groups[-1][-1][0] < height * .012:
            groups[-1].append(segment)
        else:
            groups.append([segment])
    boundaries = []
    for group in groups:
        intervals = sorted((item[1], item[2]) for item in group)
        covered = 0
        left, right = intervals[0]
        for x0, x1 in intervals[1:]:
            if x0 <= right:
                right = max(right, x1)
            else:
                covered += right-left
                left, right = x0, x1
        covered += right-left
        if covered >= width*.55 and min(item[1] for item in group) < width*.2 and max(item[2] for item in group) > width*.75:
            boundaries.append(sum(item[0] for item in group)/len(group))
    return boundaries


def _mark_band(image_path, width, height, fallback):
    """Find the cell after the widest (description) column on each scan."""
    import cv2
    image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if image is None:
        return fallback
    lines = cv2.createLineSegmentDetector().detect(image)[0]
    if lines is None:
        return fallback
    segments = []
    for x1, y1, x2, y2 in lines[:, 0]:
        if abs(y2-y1) < height*.1 or abs(x2-x1) > abs(y2-y1)*.15:
            continue
        x = float(x1+(height*.5-y1)*(x2-x1)/(y2-y1))/width
        if 0 <= x <= 1:
            segments.append((x, float(min(y1, y2)), float(max(y1, y2))))
    groups = []
    for segment in sorted(segments):
        if groups and segment[0]-groups[-1][-1][0] < .02:
            groups[-1].append(segment)
        else:
            groups.append([segment])
    columns = []
    for group in groups:
        intervals = sorted((item[1], item[2]) for item in group)
        lower, upper = intervals[0]
        covered = 0
        for y0, y1 in intervals[1:]:
            if y0 <= upper:
                upper = max(upper, y1)
            else:
                covered += upper-lower
                lower, upper = y0, y1
        covered += upper-lower
        if covered >= height*.4:
            columns.append(sum(item[0] for item in group)/len(group))
    if len(columns) < 2:
        return fallback
    index = max(range(len(columns)-1), key=lambda i: columns[i+1]-columns[i])
    if columns[index+1]-columns[index] < .45 or columns[index+1] < .7:
        return fallback
    left = columns[index+1]
    right = columns[index+2] if index+2 < len(columns) else 1.
    return left, right


def segment_table_pages(pages, image_paths, marks_pattern):
    """Return None for ordinary papers; require a recognised exam-table header."""
    if not pages or not image_paths:
        return None
    first = pages[0]
    description = next((l for l in first['lines'] if l['text'].strip().lower() == 'description'), None)
    header = next((l for l in first['lines'] if l['text'].strip().lower() == 'marks'), None)
    if not description or not header or not _box(header) or not _box(description):
        return None
    mark_box, desc_box = _box(header), _box(description)
    if abs(mark_box[1]-desc_box[1]) > first['height'] * .08:
        return None
    mark_band = (mark_box[0]/first['width']-.015, mark_box[2]/first['width']+.002)
    start = max(mark_box[3], desc_box[3]) + 2
    questions = []
    row_evidence = []
    for page, image_path in zip(pages, image_paths):
        page_mark_band = _mark_band(image_path, page['width'], page['height'], mark_band)
        lower = start if page['pageIndex'] == 0 else 0
        borders = [lower] + [y for y in _rules(image_path, page['width'], page['height']) if lower + 5 < y < page['height']-5] + [page['height']]
        for row_index, (top, bottom) in enumerate(zip(borders, borders[1:])):
            if bottom-top < 10:
                continue
            body, spans, labels, column_marks = [], [], [], []
            for index, line in enumerate(page['lines']):
                box = _box(line)
                if not box:
                    continue
                text = line['text'].strip()
                if re.search(r'all\s+the\s+best|faculty\s+sign|end\s+of\s+(?:paper|question)', text, re.I):
                    continue
                centre = (box[0]+box[2])/2/page['width']
                number = re.fullmatch(r'(?:Q\s*)?(\d{1,2})[.)]?', text, re.I)
                y = (box[1]+box[3])/2
                # On tilted rows a top-aligned number can sit just above the
                # border evaluated at the description column's centre.
                if number and centre < .07:
                    y += page['height']*.008
                if not top <= y < bottom:
                    continue
                if number and centre < .07:
                    labels.append(int(number.group(1)))
                    spans.append({'pageIndex': page['pageIndex'], 'lineIndex': index})
                elif number and page_mark_band[0] <= centre <= page_mark_band[1]:
                    column_marks.append(float(number.group(1)))
                    spans.append({'pageIndex': page['pageIndex'], 'lineIndex': index})
                elif centre < page_mark_band[0] and not re.match(r'^(?:Page\s+\d+|---)', text, re.I):
                    body.append((box[1], box[0], text))
                    spans.append({'pageIndex': page['pageIndex'], 'lineIndex': index})
            # Ignore borders, signatures and empty table fragments.
            if sum(len(item[2]) for item in body) < 40:
                continue
            if len(set(labels)) > 1 or len(column_marks) > 1:
                return None  # Borders did not isolate rows; use conservative fallback.
            label = labels[0] if labels else None
            continuation = bool(questions and row_index == 0 and page['pageIndex'] > 0 and not labels and not column_marks)
            if questions and label == int(questions[-1]['questionNumber'][1:]):
                continuation = True
            if continuation:
                question = questions[-1]
            else:
                number = label if label is not None else (int(questions[-1]['questionNumber'][1:])+1 if questions else 1)
                question = {'questionNumber': f'Q{number}', 'extractedText': '', 'marks': None, 'spans': [], 'tableRows': []}
                questions.append(question)
                row_evidence.append((number, label is not None))
            question['extractedText'] += ('\n' if question['extractedText'] else '') + '\n'.join(item[2] for item in sorted(body))
            question['spans'].extend(spans)
            question['tableRows'].append({'pageIndex': page['pageIndex'], 'top': max(0, int(top)), 'bottom': min(page['height'], int(bottom))})
            if column_marks:
                question['marks'] = column_marks[0]
    if not questions:
        return None
    for question in questions:
        inline = [float(next(group for group in m.groups() if group)) for m in marks_pattern.finditer(question['extractedText'])]
        if question['marks'] is None and inline:
            question['marks'] = sum(inline)
        question['markConsistency'] = not inline or question['marks'] is None or abs(sum(inline)-question['marks']) < .01
    # Infer only a missing number between explicitly recognised neighbours.
    for index, (number, explicit) in enumerate(row_evidence):
        if not explicit:
            previous = row_evidence[index-1] if index else None
            following = row_evidence[index+1] if index+1 < len(row_evidence) else None
            questions[index]['numberingValidated'] = bool(previous and following and previous[1] and following[1] and previous[0]+1 == number == following[0]-1)
    return questions
