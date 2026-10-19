r"""고객사 담당자 유효성 신호 반영 — bris-sync 웨어하우스 → Supabase cs_contacts

원천: D:\claude\bris-sync\data\warehouse.duckdb 의 place_dm_list (읽기 전용).
BRIS 사업장 페이지의 '등록 담당자 전체' 목록으로, 담당자마다 최근 방문일·최근
방문 AM·비활성(퇴직) 여부를 들고 있다.

용도: 과정에 고객 담당자가 지정되지 않아 사업장 DM 목록의 가나다 첫 인원이
그대로 붙은 건(예: 공개과정 → 자사 사업장 첫 인원)을 프로필에서 식별한다.

반영 규칙 (멱등):
  - dm_last_visit_date  = last_visit_date (빈 문자열/파싱실패 → NULL)
  - dm_last_visit_am    = last_visit_am   (빈 문자열 → NULL)
  - dm_is_inactive      = (is_inactive = 'Y')
  - dm_rank_first       = 그 사업장 DM 목록의 가나다 1위 여부
                          (전체 기준 1위 OR 활성 담당자 기준 1위)
  - warehouse 에 customer_id 미존재 → skip (기존 값 보존)
  - 4개 값이 모두 현재와 같으면 PATCH 생략

실행 (bris-sync venv 사용 — duckdb 의존):
  D:\claude\bris-sync\.venv\Scripts\python.exe contact_dm_from_warehouse.py [--dry-run]

환경변수 SUPABASE_URL / SUPABASE_SERVICE_KEY(또는 SUPABASE_KEY) 없으면
스크립트 옆의 .env 에서 읽는다.
"""

import argparse
import datetime
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
        sys.exit('[dm-sync] SUPABASE_URL/KEY 없음 — 환경변수 또는 .env 확인')
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


def _norm_date(v):
    """'2025-12-11' → '2025-12-11'. 빈 값·형식 불명은 None."""
    s = (v or '').strip()
    if not s:
        return None
    s = s.replace('/', '-').replace('.', '-')
    try:
        return datetime.date.fromisoformat(s[:10]).isoformat()
    except ValueError:
        return None


def load_warehouse_dm():
    """customer_id → dict(visit/am/inactive/rank_first). 웨어하우스 read-only.

    rank_first 는 사업장(place_id) 단위로 customer_name 가나다 정렬 1위 여부.
    BRIS 화면이 활성만 나열하는지 전체를 나열하는지 불명이라, 전체 기준 1위와
    활성 기준 1위 중 하나라도 해당하면 플래그를 세운다(의심 신호이므로 재현율 우선).
    """
    import duckdb
    con = duckdb.connect(WAREHOUSE_PATH, read_only=True)
    rows = con.execute("""
        SELECT customer_id, place_id, customer_name,
               last_visit_date, last_visit_am, is_inactive
        FROM place_dm_list
        WHERE customer_id IS NOT NULL AND customer_id <> ''
    """).fetchall()
    con.close()

    by_place = {}
    for r in rows:
        by_place.setdefault(r[1], []).append(r)

    first_ids = set()
    for lst in by_place.values():
        ordered = sorted(lst, key=lambda x: ((x[2] or ''), str(x[0])))
        if ordered:
            first_ids.add(str(ordered[0][0]))
        active = [x for x in ordered if x[5] != 'Y']
        if active:
            first_ids.add(str(active[0][0]))

    out = {}
    for cid, _place, _name, visit, am, inactive in rows:
        cid = str(cid)
        prev = out.get(cid)
        cur = {
            'dm_last_visit_date': _norm_date(visit),
            'dm_last_visit_am': (am or '').strip() or None,
            'dm_is_inactive': (inactive == 'Y'),
            'dm_rank_first': cid in first_ids,
        }
        # customer_id 는 사실상 고유하나 중복 시 최근 방문일이 늦은 쪽을 채택
        if prev is None or (cur['dm_last_visit_date'] or '') > (prev['dm_last_visit_date'] or ''):
            out[cid] = cur
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    url, key = _load_env()
    dm = load_warehouse_dm()
    print(f'[dm-sync] warehouse 담당자 {len(dm)}건 '
          f'(방문일 보유 {sum(1 for v in dm.values() if v["dm_last_visit_date"])}건, '
          f'비활성 {sum(1 for v in dm.values() if v["dm_is_inactive"])}건)')

    contacts = _rest(url, key, 'GET',
                     '/rest/v1/cs_contacts'
                     '?select=id,customer_id,contact_name,dm_last_visit_date,'
                     'dm_last_visit_am,dm_is_inactive,dm_rank_first&limit=5000')
    print(f'[dm-sync] cs_contacts {len(contacts)}건')

    fields = ('dm_last_visit_date', 'dm_last_visit_am', 'dm_is_inactive', 'dm_rank_first')
    updated, unchanged, unmatched, no_cid = 0, 0, 0, 0
    for c in contacts:
        cid = c.get('customer_id')
        if not cid:
            no_cid += 1
            continue
        desired = dm.get(str(cid))
        if desired is None:
            unmatched += 1
            continue
        if all(c.get(f) == desired[f] for f in fields):
            unchanged += 1
            continue
        payload = dict(desired)
        payload['dm_synced_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if not args.dry_run:
            _rest(url, key, 'PATCH',
                  '/rest/v1/cs_contacts?id=eq.' + urllib.parse.quote(str(c['id'])),
                  payload)
        updated += 1
        if updated <= 10:
            print(f'[dm-sync]   {c.get("contact_name")}({cid}): '
                  f'방문 {desired["dm_last_visit_date"] or "(없음)"} / '
                  f'비활성 {desired["dm_is_inactive"]} / 가나다1위 {desired["dm_rank_first"]}')

    tag = ' (dry-run)' if args.dry_run else ''
    print(f'[dm-sync] 완료{tag} — 갱신 {updated}, 동일 {unchanged}, '
          f'미매칭 skip {unmatched}, customer_id 없음 {no_cid}')


if __name__ == '__main__':
    main()
