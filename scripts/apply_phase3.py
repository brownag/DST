#!/usr/bin/env python3
"""
Phase 3 Transformation: Pre-linkify glossary terms in criterion content

Handles two linkification patterns:
  1. Shared-suffix lists: "densic, lithic, or paralithic contact"
     → each prefix linked to its full glossary term
  2. Full-term matches: "Argillic Horizon" → linked as a unit
"""
import json
import re
import os


def build_suffix_map(glossary):
    """Build suffix_word → {prefix_word: glossary_key} map for two-word terms."""
    suffix_map = {}
    for key, term_obj in glossary.items():
        term_text = term_obj.get('term', '').strip()
        if not term_text:
            continue
        words = term_text.split()
        if len(words) != 2:
            continue
        prefix_lower = words[0].lower()
        suffix_lower = words[1].lower()
        if suffix_lower not in suffix_map:
            suffix_map[suffix_lower] = {}
        suffix_map[suffix_lower][prefix_lower] = key
    return suffix_map


def expand_shared_suffix_lists(text, suffix_map, stats):
    """Linkify shared-suffix lists (e.g., 'densic, lithic, or paralithic contact')."""
    html = text

    for suffix, prefix_map in suffix_map.items():
        if len(prefix_map) < 2:
            continue

        # Regex: known_prefix(, word)*, (and|or) word SUFFIX
        # The (?!and|or) prevents consuming the conjunction as a list item
        prefix_alts = '|'.join(re.escape(p) for p in prefix_map.keys())

        pattern = re.compile(
            r'\b((?:' + prefix_alts + r')'
            r'(?:,\s+(?!(?:and|or)\b)[\w-]+)*'
            r',?\s+(?:and|or)\s+[\w-]+)'
            r'\s+(' + re.escape(suffix) + r')\b',
            re.IGNORECASE
        )

        def make_replacer(sfx, pmap):
            def replacer(match):
                full = match.group(0)
                list_part = match.group(1)
                suffix_text = match.group(2)

                items = re.split(r',\s*', list_part)

                rebuilt = []
                linked_count = 0
                for i, item in enumerate(items):
                    item = item.strip()
                    conj_m = re.match(r'^((?:and|or)\s+)', item, re.IGNORECASE)
                    conj = conj_m.group(1) if conj_m else ''
                    word = item[len(conj):]

                    word_lower = word.lower()
                    is_last = (i == len(items) - 1)

                    if word_lower in pmap:
                        linked_count += 1
                        did = pmap[word_lower]
                        if is_last:
                            rebuilt.append(
                                f'{conj}<span class="glossary-term" '
                                f'data-id="{did}">{word} {suffix_text}</span>'
                            )
                        else:
                            rebuilt.append(
                                f'{conj}<span class="glossary-term" '
                                f'data-id="{did}">{word}</span>'
                            )
                    else:
                        if is_last:
                            rebuilt.append(f'{conj}{word} {suffix_text}')
                        else:
                            rebuilt.append(f'{conj}{word}')

                if linked_count < 2:
                    return full

                stats['lists'] += 1
                stats['prefix_links'] += linked_count
                return ', '.join(rebuilt)
            return replacer

        html = pattern.sub(make_replacer(suffix, prefix_map), html)

    return html


def linkify_content(text, glossary, suffix_map, stats):
    """Linkify glossary terms in criterion content."""
    # Step 1: shared-suffix list expansion
    html = expand_shared_suffix_lists(text, suffix_map, stats)

    # Step 2: protect pre-pass spans so normal pass doesn't double-wrap
    placeholders = {}
    counter = [0]

    def protect(match):
        key = f'\x00GLOSS{counter[0]}\x00'
        placeholders[key] = match.group(0)
        counter[0] += 1
        return key

    html = re.sub(r'<span class="glossary-term"[^>]*>[^<]*</span>', protect, html)

    # Step 3: normal term-by-term replacement (longest first)
    sorted_terms = sorted(
        glossary.values(),
        key=lambda t: len(t.get('term', '')),
        reverse=True
    )

    for term in sorted_terms:
        term_text = term.get('term', '').strip()
        if not term_text:
            continue

        term_id = term.get('id', '').lower().replace(' ', '_')

        pattern = rf'\b{re.escape(term_text)}\b'

        def make_term_replacer(tid):
            def repl(m):
                return (f'<span class="glossary-term" '
                        f'data-id="{tid}">{m.group(0)}</span>')
            return repl

        try:
            html = re.sub(pattern, make_term_replacer(term_id), html,
                          flags=re.IGNORECASE)
        except Exception as e:
            print(f"[!] Warning: Failed to linkify '{term_text}': {e}")

        # Protect newly created spans so shorter terms can't nest inside them
        html = re.sub(r'<span class="glossary-term"[^>]*>[^<]*</span>', protect, html)

    # Step 4: restore protected spans
    for key, val in placeholders.items():
        html = html.replace(key, val)

    return html


# Load existing data
json_path = 'data/keys_optimized.json'
with open(json_path, 'r') as f:
    data = json.load(f)

before_size = os.path.getsize(json_path)

# Get navigation criteria and glossary
nav_criteria = data['navigation']['criteria']
glossary = data.get('glossary', {})

# Build suffix map once
suffix_map = build_suffix_map(glossary)
eligible = {s: p for s, p in suffix_map.items() if len(p) >= 2}
print(f'[OK] Suffix map: {sum(len(v) for v in eligible.values())} prefixes across {len(eligible)} suffix groups')

# Pre-linkify content for all navigation criteria
linkified_count = 0
stats = {'lists': 0, 'prefix_links': 0}
for criterion in nav_criteria:
    content = criterion.get('content', '')
    if content:
        criterion['content_html'] = linkify_content(content, glossary, suffix_map, stats)
        linkified_count += 1

# Write updated data
with open(json_path, 'w') as f:
    json.dump(data, f, separators=(',', ': '))

after_size = os.path.getsize(json_path)
size_change = after_size - before_size
percentage = round(100 * size_change / before_size, 1)

print(f"[OK] Phase 3 complete: {before_size:,} → {after_size:,} bytes ({percentage:+.1f}%)")
print(f"[OK] Criteria linkified: {linkified_count}")
print(f"[OK] Lists: {stats['lists']}, prefix links: {stats['prefix_links']}, terms: {len(glossary)}")
