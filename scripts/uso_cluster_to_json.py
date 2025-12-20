"""
Convert HPC cluster usage text log to nested JSON.

Input format (repeating per minute):
  <timestamp line> e.g. "Thu Dec 18 04:37:01 2025"
  JOBID               USER                TRES_ALLOC                                                      STATE
  <records...>

Each record line example:
  61040               matbwyler           cpu=32,mem=64G,node=1,billing=32,gres/gpu=4,gres/gpu:a40=4      RUNNING

Output JSON structure:
{
  "<timestamp>": {
    "<user>": {
      "<gpu_type>": {
        "<jobid>": {
          "gpu_number": <int>,
          "cpu": <int>,
          "mem": <str>,
          "node": <int>,
          "billing": <int>,
          "state": <str>
        }
      }
    }
  }
}

Notes:
- Only jobs with a typed GPU in TRES (keys like "gres/gpu:a30", "gres/gpu:a40", "gres/gpu:a100") are included.
- Jobs without a typed GPU are skipped (can be enabled via flag in the future).
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from typing import Dict, Any, Optional


TIMESTAMP_FORMAT = "%a %b %d %H:%M:%S %Y"  # e.g., Thu Dec 18 04:37:01 2025


def is_timestamp_line(line: str) -> Optional[str]:
    """Return normalized timestamp string if line is a timestamp, else None.

    Keeps the raw line by default; if parseable, returns the raw trimmed string.
    """
    s = line.strip()
    if not s:
        return None
    try:
        # Validate it matches expected format; we still return raw string
        datetime.strptime(s, TIMESTAMP_FORMAT)
        return s
    except ValueError:
        return None


RECORD_RE = re.compile(r"^\s*(?P<jobid>\d+)\s+(?P<user>\S+)\s+(?P<tres>.*?)\s+(?P<state>[A-Z]+)\s*$")


def parse_tres_alloc(tres: str) -> Dict[str, str]:
    """Parse comma-separated TRES key=value pairs into a dict of strings."""
    result: Dict[str, str] = {}
    for part in tres.split(','):
        part = part.strip()
        if not part:
            continue
        if '=' not in part:
            # Ignore malformed pieces
            continue
        key, value = part.split('=', 1)
        result[key.strip()] = value.strip()
    return result


def ensure_nested(d: Dict[str, Any], *keys: str) -> Dict[str, Any]:
    """Ensure nested dicts exist for keys and return the deepest dict."""
    cur = d
    for k in keys:
        if k not in cur or not isinstance(cur[k], dict):
            cur[k] = {}
        cur = cur[k]  # type: ignore[index]
    return cur


def parse_usage_file(path: str) -> Dict[str, Any]:
    """Parse the usage file into the requested nested structure."""
    data: Dict[str, Any] = {}
    current_ts: Optional[str] = None

    with open(path, 'r', encoding='utf-8') as f:
        for raw_line in f:
            line = raw_line.rstrip('\n')

            ts = is_timestamp_line(line)
            if ts is not None:
                current_ts = ts
                ensure_nested(data, current_ts)
                continue

            sline = line.strip()
            if not sline:
                continue
            if sline.startswith('JOBID'):
                # Header line; skip
                continue

            # Record line
            m = RECORD_RE.match(line)
            if not m:
                # Unrecognized line; skip
                continue

            if not current_ts:
                # Safety: if a record appears before a timestamp, skip
                continue

            jobid = m.group('jobid')
            user = m.group('user')
            tres = m.group('tres').strip()
            state = m.group('state').strip()

            tres_dict = parse_tres_alloc(tres)

            # Identify typed GPU entries: keys like 'gres/gpu:a40'
            typed_gpu_entries = [(k.split(':', 1)[1], v) for k, v in tres_dict.items() if k.startswith('gres/gpu:') and ':' in k]
            if not typed_gpu_entries:
                # Skip jobs without a typed GPU
                continue

            # Use parsed CPU, MEM, NODE, BILLING values if present
            cpu = _safe_int(tres_dict.get('cpu'))
            mem = tres_dict.get('mem')
            node = _safe_int(tres_dict.get('node'))
            billing = _safe_int(tres_dict.get('billing'))

            # For each typed GPU entry, add a job record under that gpu_type
            for gpu_type, gpu_val in typed_gpu_entries:
                gpu_number = _safe_int(gpu_val)
                leaf = ensure_nested(data, current_ts, user, gpu_type)
                leaf[jobid] = {
                    'gpu_number': gpu_number,
                    'cpu': cpu,
                    'mem': mem,
                    'node': node,
                    'billing': billing,
                    'state': state,
                }

    return data


def _safe_int(val: Optional[str]) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(val)
    except ValueError:
        # Strip any trailing non-digits (e.g., '64G') and retry
        m = re.match(r"^(\d+)", val)
        if m:
            try:
                return int(m.group(1))
            except Exception:
                return None
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert HPC usage text file to nested JSON by date, user, gpu_type, jobid.")
    parser.add_argument('--input', '-i', required=True, help='Path to uso_cluster.txt')
    parser.add_argument('--output', '-o', required=True, help='Path to write JSON output')
    parser.add_argument('--indent', type=int, default=2, help='JSON indentation (default: 2)')
    args = parser.parse_args()

    result = parse_usage_file(args.input)
    with open(args.output, 'w', encoding='utf-8') as out:
        json.dump(result, out, indent=args.indent, ensure_ascii=False)


if __name__ == '__main__':
    main()
