# 06. 클라이언트 샘플 (curl / Python / JS)

각 언어로 **health → parse → sync** 순의 최소 작동 예제. 실제 운영에서 바로 복붙해 쓸 수 있도록 리트라이/에러 처리도 포함.

## 공통 변수

```
BASE   = http://localhost:8000
KEY    = <.env 의 BRIS_API_KEY 값>
HTML   = lib/bris-parser/test/fixtures/dm.html (예제 픽스처)
```

---

## 1. curl (bash)

```sh
#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:8000}"
KEY="${BRIS_API_KEY:-$(grep '^BRIS_API_KEY=' .env | cut -d= -f2-)}"

# --- 1) health ---
curl -sf "$BASE/v1/health" | python -m json.tool

# --- 2) parse/dm (raw HTML) ---
curl -sf -X POST "$BASE/v1/parse/dm" \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: text/html" \
  --data-binary @lib/bris-parser/test/fixtures/dm.html \
  | python -m json.tool | head -20

# --- 3) parse/edu-detail (JSON) ---
HTML=$(cat lib/bris-parser/test/fixtures/edu_detail.html | python -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
curl -sf -X POST "$BASE/v1/parse/edu-detail" \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"html\": $HTML}"

# --- 4) sync (BRIS 날짜 범위) ---
curl -sf -X POST "$BASE/v1/sync" \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2026-04-01","endDate":"2026-04-30","autoBatch":false}' \
  | python -m json.tool
```

### 에러 발생 시 로컬 체크

```sh
# HTTP 코드만 보고 싶을 때
curl -s -o /tmp/resp.json -w "%{http_code}\n" \
  -X POST "$BASE/v1/parse/dm" \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: text/html" \
  --data-binary @lib/bris-parser/test/fixtures/dm.html

# 코드가 4xx/5xx 면 응답 바디 확인
cat /tmp/resp.json
```

---

## 2. Python (`requests`)

```python
"""bris_api_client.py — 최소 클라이언트 예제"""
import os
import time
import json
from pathlib import Path

import requests

BASE = os.environ.get("BRIS_API_BASE", "http://localhost:8000")
KEY = os.environ["BRIS_API_KEY"]
FIXTURES = Path(__file__).parent / "lib/bris-parser/test/fixtures"


class BrisApiClient:
    def __init__(self, base: str = BASE, key: str = KEY, timeout: int = 60):
        self.base = base.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({"X-API-Key": key})
        self.timeout = timeout

    # ---------- 메타 ----------
    def health(self) -> dict:
        r = self.session.get(f"{self.base}/v1/health", timeout=5)
        r.raise_for_status()
        return r.json()

    # ---------- Parse ----------
    def parse(self, kind: str, html: str) -> dict | list:
        """kind: 'dm', 'edu-detail', 'integrated', 'integrated/camelcase', ..."""
        r = self.session.post(
            f"{self.base}/v1/parse/{kind}",
            data=html.encode("utf-8"),
            headers={"Content-Type": "text/html"},
            timeout=self.timeout,
        )
        if not r.ok:
            raise ApiError(r.status_code, r.json().get("detail", r.text))
        return r.json()

    # ---------- Sync ----------
    def sync(self, start_date: str, end_date: str, auto_batch: bool = True) -> dict:
        r = self.session.post(
            f"{self.base}/v1/sync",
            json={"startDate": start_date, "endDate": end_date, "autoBatch": auto_batch},
            timeout=300,   # sync 는 장시간 걸릴 수 있음
        )
        if not r.ok:
            raise ApiError(r.status_code, r.json().get("detail", r.text))
        return r.json()

    def sync_from_html(self, html: str, period_start: str | None = None,
                       period_end: str | None = None, auto_batch: bool = False) -> dict:
        r = self.session.post(
            f"{self.base}/v1/sync/from-html",
            json={
                "html": html,
                "periodStart": period_start,
                "periodEnd": period_end,
                "autoBatch": auto_batch,
            },
            timeout=300,
        )
        if not r.ok:
            raise ApiError(r.status_code, r.json().get("detail", r.text))
        return r.json()


class ApiError(Exception):
    def __init__(self, status: int, detail):
        self.status = status
        self.detail = detail
        super().__init__(f"[HTTP {status}] {detail}")


# ---------------- 사용 ----------------
if __name__ == "__main__":
    cli = BrisApiClient()

    # 1) health
    print("health:", cli.health())

    # 2) parse
    html = (FIXTURES / "dm.html").read_text(encoding="utf-8")
    result = cli.parse("dm", html)
    print("DM name:", result.get("name"))

    # 3) sync (가짜 실행 — BRIS 자격증명 없이는 500 예상)
    try:
        r = cli.sync("2026-04-01", "2026-04-30", auto_batch=False)
        print("synced total:", r["total_records"], "errors:", len(r["errors"]))
    except ApiError as e:
        print(f"sync skipped: {e}")
```

