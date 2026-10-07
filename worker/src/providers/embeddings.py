"""One local embedding space for syllabus mapping, deduplication and indexing."""
import os
import re

MODEL = os.environ.get('LOCAL_EMBEDDING_MODEL', 'sentence-transformers/all-mpnet-base-v2')


def _terms(text):
    words = re.findall(r'[a-z0-9]+\+?', text.lower())
    def stem(word):
        if word.endswith('ies'):
            return word[:-3]+'y'
        if len(word) > 5 and word.endswith('ing'):
            return word[:-3]
        if len(word) > 3 and word.endswith('s'):
            return word[:-1]
        return word
    tokens = {stem(word) for word in words}
    tokens.update(word[:-2] for word in list(tokens) if len(word) > 7 and word.endswith('ic'))
    return tokens


def _explicit_topic(text, topic):
    words = _terms(text)
    core = re.split(r'[:(]', topic)[0]
    required = _terms(core)-{'and', 'or', 'of', 'the', 'for', 'single', 'multi', 'level'}
    if required and required <= words:
        return True
    # A listed normal form/protocol acronym is explicit evidence, e.g. BCNF.
    bracketed = re.findall(r'\(([^)]+)\)', topic)
    acronyms = {word.lower() for part in bracketed for word in re.findall(r'\b[A-Z0-9]{2,}\b', part)}
    return bool(acronyms & {word.lower() for word in re.findall(r'\b[A-Za-z0-9]{2,}\b', text)})

class LocalEmbeddings:
    def __init__(self):
        self._model = None
        self._topic_cache = {}

    def encode(self, texts):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(MODEL, device=os.environ.get('EMBEDDING_DEVICE', 'cpu'))
        vectors = self._model.encode(texts, normalize_embeddings=True, batch_size=int(os.environ.get('EMBEDDING_BATCH_SIZE', '16')))
        if vectors.shape[1] != 768:
            raise ValueError('Embedding model must produce 768 dimensions')
        return vectors

    def map_questions(self, questions, topics):
        if not questions or not topics:
            return False
        import numpy as np
        key = tuple(topics)
        if key not in self._topic_cache:
            topic_vectors = self.encode(topics)
            # Near-identical syllabus entries must not compete with themselves
            # in the confidence-margin check. Keep a stable existing topic name.
            groups = []
            for index, vector in enumerate(topic_vectors):
                core = re.split(r'[:(]', topics[index])[0].strip().casefold()
                group = next((g for g in groups if all(float(vector @ topic_vectors[i]) >= .9 or (core and core == re.split(r'[:(]', topics[i])[0].strip().casefold()) for i in g)), None)
                if group is None:
                    groups.append([index])
                else:
                    group.append(index)
            self._topic_cache = {key: (topic_vectors, groups)}
        topic_vectors, groups = self._topic_cache[key]
        vectors = self.encode([q['extractedText'] for q in questions])
        threshold = float(os.environ.get('TOPIC_MATCH_THRESHOLD', '0.35'))
        margin = float(os.environ.get('TOPIC_MATCH_MARGIN', '0.03'))
        segments, owners = [], []
        for index, question in enumerate(questions):
            text = question['extractedText']
            headings = list(re.finditer(r'(?m)^\s*(?:\([a-zivxlcdm]{1,5}\)|[a-z][.)])\s+', text, re.I))
            chunks = []
            if len(headings) >= 2:
                prelude = text[:headings[0].start()].strip().splitlines()
                context = '\n'.join(prelude if len(prelude) <= 4 else prelude[:2]+prelude[-2:])[:500]
                for n, heading in enumerate(headings):
                    end = headings[n+1].start() if n+1 < len(headings) else len(text)
                    part = text[heading.end():end].strip()
                    if len(part) >= 20:
                        chunks.append(f'{context}\n{part}'.strip())
            for chunk in chunks if len(chunks) >= 2 else [text]:
                segments.append(chunk)
                owners.append(index)
        segment_vectors = self.encode(segments)
        matches = [[] for _ in questions]
        for owner, text, row in zip(owners, segments, segment_vectors @ topic_vectors.T):
            group_scores = np.array([max(float(row[i]) for i in group) for group in groups])
            order = np.argsort(group_scores)[::-1]
            best = float(group_scores[order[0]])
            gap = best-float(group_scores[order[1]]) if len(order) > 1 else 1.
            name = min((topics[i] for i in groups[int(order[0])]), key=lambda name: (len(name), name.casefold(), name))
            backed = []
            for group_index in order:
                score = float(group_scores[group_index])
                if score < threshold or best-score > margin:
                    continue
                canonical = min((topics[i] for i in groups[int(group_index)]), key=lambda name: (len(name), name.casefold(), name))
                if _explicit_topic(text, canonical):
                    backed.append({'name': canonical, 'confidence': max(0., min(1., score)), 'margin': gap, 'validated': True, 'validation': 'syllabus-terms'})
            matches[owner].extend(backed or [{'name': name, 'confidence': max(0., min(1., best)), 'margin': gap, 'validated': best >= threshold and gap >= margin, 'validation': 'semantic-margin'}])
        for question, vector, parts in zip(questions, vectors, matches):
            strongest = max(parts, key=lambda part: part['confidence'])
            mapped = {}
            for part in parts:
                if part['name'] not in mapped or part['confidence'] > mapped[part['name']]['confidence']:
                    mapped[part['name']] = {'name': part['name'], 'confidence': part['confidence']}
            question.update(embedding=vector.tolist(), embeddingModel=MODEL, topic=strongest['name'], confidence=strongest['confidence'], topics=list(mapped.values()), topicChecks=parts, topicValidated=all(part['validated'] for part in parts))
        return all(q['topicValidated'] for q in questions)
