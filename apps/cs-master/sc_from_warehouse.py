"""SC(수주 소유권) 반영 — bris-sync 웨어하우스 → Supabase cs_projects.sc_name

원천: D:\\claude\\bris-sync\\data\\warehouse.duckdb 의 v_order_sc (읽기 전용).
규약(bris-sync docs/DATA_SOURCE_GUIDE.md §3-5): SC 소유권은 sc_name(전환 조직) 우선,
s_name 폴백 — 판정 결과인 sc_managed_by / is_sc_managed 를 그대로 사용한다.

반영 규칙 (멱등):
  - is_sc_managed = true  → cs_projects.sc_name = sc_managed_by
  - is_sc_managed = false → cs_projects.sc_name = NULL (SC 해제/인수인계 반영)
  - warehouse 에 barCode 미존재 → skip (기존 값 보존)
  - 현재 값과 같으면 PATCH 생략

실행 (bris-sync venv 사용 — duckdb 의존):
  D:\\claude\\bris-sync\\.venv\\Scripts\\python.exe sc_from_warehouse.py [--dry-run]

환경변수 SUPABASE_URL / SUPABASE_SERVICE_KEY(또는 SUPABASE_KEY) 없으면
스크립트 옆의 .env 에서 읽는다.
"""

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

WAREHOUSE_PATH = r'D:\claude\bris-sync\data\warehouse.duckdb'
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')


def _load_env():
    url = os.environ.get('SUPABASE_URL', '')
    key = os.environ.get('SUPABASE_SERVICE_KEY', '') or os.environ.get('SUPABASE_KEY', '')
    if url and key:
        return url, key
    if os.path.exists(ENV_PATH):
        vals = {}
        with open(ENV_PATH, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, _, v = line.partition('=')
                vals[k.strip()] = v.strip()
        url = url or vals.get('SUPABASE_URL', '')
        key = key or vals.get('SUPABASE_SERVICE_KEY', '') or vals.get('SUPABASE_KEY', '')
    if not url or not key:
        sys.exit('[sc-sync] SUPABASE_URL/KEY 없음 — 환경변수 또는 .env 확인')
    return url, key


def _rest(url, key, method, path, body=None):
    req = urllib.request.Request(
        url + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={
            'apikey': key,
            'Authorization': 'Bearer ' + key,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        })
    with urllib.request.urlopen(req) as res:
        raw = res.read()
        return json.loads(raw) if raw else None


def load_warehouse_sc():
    """barCode → sc_name(판정값, 미관리는 None). 웨어하우스 read-only."""
    import duckdb
    con = duckdb.connect(WAREHOUSE_PATH, read_only=True)
    rows = con.execute("""
        SELECT barCode,
               CASE WHEN is_sc_managed THEN sc_managed_by END AS sc
        FROM v_order_sc
        WHERE barCode IS NOT NULL AND barCode <> ''
        QUALIFY row_number() OVER (PARTITION BY barCode ORDER BY _ingested_at DESC) = 1
    """).fetchall()
    con.close()
    return {code: (sc or None) for code, sc in rows}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    url, key = _load_env()
    sc_by_code = load_warehouse_sc()
    print(f'[sc-sync] warehouse 수주 {len(sc_by_code)}건 '
          f'(SC 관리 {sum(1 for v in sc_by_code.values() if v)}건)')

    projects = _rest(url, key, 'GET',
                     '/rest/v1/cs_projects?select=id,bris_code,sc_name&limit=5000')
    print(f'[sc-sync] cs_projects {len(projects)}건')

    unmatched, updated, cleared, unchanged = 0, 0, 0, 0
    for p in projects:
        code = p.get('bris_code')
        if not code or code not in sc_by_code:
            unmatched += 1
            continue
        desired = sc_by_code[code]
        current = p.get('sc_name') or None
        if desired == current:
            unchanged += 1
            continue
        if not args.dry_run:
            _rest(url, key, 'PATCH',
                  '/rest/v1/cs_projects?id=eq.' + urllib.parse.quote(str(p['id'])),
                  {'sc_name': desired})
        if desired is None:
            cleared += 1
            print(f'[sc-sync]   {code}: {current} → (해제)')
        else:
            updated += 1
            print(f'[sc-sync]   {code}: {current or "(없음)"} → {desired}')

    tag = ' (dry-run)' if args.dry_run else ''
    print(f'[sc-sync] 완료{tag} — 갱신 {updated}, 해제 {cleared}, '
          f'동일 {unchanged}, 미매칭 skip {unmatched}')


if __name__ == '__main__':
    main()