### 리트라이 패턴

```python
from time import sleep

def with_retry(fn, max_attempts=3, backoff=2.0):
    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except ApiError as e:
            if e.status in (401, 422):
                raise  # 클라이언트 쪽 오류 — 재시도 무의미
            if attempt == max_attempts:
                raise
            sleep(backoff ** attempt)

# 사용
result = with_retry(lambda: cli.parse("dm", html))
```

---

## 3. JavaScript (`fetch`, Node.js 18+ / 브라우저)

```javascript
// bris-api-client.mjs
const BASE = process?.env?.BRIS_API_BASE ?? 'http://localhost:8000';
const KEY  = process?.env?.BRIS_API_KEY  ?? '';

class ApiError extends Error {
  constructor(status, detail) {
    super(`[HTTP ${status}] ${JSON.stringify(detail)}`);
    this.status = status;
    this.detail = detail;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'X-API-Key': KEY,
      ...(options.headers ?? {}),
    },
  });
  const body = await res.text();
  let parsed;
  try { parsed = JSON.parse(body); } catch { parsed = body; }
  if (!res.ok) throw new ApiError(res.status, parsed?.detail ?? parsed);
  return parsed;
}

// ---------- API ----------
export const brisApi = {
  health: () => request('/v1/health'),

  parse: (kind, html) => request(`/v1/parse/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/html' },
    body: html,
  }),

  parseJson: (kind, html) => request(`/v1/parse/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  }),

  sync: (startDate, endDate, autoBatch = true) => request('/v1/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate, autoBatch }),
  }),

  syncFromHtml: (html, { periodStart = null, periodEnd = null, autoBatch = false } = {}) =>
    request('/v1/sync/from-html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, periodStart, periodEnd, autoBatch }),
    }),
};

// ---------- 사용 (Node) ----------
import { readFile } from 'node:fs/promises';

const health = await brisApi.health();
console.log('health:', health);

const html = await readFile('lib/bris-parser/test/fixtures/dm.html', 'utf-8');
const dm = await brisApi.parse('dm', html);
console.log('DM name:', dm.name);

// ---------- 브라우저 (fetch 동일) ----------
// const blob = await (await fetch('/path/to/fixture.html')).text();
// const result = await brisApi.parseJson('dm', blob);
```

### AbortController 로 타임아웃

```javascript
async function parseWithTimeout(kind, html, ms = 60_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await request(`/v1/parse/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/html' },
      body: html,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}
```

---

## 4. Postman / Insomnia

Swagger UI (`http://localhost:8000/docs`) 우상단 **"/openapi.json"** 을 다운로드해 Postman 에 **Import → OpenAPI 3.0** 으로 가져오면 모든 엔드포인트가 collection 으로 생성됩니다. Authorization 에 API Key (Header: `X-API-Key`) 를 추가하면 끝.

## 다음

- 응답 오류 코드 해석 → [`05-error-codes.md`](./05-error-codes.md)
- 운영 / 로그 확인 → [`07-operations.md`](./07-operations.md)
