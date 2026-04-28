"""
BRIS → Supabase 동기화 파이프라인
================================

⚠️ 실행 환경: 사내 Docker 호스트 또는 cron (BRIS 사내망 접근 필요).
              Vercel 환경에서 실행되지 않음.
⚠️ DB SSOT: monorepo root 의 supabase/migrations/. 이 파일이 참조하는
            cs_* 테이블/뷰/RPC 의 정의는 거기서만 추가/수정.
⚠️ 본 파일의 진실원: survey_sd/apps/cs-master/bris_to_supabase.py
            (옛 cs/target/bris_to_supabase.py 는 archive — 편집 금지)

bris_api.py로 파싱한 데이터를 cs-survey Supabase DB에 적재.

사용법:
  from bris_to_supabase import BrisSyncPipeline

  pipeline = BrisSyncPipeline(
      supabase_url="https://gdwhbacuzhynvegkfoga.supabase.co",
      supabase_key="your_service_role_key",
      bris_cookies={"ASP.NET_SessionId": "..."}
  )
  result = pipeline.sync("2026-04-01", "2026-04-30")
"""

import hashlib
import json
import os
import re
from datetime import datetime, date, timedelta
from typing import Optional


def _sanitize_date(raw: str) -> Optional[str]:
    """
    DATE 컬럼에 전달하기 전 검증 — 실제 날짜 문자열이 아니면 None.

    - 빈 문자열 → None
    - 파서 sentinel('미적용') → None
    - 'YYYY-MM-DD' prefix 로 시작하는 경우만 통과 (date 파싱 가능)
    - 'YYYYMMDD' 도 수용 (BRIS raw format)
    """
    if not raw:
        return None
    s = str(raw).strip()
    if not s or s == '미적용':
        return None
    # 이미 ISO YYYY-MM-DD (뒤에 시간이 붙어도 prefix OK)
    if re.match(r'^\d{4}-\d{2}-\d{2}', s):
        return s
    # YYYYMMDD → YYYY-MM-DD
    m = re.match(r'^(\d{4})(\d{2})(\d{2})$', s)
    if m:
        return f'{m.group(1)}-{m.group(2)}-{m.group(3)}'
    # 해석 불가 → NULL
    return None

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None

from bris_api import BrisClient, BrisParser, BrisSessionExpired


# ============================================================
# 자동화 알림 큐 적재 헬퍼
# ============================================================
# cs_automation_settings (PR-Auto-1, version=20260428083739) 의 안전망 일부.
# cron 모드 실패 시 이 헬퍼로 cs_dispatch_alerts 큐에 적재 → PR-Auto-5 의
# 이메일 worker 가 운영자에게 알림 발송. pipeline 인스턴스가 깨져도 동작
# 가능하도록 자체 supabase client 를 새로 만든다.

def _enqueue_alert_via_rpc(severity: str, source: str, subject: str,
                           body: Optional[str] = None,
                           context: Optional[dict] = None) -> bool:
    """fn_cs_automation_enqueue_alert RPC 호출. 실패해도 raise 안 함
    (alert 적재 실패가 본 작업 실패를 가리지 않도록 — alert 자체는 보조 채널)."""
    if create_client is None:
        print("[alert] supabase 라이브러리 없음 — alert 스킵")
        return False
    url = os.environ.get('SUPABASE_URL', '')
    key = os.environ.get('SUPABASE_SERVICE_KEY', '')
    if not url or not key:
        print("[alert] SUPABASE_URL/KEY 없음 — alert 스킵")
        return False
    try:
        client = create_client(url, key)
        client.rpc('fn_cs_automation_enqueue_alert', {
            'p_severity': severity,
            'p_source': source,
            'p_subject': subject,
            'p_body': body,
            'p_context': context,
        }).execute()
        print(f"[alert] enqueued — severity={severity} source={source} subject={subject}")
        return True
    except Exception as exc:
        print(f"[alert] enqueue 실패: {exc!r}")
        return False


# ============================================================
# 검증/증분 sync 유틸
# ============================================================

# sync_records() 검증 게이트가 요구하는 필수 필드. 하나라도 비어있으면
# 레코드를 cs_import_errors 로 격리 후 메인 파이프라인에서 제외한다.
REQUIRED_FIELDS = (
    'business_id', 'project_id', 'place_id', 'customer_id',
    '수주코드', '과정명', '고객_담당자',
)


def _canonical_hash(payload: dict) -> str:
    """키 순서 독립적인 SHA1. content hash 증분 sync 용.

    - float/int/str/bool/None/list/dict 만 가정.
    - json.dumps(sort_keys=True, ensure_ascii=False) 로 정규화 후 SHA1.
    """
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha1(blob.encode('utf-8')).hexdigest()


def _split_weeks(start: str, end: str, window_days: int = 7):
    """[start, end] 를 window_days(포함) 단위 윈도우로 분할.

    BRIS complain_reference_list.asp 가 긴 기간에 대해 느리거나 부분 실패하는
    것을 대비. 각 window 의 끝은 다음 window 시작 하루 전.
    """
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    cursor = s
    while cursor <= e:
        window_end = min(cursor + timedelta(days=window_days - 1), e)
        yield cursor.isoformat(), window_end.isoformat()
        cursor = window_end + timedelta(days=1)


