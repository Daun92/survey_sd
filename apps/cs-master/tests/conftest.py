"""apps/cs-master/tests — bris_api / bris_to_supabase 의 단위 테스트.

bris_to_supabase 가 import 시 `supabase` 등 외부 모듈을 즉시 import 하므로
sys.path 에 `apps/cs-master` 와 `apps/cs-master/lib/bris-parser-py/src` 가
필요하다. 각 테스트 모듈은 본 conftest 가 선행해 path 를 보장한다.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

_HERE = Path(__file__).resolve()
_CS_MASTER = _HERE.parent.parent
_PARSER_SRC = _CS_MASTER / 'lib' / 'bris-parser-py' / 'src'

for p in (_CS_MASTER, _PARSER_SRC):
    sp = str(p)
    if sp not in sys.path:
        sys.path.insert(0, sp)

# Supabase 환경변수 — 진짜 client 를 만들지 않도록 dummy 값 주입 (테스트는 mock 사용)
os.environ.setdefault('SUPABASE_URL', 'http://test.local')
os.environ.setdefault('SUPABASE_SERVICE_KEY', 'test-service-key')