class BrisSyncPipeline:
    """BRIS HTML 데이터 → Supabase cs_* 테이블 동기화"""

    def __init__(self,
                 supabase_url: Optional[str] = None,
                 supabase_key: Optional[str] = None,
                 bris_cookies: Optional[dict] = None,
                 bris_cookie_file: Optional[str] = None,
                 bris_client: Optional[object] = None):
        """
        Args:
            supabase_url: Supabase 프로젝트 URL
            supabase_key: Supabase service_role 키
            bris_cookies: BRIS 세션 쿠키 dict
            bris_cookie_file: BRIS 쿠키 JSON 파일 경로
            bris_client: 이미 로그인된 BrisClient 인스턴스
        """
        if create_client is None:
            raise ImportError("supabase 라이브러리 필요: pip install supabase")

        url = supabase_url or os.environ.get('SUPABASE_URL', '')
        key = supabase_key or os.environ.get('SUPABASE_SERVICE_KEY', '')
        if not url or not key:
            raise ValueError("SUPABASE_URL, SUPABASE_SERVICE_KEY 필요")

        self.sb: Client = create_client(url, key)

        if bris_client:
            self.bris = bris_client
        elif bris_cookie_file:
            self.bris = BrisClient.from_cookie_file(bris_cookie_file)
        elif bris_cookies:
            self.bris = BrisClient(cookies=bris_cookies)
        else:
            self.bris = None  # HTML 직접 입력 모드

    # ========================================
    # 메인 동기화
    # ========================================

    def sync(self, start_date: str, end_date: str,
             auto_batch: bool = True) -> dict:
        """
        BRIS에서 데이터를 가져와 Supabase에 동기화.
        sync log를 기록하고, 완료 후 자동 배치 생성 가능.

        Args:
            start_date: 시작일 (YYYY-MM-DD)
            end_date: 종료일 (YYYY-MM-DD)
            auto_batch: True이면 동기화 후 자동으로 배치 생성 및 심사

        Returns:
            {"companies": N, ..., "sync_id": uuid, "batch_id": uuid|None}
        """
        if not self.bris:
            raise ValueError("BRIS 클라이언트가 설정되지 않았습니다")

        # 1) sync 시작 로그
        sync_id = self._sync_start(start_date, end_date)

        try:
            # 2) BRIS 데이터 수집 — 7일 단위 윈도우로 쪼개 부분 실패 격리
            #    Layer 0 적재(원본 + lineage)도 이 단계에서 발생.
            records = self._fetch_records_windowed(start_date, end_date,
                                                    sync_id=sync_id)

            # 3) Supabase 적재 (검증 게이트 포함)
            stats = self.sync_records(records, sync_id=sync_id)
            stats["sync_id"] = sync_id

            # 4) sync 완료 로그
            self._sync_finish(sync_id, "success", stats)

            # 5) 자동 배치 생성
            if auto_batch:
                batch_result = self._post_sync_auto_batch(
                    sync_id, start_date, end_date)
                stats["batch_id"] = batch_result.get("batch_id")
                stats["auto_candidates"] = batch_result.get("candidates", 0)
            else:
                stats["batch_id"] = None
                stats["auto_candidates"] = 0

            return stats

        except Exception as e:
            self._sync_finish(sync_id, "error", error_msg=str(e))
            raise

    def sync_from_html(self, html_content: str,
                       period_start: str = None,
                       period_end: str = None,
                       auto_batch: bool = False) -> dict:
        """
        로컬 HTML에서 파싱하여 동기화.

        Args:
            html_content: BRIS HTML 문자열
            period_start/end: 동기화 기간 (로그용, 없으면 오늘)
            auto_batch: 자동 배치 생성 여부
        """
        today = date.today().isoformat()
        p_start = period_start or today
        p_end = period_end or today

        sync_id = self._sync_start(p_start, p_end)

        try:
            records = BrisParser.parse(html_content)

            # Layer 0 (Bronze) — HTML 직접 입력 모드도 원본 보존
            page_id = self._insert_raw_page(
                html=html_content,
                page_kind='integrated',
                bris_url='local-html',
                fetch_params={'sDate': p_start, 'eDate': p_end},
                sync_id=sync_id,
                fetched_by='manual:sync_from_html',
            )
            for idx, rec in enumerate(records):
                if page_id:
                    rid = self._insert_raw_record(page_id, rec, idx)
                    if rid:
                        rec['_raw_record_id'] = rid

            stats = self.sync_records(records, sync_id=sync_id)
            stats["sync_id"] = sync_id

            self._sync_finish(sync_id, "success", stats)

            if auto_batch:
                batch_result = self._post_sync_auto_batch(
                    sync_id, p_start, p_end)
                stats["batch_id"] = batch_result.get("batch_id")
                stats["auto_candidates"] = batch_result.get("candidates", 0)

            return stats

        except Exception as e:
            self._sync_finish(sync_id, "error", error_msg=str(e))
            raise

    def sync_records(self, records: list[dict],
                     sync_id: Optional[str] = None) -> dict:
        """파싱된 레코드 리스트를 Supabase에 적재.

        적재 전 REQUIRED_FIELDS 검증 게이트 통과 — 실패 건은 cs_import_errors
        테이블로 격리되고 stats['quarantined'] 로 카운트. 상위 호출자는 sync_id
        (cs_sync_logs 의 id) 를 넘겨 격리 레코드와 sync 실행을 연결한다.
        """
        stats = {
            "total_records": len(records),
            "companies": 0, "places": 0, "contacts": 0,
            "projects": 0, "courses": 0, "members": 0,
            "quarantined": 0,
            "hash_skipped_courses": 0,
            "hash_skipped_projects": 0,
            "errors": []
        }

        # 0) 검증 게이트 — 필수 필드 결측 레코드는 cs_import_errors 로 격리
        valid_records = []
        for rec in records:
            missing = [k for k in REQUIRED_FIELDS if not rec.get(k)]
            if missing:
                self._quarantine_record(sync_id, rec, missing, stats)
                continue
            valid_records.append(rec)

        # 1) 프로젝트 그룹핑 (수주코드 기준)
        project_groups: dict[str, list[dict]] = {}
        for rec in valid_records:
            code = rec['수주코드']  # REQUIRED 통과하면 반드시 존재
            project_groups.setdefault(code, []).append(rec)

        for code, group in project_groups.items():
            try:
                self._sync_project_group(code, group, stats)
            except Exception as e:
                stats["errors"].append(f"프로젝트 {code}: {str(e)}")

        print(f"동기화 완료: {stats}")
        return stats

    def _quarantine_record(self, sync_id: Optional[str], rec: dict,
                           missing: list[str], stats: dict):
        """검증 실패 레코드를 cs_import_errors 에 저장.

        테이블이 아직 migration 되지 않은 환경(구 환경) 도 고려해 insert 실패
        시 stats['errors'] 에 기록만 하고 진행. 운영 환경은 migration 적용이
        선행되어야 함.
        """
        try:
            self.sb.table('cs_import_errors').insert({
                'sync_id': sync_id,
                'bris_code': rec.get('수주코드') or None,
                'raw_row': rec,
                'missing_fields': missing,
                'reason': 'validation_gate: missing required fields',
            }).execute()
            stats['quarantined'] += 1
        except Exception as e:
            stats['errors'].append(
                f"quarantine insert 실패 (missing={missing}): {e}"
            )

    # ========================================
    # BRIS fetch (기간 분할 + 세션 재로그인 retry)
    # ========================================

    def _fetch_records_windowed(self, start_date: str, end_date: str,
                                sync_id: Optional[str] = None) -> list[dict]:
        """[start, end] 범위를 7일 윈도우로 쪼개 BRIS 에서 순차 수집.

        Layer 0: 각 윈도우 응답을 cs_bris_raw_pages 에 보존하고, 그 page 안의
        파서 레코드는 cs_bris_raw_records 로 분해 적재. 각 record 의 id 를
        rec['_raw_record_id'] 에 주입해 Layer 1 _upsert_* 가 lineage 로 사용.
        """
        merged: dict[tuple, dict] = {}
        for w_start, w_end in _split_weeks(start_date, end_date):
            html, recs = self._fetch_with_relogin_raw(w_start, w_end)

            # Layer 0 (Bronze) 적재 — raw page + raw records
            page_id = self._insert_raw_page(
                html=html,
                page_kind='integrated',
                bris_url=self.bris.BASE_URL if self.bris else 'unknown',
                fetch_params={'sDate': w_start, 'eDate': w_end},
                sync_id=sync_id,
                fetched_by=os.environ.get('BRIS_SYNC_TRIGGER', 'cron'),
            )

            for idx, rec in enumerate(recs):
                if page_id:
                    raw_record_id = self._insert_raw_record(
                        page_id=page_id,
                        record=rec,
                        record_index=idx,
                    )
                    if raw_record_id:
                        rec['_raw_record_id'] = raw_record_id

                # 동일 "회차" 의 두 윈도우 중복 제거 — (business_id, customer_id) 단위
                key = (rec.get('business_id', ''), rec.get('customer_id', ''))
                merged[key] = rec
        return list(merged.values())

    def _fetch_with_relogin_raw(self, start_date: str, end_date: str) -> tuple:
        """Returns (html, records). 세션 만료 시 ID/PW 로 1회 재로그인."""
        try:
            return self.bris.get_complain_data_with_raw(start_date, end_date)
        except BrisSessionExpired as e:
            uid = os.environ.get('BRIS_USER_ID', '').strip()
            pwd = os.environ.get('BRIS_PASSWORD', '').strip()
            if not (uid and pwd):
                raise
            print(f'[auth] 세션 만료 감지: {e}. ID/PW 로 재로그인 시도 ({uid})')
            if not self.bris.login(uid, pwd):
                raise BrisSessionExpired('재로그인 실패') from e
            print('[auth] 재로그인 성공 — 1회 retry')
            return self.bris.get_complain_data_with_raw(start_date, end_date)

    def _fetch_with_relogin(self, start_date: str, end_date: str) -> list[dict]:
        """레거시 wrapper — raw HTML 폐기. Layer 0 입고는 _fetch_records_windowed 가 담당."""
        _, records = self._fetch_with_relogin_raw(start_date, end_date)
        return records

    # ========================================
    # Layer 0 (BRONZE) 적재 helper
    # ========================================

    def _insert_raw_page(self, html: str, page_kind: str, bris_url: str,
                         fetch_params: dict, sync_id: Optional[str],
                         fetched_by: Optional[str]) -> Optional[str]:
        """cs_bris_raw_pages 에 한 BRIS 응답 보존. (page_kind, sha1) 중복 시 기존 id 반환.

        Returns: page uuid, 또는 실패 시 None (Layer 0 미설치 환경 호환).
        """
        if not html:
            return None
        try:
            sha1 = hashlib.sha1(html.encode('utf-8', errors='replace')).hexdigest()
            # 중복 단축회로 — 동일 응답이면 기존 page id 재사용
            existing = self.sb.table('cs_bris_raw_pages') \
                .select('id') \
                .eq('page_kind', page_kind) \
                .eq('raw_bytes_sha1', sha1) \
                .limit(1).execute()
            if existing.data:
                return existing.data[0]['id']

            result = self.sb.table('cs_bris_raw_pages').insert({
                'page_kind': page_kind,
                'bris_url': bris_url,
                'fetch_params': fetch_params or {},
                'raw_html': html,
                'raw_bytes_sha1': sha1,
                'fetched_by': fetched_by,
                'sync_id': sync_id,
            }).execute()
            return result.data[0]['id']
        except Exception as e:
            print(f"[layer0] raw_page insert 실패(무시): {e}")
            return None

    def _insert_raw_record(self, page_id: str, record: dict,
                           record_index: int) -> Optional[str]:
        """cs_bris_raw_records 에 파서 dict 한 행 보존. content_hash 중복 시 기존 id 재사용.

        - record_kind: 통합 페이지 행은 'integrated_row' 로 통일
        - business_id/project_id/customer_id/bris_place_id 는 별도 컬럼화 (조회 인덱스 활용)
        - payload 는 record dict 그대로(_raw_record_id 등 내부 필드 제외)
        """
        if not page_id:
            return None
        try:
            payload = {k: v for k, v in record.items() if not k.startswith('_')}
            content_hash = _canonical_hash(payload)

            existing = self.sb.table('cs_bris_raw_records') \
                .select('id') \
                .eq('page_id', page_id) \
                .eq('content_hash', content_hash) \
                .limit(1).execute()
            if existing.data:
                return existing.data[0]['id']

            result = self.sb.table('cs_bris_raw_records').insert({
                'page_id': page_id,
                'record_kind': 'integrated_row',
                'record_index': record_index,
                'payload': payload,
                'business_id': record.get('business_id') or None,
                'project_id': record.get('project_id') or None,
                'customer_id': record.get('customer_id') or None,
                'bris_place_id': record.get('place_id') or None,
                'content_hash': content_hash,
            }).execute()
            return result.data[0]['id']
        except Exception as e:
            print(f"[layer0] raw_record insert 실패(무시): {e}")
            return None

    # ========================================
    # 단일 수주코드 백필
    # ========================================

    def refresh_bris_code(self, bris_code: str,
                          date_hint: Optional[str] = None) -> dict:
        """운영자 백필 전용 — 특정 bris_code 한 건만 BRIS 에서 재수집 후 upsert.

        동작:
          1) `date_hint` 가 있으면 ±7일, 없으면 DB 의 해당 bris_code course
             start_date 를 기준으로 ±21일 범위를 스캔.
          2) 해당 bris_code 레코드만 필터링해 `sync_records` 로 적재.

        Returns: stats dict (sync_records 반환값).
        """
        if not self.bris:
            raise ValueError("BRIS 클라이언트가 설정되지 않았습니다")

        # 수주코드 스캔 기간 계산
        if date_hint:
            hint = date.fromisoformat(date_hint)
            start = (hint - timedelta(days=7)).isoformat()
            end = (hint + timedelta(days=7)).isoformat()
        else:
            # DB 에서 course start_date 범위 유추
            proj = self.sb.table('cs_projects') \
                .select('id') \
                .eq('bris_code', bris_code) \
                .limit(1).execute()
            if not proj.data:
                raise ValueError(
                    f"cs_projects 에 bris_code={bris_code} 없음. "
                    "--date-hint 로 범위 지정 필요."
                )
            courses = self.sb.table('cs_courses') \
                .select('start_date,end_date') \
                .eq('project_id', proj.data[0]['id']).execute()
            if not courses.data:
                raise ValueError(
                    f"bris_code={bris_code} 의 course 가 없어 기간 추정 불가. "
                    "--date-hint 로 지정 필요."
                )
            dates = [c['start_date'] for c in courses.data if c.get('start_date')]
            if not dates:
                raise ValueError("course 의 start_date 가 모두 비어있음")
            s = min(date.fromisoformat(d) for d in dates) - timedelta(days=21)
            e = max(date.fromisoformat(d) for d in dates) + timedelta(days=21)
            start, end = s.isoformat(), e.isoformat()

        print(f'[refresh] {bris_code} 범위 {start} ~ {end} 재수집')
        sync_id = self._sync_start(start, end)
        try:
            all_records = self._fetch_records_windowed(start, end)
            scoped = [r for r in all_records if r.get('수주코드') == bris_code]
            print(f'[refresh] 전체 {len(all_records)}건 중 {bris_code} {len(scoped)}건')
            stats = self.sync_records(scoped, sync_id=sync_id)
            stats['sync_id'] = sync_id
            stats['batch_id'] = None
            stats['auto_candidates'] = 0
            self._sync_finish(sync_id, 'success', stats)
            return stats
        except Exception as e:
            self._sync_finish(sync_id, 'error', error_msg=str(e))
            raise

    # ========================================
    # 내부 동기화 로직
    # ========================================

    def _sync_project_group(self, bris_code: str, records: list[dict], stats: dict):
        """수주코드 기준 프로젝트 그룹 동기화

        ⚠ company/place 는 **레코드마다** upsert. 과거엔 records[0] 만 기준으로
          같은 place_id 를 전체 contact 에 붙여, 한 수주코드에 여러 계열사/사업장이
          섞인 경우(예: 코스모그룹 2604-063) 대시보드 표시와 BRIS 실제 사업장이
          달라지는 문제가 있었음.
        """
        first = records[0]

        # 프로젝트는 수주코드 단위 1:1
        project_id = self._upsert_project(first, bris_code, len(records), stats)

        for i, rec in enumerate(records):
            # 레코드별 회사/사업장 — 다중 계열사/사업장 대응
            company_id = self._upsert_company(rec, stats)
            place_id = self._upsert_place(rec, company_id, stats)

            # 담당자 upsert
            contact_id = self._upsert_contact(rec, place_id, stats)

            # 과정 upsert
            self._upsert_course(rec, project_id, contact_id, i, len(records), stats)

            # 프로젝트 멤버
            self._upsert_members(rec, project_id, stats)

    def _upsert_company(self, rec: dict, stats: dict) -> str:
        """회사 upsert, UUID 반환.

        조회 키 우선순위:
          1) biz_reg_no (사업자번호) — BRIS 에서 'N' 은 "없음" 의 placeholder 이므로 제외.
          2) company_name — fallback.
        biz_reg_no 가 있는데 company_name 이 다르면 UPDATE 로 치유 (동일 회사 개명 케이스).
        """
        biz_reg = rec.get('사업자번호', '').strip()
        # BRIS 의 'N' sentinel(사업자번호 없음) 처리
        if biz_reg in ('N', 'n', ''):
            biz_reg = ''
        company_name = rec.get('회사명', '').strip()
        if not company_name:
            return None

        # 사업자번호 기준 검색, 없으면 회사명 기준
        existing = None
        if biz_reg:
            result = self.sb.table('cs_companies') \
                .select('id,company_name,biz_reg_no') \
                .eq('biz_reg_no', biz_reg) \
                .limit(1).execute()
            if result.data:
                existing = result.data[0]

        if not existing:
            result = self.sb.table('cs_companies') \
                .select('id,company_name,biz_reg_no') \
                .eq('company_name', company_name) \
                .limit(1).execute()
            if result.data:
                existing = result.data[0]

        data = {
            "company_name": company_name,
            "biz_reg_no": biz_reg or None,
            "updated_at": datetime.now().isoformat(),
        }

        if existing:
            self.sb.table('cs_companies') \
                .update(data) \
                .eq('id', existing['id']).execute()
            return existing['id']
        else:
            result = self.sb.table('cs_companies') \
                .insert({**data, "created_at": datetime.now().isoformat()}) \
                .execute()
            stats["companies"] += 1
            return result.data[0]['id']

    def _upsert_place(self, rec: dict, company_id: str, stats: dict) -> str:
        """사업장 upsert — bris_place_id 를 canonical key 로 사용.

        data_model_v2.md:755-761 원칙: BRIS PLACE_ID 가 사업장의 고유 식별자.
        이를 bris_place_id 컬럼(2026-04-15 migration)에 기록하고 매칭 키로 씀.

        조회 우선순위:
          1) rec['place_id'] → cs_business_places.bris_place_id
             hit 시 company_id/place_name 드리프트가 있으면 덮어써 치유.
          2) (company_id, place_name) 조합 — bris_place_id 가 NULL 인 레거시 행 호환.
        """
        place_name = rec.get('사업장명', '').strip()
        bris_place_id = (rec.get('place_id') or '').strip() or None
        if not place_name or not company_id:
            return None

        existing = None
        if bris_place_id:
            result = self.sb.table('cs_business_places') \
                .select('id,company_id,place_name,bris_place_id') \
                .eq('bris_place_id', bris_place_id) \
                .limit(1).execute()
            if result.data:
                existing = result.data[0]
        if not existing:
            result = self.sb.table('cs_business_places') \
                .select('id,company_id,place_name,bris_place_id') \
                .eq('company_id', company_id) \
                .eq('place_name', place_name) \
                .limit(1).execute()
            if result.data:
                existing = result.data[0]

        data = {
            "company_id": company_id,
            "place_name": place_name,
            "bris_place_id": bris_place_id,
        }

        if existing:
            # 드리프트(다른 company 또는 다른 place_name) 감지 시 정정
            needs_update = (
                existing.get('company_id') != company_id
                or existing.get('place_name') != place_name
                or (bris_place_id and existing.get('bris_place_id') != bris_place_id)
            )
            if needs_update:
                self.sb.table('cs_business_places') \
                    .update(data) \
                    .eq('id', existing['id']).execute()
            return existing['id']

        result = self.sb.table('cs_business_places') \
            .insert(data).execute()
        stats["places"] += 1
        return result.data[0]['id']

    def _upsert_contact(self, rec: dict, place_id: str, stats: dict) -> str:
        """고객 담당자 upsert.

        BRIS 가 customer_id 를 재할당하는 케이스(예: 133700 박현진 → 이은혁)를
        탐지하기 위해 기존 contact_name 이 다르면 "다른 사람" 으로 간주:
          1) 기존 row 의 customer_id 를 NULL 로 비우고 contact_name 에 [LEGACY-reassigned] 태그
          2) 신규 row 를 INSERT
        이렇게 해야 박현진의 과거 cs_survey_targets 참조가 보존되고 이은혁은
        깨끗한 신규 row 로 들어감.
        """
        cust_id = (rec.get('customer_id', '') or '').strip() or None
        name = rec.get('고객_담당자', '').strip()
        if not name:
            return None

        existing = None
        if cust_id:
            result = self.sb.table('cs_contacts') \
                .select('id,contact_name,customer_id') \
                .eq('customer_id', cust_id) \
                .limit(1).execute()
            if result.data:
                existing = result.data[0]

        # customer_id 재할당 감지 — 이름 완전 일치만 동일 인물로 간주
        if existing and existing.get('contact_name') != name:
            try:
                self.sb.table('cs_contacts') \
                    .update({
                        'customer_id': None,
                        'contact_name': (existing.get('contact_name') or '')
                                        + ' [LEGACY-cid-reassigned]',
                        'updated_at': datetime.now().isoformat(),
                    }) \
                    .eq('id', existing['id']).execute()
                stats.setdefault('contacts_legacy_detached', 0)
                stats['contacts_legacy_detached'] += 1
            except Exception as e:
                stats['errors'].append(
                    f"contact legacy detach 실패 (customer_id={cust_id}, "
                    f"old={existing.get('contact_name')}, new={name}): {e}"
                )
            existing = None  # INSERT 경로로 강제

        data = {
            "customer_id": cust_id,
            "contact_name": name,
            "department": rec.get('고객_부서', '') or None,
            "email": rec.get('고객_이메일', '') or None,
            "phone": rec.get('고객_전화', '') or None,
            "mobile": rec.get('고객_휴대폰', '') or None,
            "place_id": place_id,
            "updated_at": datetime.now().isoformat(),
        }
        raw_record_id = rec.get('_raw_record_id')
        if raw_record_id:
            data["source_raw_record_id"] = raw_record_id

        if existing:
            self.sb.table('cs_contacts') \
                .update(data) \
                .eq('id', existing['id']).execute()
            return existing['id']
        else:
            result = self.sb.table('cs_contacts') \
                .insert(data).execute()
            stats["contacts"] += 1
            return result.data[0]['id']

    def _upsert_project(self, rec: dict, bris_code: str,
                        course_count: int, stats: dict) -> str:
        """프로젝트 upsert

        조회 키: bris_code(수주코드) — 실무상 프로젝트 1:1 식별자.
        과거엔 project_id(BRIS 숫자)로 조회했으나, 초기 레거시 insert 시점에
        오염된 숫자 ID 가 섞여 있어(예: bris_code=2604-005 인데 project_id=34820
        실제는 34447) 재스크랩 후에도 동일 행을 찾지 못해 정정이 되지 않았음.
        bris_code 기준으로 바꾸면 후속 sync 때 project_id 도 최신값으로 덮어씀.
        """
        proj_id = rec.get('project_id', '')

        existing = None
        if bris_code:
            result = self.sb.table('cs_projects') \
                .select('id,last_content_hash') \
                .eq('bris_code', bris_code) \
                .limit(1).execute()
            if result.data:
                existing = result.data[0]
        if not existing and proj_id:
            # bris_code 미매칭 시(구 데이터에 bris_code NULL 등) project_id 로 fallback
            result = self.sb.table('cs_projects') \
                .select('id,last_content_hash') \
                .eq('project_id', proj_id) \
                .limit(1).execute()
            if result.data:
                existing = result.data[0]

        # 날짜 파싱
        reg_date = rec.get('수주_프로젝트_등록일', '')
        order_date = rec.get('수주일', '')
        deadline = rec.get('수주_프로젝트_마감일', '')

        # 에코 상태 판별
        echo_status = rec.get('에코_상태', '')
        echo_enabled = '제외' not in echo_status if echo_status else True

        # 에코 제외 사유 — 파서가 추출한 명시 사유 우선, 없으면 상태 문자열로 fallback
        # (2026-04 파서 보강 이후 echo_exclude_reason 필드에 '고객사 외부망 차단' 등 구체 사유가 담김)
        if not echo_enabled:
            exclude_reason = (rec.get('에코_제외_사유') or '').strip() or echo_status
        else:
            exclude_reason = None

        # hash 대상 — "실제 변경" 을 판별할 의미있는 필드만. updated_at/bris_synced_at 제외.
        hash_payload = {
            "project_id": proj_id or None,
            "bris_code": bris_code or None,
            "project_name": rec.get('수주_프로젝트명', ''),
            "project_type": rec.get('대면_비대면', ''),
            "am_name": rec.get('수주_담당자', '') or None,
            "am_team": rec.get('수주팀', '') or None,
            "execution_team": rec.get('수행팀', '') or None,
            "echo_enabled": echo_enabled,
            "echo_exclude_reason": exclude_reason,
            "total_amount": rec.get('과정_총매출', 0),
            "course_count": course_count,
            "registration_date": _sanitize_date(reg_date),
            "order_date": _sanitize_date(order_date),
            "deadline_date": _sanitize_date(deadline),
        }
        content_hash = _canonical_hash(hash_payload)

        raw_record_id = rec.get('_raw_record_id')

        # 내용 동일 → UPDATE skip. updated_at 이 "실제 변경 시각" 을 유지하게 함.
        # 단 source_raw_record_id 만은 갱신해 lineage 가 항상 최신 page 를 가리키게 함.
        if existing and existing.get('last_content_hash') == content_hash:
            stats['hash_skipped_projects'] += 1
            if raw_record_id:
                self.sb.table('cs_projects') \
                    .update({'source_raw_record_id': raw_record_id}) \
                    .eq('id', existing['id']).execute()
            return existing['id']

        data = {
            **hash_payload,
            "last_content_hash": content_hash,
            "bris_synced_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }
        if raw_record_id:
            data["source_raw_record_id"] = raw_record_id

        if existing:
            self.sb.table('cs_projects') \
                .update(data) \
                .eq('id', existing['id']).execute()
            return existing['id']
        else:
            result = self.sb.table('cs_projects') \
                .insert(data).execute()
            stats["projects"] += 1
            return result.data[0]['id']

    def _upsert_course(self, rec: dict, project_id: str,
                       contact_id: str, index: int,
                       total: int, stats: dict) -> str:
        """교육과정 upsert

        조회 키 우선순위:
          1) (project_id(uuid), course_name, start_date) — 가장 안정적인 조합.
             레거시 행에 잘못 저장된 business_id 도 덮어써 정정됨.
          2) business_id 단일 — 상기 키 조합이 부족할 때만 사용(구 데이터 호환).
        """
        biz_id = rec.get('business_id', '')

        # 날짜 정규화 (YYYYMMDD → YYYY-MM-DD)
        start_raw = rec.get('시작일', '')
        end_raw = rec.get('종료일', '')
        start_date = self._normalize_date(start_raw)
        end_date = self._normalize_date(end_raw)

        course_name = rec.get('과정명', '')

        existing = None
        if project_id and course_name and start_date:
            result = self.sb.table('cs_courses') \
                .select('id,last_content_hash') \
                .eq('project_id', project_id) \
                .eq('course_name', course_name) \
                .eq('start_date', start_date) \
                .limit(1).execute()
            if result.data:
                existing = result.data[0]
        if not existing and biz_id:
            result = self.sb.table('cs_courses') \
                .select('id,last_content_hash') \
                .eq('business_id', biz_id) \
                .limit(1).execute()
            if result.data:
                existing = result.data[0]

        # 교육 종료 판별
        today = date.today()
        is_completed = False
        if end_date:
            try:
                ed = date.fromisoformat(end_date)
                is_completed = ed <= today
            except ValueError:
                pass

        # hash 대상 — 실제 의미있는 필드. session_number/sort_order 는 group 내 index
        # 변동이 있을 수 있어 포함. updated_at/bris_synced_at 제외.
        hash_payload = {
            "project_id": project_id,
            "contact_id": contact_id,
            "business_id": biz_id or None,
            "course_name": course_name,
            "program_name": rec.get('프로그램명', '') or None,
            "education_type": rec.get('대면_비대면', '') or None,
            "session_number": index + 1,
            "revenue": rec.get('과정_총매출', 0),
            "start_date": start_date,
            "end_date": end_date,
            "echo_id": rec.get('echo_id', '') or None,
            "echo_status": rec.get('에코_상태', '') or None,
            "is_completed": is_completed,
            "sort_order": index,
        }
        content_hash = _canonical_hash(hash_payload)

        raw_record_id = rec.get('_raw_record_id')

        if existing and existing.get('last_content_hash') == content_hash:
            stats['hash_skipped_courses'] += 1
            if raw_record_id:
                self.sb.table('cs_courses') \
                    .update({'source_raw_record_id': raw_record_id}) \
                    .eq('id', existing['id']).execute()
            return existing['id']

        data = {
            **hash_payload,
            "last_content_hash": content_hash,
            "bris_synced_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }
        if raw_record_id:
            data["source_raw_record_id"] = raw_record_id

        if existing:
            self.sb.table('cs_courses') \
                .update(data) \
                .eq('id', existing['id']).execute()
            return existing['id']
        else:
            result = self.sb.table('cs_courses') \
                .insert(data).execute()
            stats["courses"] += 1
            return result.data[0]['id']

    def _upsert_members(self, rec: dict, project_id: str, stats: dict):
        """프로젝트 멤버 upsert (AM, 수행담당자, 강사)"""
        members = []

        am = rec.get('수주_담당자', '').strip()
        if am:
            members.append(('am', am, rec.get('수주팀', '')))

        exec_mgr = rec.get('수행_담당자', '').strip()
        if exec_mgr:
            members.append(('consultant', exec_mgr, rec.get('수행팀', '')))

        internal = rec.get('사내강사', '').strip()
        if internal:
            for name in internal.split(','):
                name = name.strip()
                if name:
                    members.append(('internal_instructor', name, ''))

        external = rec.get('외부강사', '').strip()
        if external:
            for name in external.split(','):
                name = name.strip()
                if name:
                    members.append(('external_instructor', name, ''))

        for role, name, team in members:
            # 중복 체크
            existing = self.sb.table('cs_project_members') \
                .select('id') \
                .eq('project_id', project_id) \
                .eq('role', role) \
                .eq('member_name', name) \
                .limit(1).execute()

            if not existing.data:
                self.sb.table('cs_project_members') \
                    .insert({
                        "project_id": project_id,
                        "role": role,
                        "member_name": name,
                        "team": team or None,
                    }).execute()
                stats["members"] += 1

    # ========================================
    # Sync Log 연동 (Supabase 함수 호출)
    # ========================================

    def _sync_start(self, start_date: str, end_date: str) -> str:
        """fn_cs_sync_start 호출 → sync_id(uuid) 반환"""
        result = self.sb.rpc('fn_cs_sync_start', {
            'p_start': start_date,
            'p_end': end_date,
        }).execute()
        sync_id = result.data
        print(f"[sync] 시작 — sync_id: {sync_id}, 기간: {start_date}~{end_date}")
        # bris.sync_runs 미러링 — /admin 모니터링 패널용.
        # 실패해도 본 파이프라인은 계속 (격리 테이블).
        try:
            run = self.sb.rpc('fn_bris_sync_run_start', {
                'p_endpoint': 'cs_integrated',
                'p_window_start': start_date,
                'p_window_end': end_date,
                'p_trigger': os.environ.get('BRIS_SYNC_TRIGGER', 'cron'),
            }).execute()
            self._sync_run_id = run.data
        except Exception as e:
            self._sync_run_id = None
            print(f"[sync] bris.sync_runs 미러링 시작 실패(무시): {e}")
        return sync_id

    def _sync_finish(self, sync_id: str, status: str,
                     stats: dict = None, error_msg: str = None):
        """fn_cs_sync_finish 호출 — 동기화 결과 기록"""
        stats = stats or {}
        self.sb.rpc('fn_cs_sync_finish', {
            'p_sync_id': sync_id,
            'p_status': status,
            'p_fetched': stats.get('total_records', 0),
            'p_upserted': (stats.get('companies', 0) + stats.get('contacts', 0)
                           + stats.get('projects', 0) + stats.get('courses', 0)),
            'p_new_companies': stats.get('companies', 0),
            'p_new_contacts': stats.get('contacts', 0),
            'p_new_projects': stats.get('projects', 0),
            'p_new_courses': stats.get('courses', 0),
            'p_error': error_msg,
        }).execute()
        print(f"[sync] 완료 — status: {status}"
              + (f", error: {error_msg}" if error_msg else ""))
        # bris.sync_runs 미러링 — 모니터링용 종료 업데이트.
        run_id = getattr(self, '_sync_run_id', None)
        if run_id:
            try:
                upserted = (stats.get('companies', 0) + stats.get('contacts', 0)
                            + stats.get('projects', 0) + stats.get('courses', 0))
                norm_status = 'success' if status == 'success' else 'failed'
                self.sb.rpc('fn_bris_sync_run_finish', {
                    'p_run_id': run_id,
                    'p_status': norm_status,
                    'p_rows_fetched': stats.get('total_records', 0),
                    'p_rows_inserted': upserted,
                    'p_rows_skipped': stats.get('quarantined', 0),
                    'p_error': error_msg,
                }).execute()
            except Exception as e:
                print(f"[sync] bris.sync_runs 미러링 종료 실패(무시): {e}")
            self._sync_run_id = None

    def _post_sync_auto_batch(self, sync_id: str,
                              start_date: str, end_date: str) -> dict:
        """fn_cs_post_sync_auto_batch 호출 — 자동 배치 생성 + 2~4단계 심사"""
        result = self.sb.rpc('fn_cs_post_sync_auto_batch', {
            'p_sync_id': sync_id,
            'p_period_start': start_date,
            'p_period_end': end_date,
        }).execute()

        if result.data and len(result.data) > 0:
            row = result.data[0]
            batch_id = row.get('batch_id')
            candidates = row.get('candidates', 0)
            print(f"[sync] 자동 배치 생성 — batch_id: {batch_id}, "
                  f"후보: {candidates}명")
            return {"batch_id": batch_id, "candidates": candidates}
        else:
            print("[sync] 자동 배치 — 신규 후보 없음")
            return {"batch_id": None, "candidates": 0}

    # ========================================
    # 유틸리티
    # ========================================

    @staticmethod
    def _normalize_date(raw: str) -> Optional[str]:
        """YYYYMMDD 또는 YYYY-MM-DD → YYYY-MM-DD"""
        if not raw:
            return None
        raw = raw.strip()
        if len(raw) == 8 and raw.isdigit():
            return f"{raw[:4]}-{raw[4:6]}-{raw[6:]}"
        if len(raw) >= 10 and '-' in raw:
            return raw[:10]
        return None


# ============================================================
# CLI 실행
# ============================================================

if __name__ == "__main__":
    import sys
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    if len(sys.argv) < 2:
        print("""
BRIS → Supabase 동기화 파이프라인

사용법:
  # HTML 파일에서 동기화 (기본: 자동 배치 ON)
  python bris_to_supabase.py html sample.html [--no-batch]

  # BRIS에서 직접 조회하여 동기화 (기본: 자동 배치 ON)
  python bris_to_supabase.py fetch 2026-04-01 2026-04-30 [--no-batch]

  # cron 모드: 지난주 데이터 자동 동기화 + 배치 생성
  python bris_to_supabase.py cron

  # 단일 수주코드 재수집 (운영자 수동 백필)
  python bris_to_supabase.py refresh 2604-063 [--date-hint 2026-04-03]

환경변수:
  SUPABASE_URL=https://gdwhbacuzhynvegkfoga.supabase.co
  SUPABASE_SERVICE_KEY=your_key
  BRIS_COOKIE_FILE=cookies.json  (fetch/cron/refresh 모드)
        """)
        sys.exit(0)

    mode = sys.argv[1]

    if mode == 'html':
        filepath = sys.argv[2]
        # 2026-04-15 기본값 반전: html 모드도 자동 배치 ON 을 기본으로.
        # 이전엔 --auto-batch 명시해야 배치가 생성돼 운영자가 플래그를 빠뜨리는 사고가 반복됨
        # (예: 04-15 04:00 sync 에서 triggered_batch_id=NULL). fetch/cron 과 일관되게 변경.
        auto = '--no-batch' not in sys.argv
        with open(filepath, 'r', encoding='utf-8') as f:
            html = f.read()
        pipeline = BrisSyncPipeline()
        result = pipeline.sync_from_html(html, auto_batch=auto)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    elif mode in ('fetch', 'cron', 'refresh'):
        if mode == 'fetch':
            start = sys.argv[2]
            end = sys.argv[3]
            auto = '--no-batch' not in sys.argv
        elif mode == 'refresh':
            # refresh <bris_code> [--date-hint YYYY-MM-DD]
            bris_code_arg = sys.argv[2]
            date_hint = None
            if '--date-hint' in sys.argv:
                i = sys.argv.index('--date-hint')
                if i + 1 < len(sys.argv):
                    date_hint = sys.argv[i + 1]
            start, end, auto = None, None, False  # refresh 는 auto_batch 강제 off
        else:  # cron
            today = date.today()
            last_monday = today - timedelta(days=today.weekday() + 7)
            last_sunday = last_monday + timedelta(days=6)
            start = last_monday.isoformat()
            end = last_sunday.isoformat()
            auto = True

        # BRIS 인증: ID/PW 우선, 없으면 쿠키 파일
        bris_uid = os.environ.get('BRIS_USER_ID', '')
        bris_pwd = os.environ.get('BRIS_PASSWORD', '')
        cookie_file = os.environ.get('BRIS_COOKIE_FILE', 'cookies.json')

        if bris_uid and bris_pwd:
            print(f"[auth] ID/PW 로그인 시도: {bris_uid}")
            from bris_api import BrisClient as _BC
            bris = _BC()
            if not bris.login(bris_uid, bris_pwd):
                print("[auth] 로그인 실패 — ID/PW를 확인하세요")
                if mode == 'cron':
                    _enqueue_alert_via_rpc(
                        severity='error',
                        source='bris_fetch',
                        subject='BRIS 자동 fetch 실패: 로그인 실패',
                        body='BRIS_USER_ID/PASSWORD 로 로그인 시도했으나 실패. 자격증명 확인 필요.',
                        context={'mode': 'cron', 'auth_method': 'id_pw', 'user_id': bris_uid},
                    )
                sys.exit(1)
            print(f"[auth] 로그인 성공 — cookies: {list(dict(bris.session.cookies).keys())}")
            pipeline = BrisSyncPipeline(bris_client=bris)
        else:
            print(f"[auth] 쿠키 파일 사용: {cookie_file}")
            pipeline = BrisSyncPipeline(bris_cookie_file=cookie_file)

        try:
            if mode == 'refresh':
                result = pipeline.refresh_bris_code(bris_code_arg, date_hint=date_hint)
            else:
                result = pipeline.sync(start, end, auto_batch=auto)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        except Exception as exc:
            # cron 모드는 무인 실행 — 실패 시 운영자 알림 큐 적재 후 재발생.
            # fetch/refresh 는 운영자가 손으로 돌리는 명령이라 알림 불필요.
            if mode == 'cron':
                _enqueue_alert_via_rpc(
                    severity='error',
                    source='bris_fetch',
                    subject=f'BRIS 자동 fetch 실패: {type(exc).__name__}',
                    body=f'{exc!r}',
                    context={
                        'mode': 'cron',
                        'period_start': start,
                        'period_end': end,
                        'auto_batch': auto,
                    },
                )
            raise
