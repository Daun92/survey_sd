"""BrisSyncPipeline.refresh_project_id — 단일 PROJECT_ID 백필 통합 테스트.

BrisClient + Supabase 둘 다 mock. 7단계 (project_view → biz_list → echo →
dm → 통합 record 변환 → _sync_project_group 호출 → 빈 course 정리)
의 흐름·분기·실패 경로를 검증한다.

`_insert_raw_page`, `_sync_start`, `_sync_finish`, `_sync_project_group` 은
파이프라인의 다른 메서드라 패치 (MagicMock) 로 차단해 호출 회수만 검증.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from bris_to_supabase import BrisSyncPipeline
from bris_api import BrisSessionExpired


# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------

PV_OK = {
    'projectId': 'PID-001',
    'orderCode': '2604-100',
    'projectName': '리더십 과정',
    'company': 'ACME',
    'am': '정용호', 'amTeam': '경기팀', 'team': '운영팀',
    'projectClosed': '2026-12-31',
    'echoActive': '',
}

BL_TWO = {
    'sessions': [
        {'businessId': 'B1', 'courseName': '1차수', 'revenue': '1000',
         'startDate': '2026-04-01', 'endDate': '2026-04-03', 'nonFaceToFace': False},
        {'businessId': 'B2', 'courseName': '2차수', 'revenue': '2000',
         'startDate': '2026-05-01', 'endDate': '2026-05-03', 'nonFaceToFace': True},
    ],
    'totalCount': 2,
}

BL_EMPTY = {'sessions': [], 'totalCount': 0}

ECHO_OK = {'echoStatus': '에코 사전점검', 'clientContactId': 'CID-99'}
DM_OK = {'name': '고객A', 'email': 'a@x.com', 'company': 'ACME',
         'department': '인사팀', 'phone': '', 'mobile': '', 'customerId': 'CID-99'}


def _make_pipeline(*, bris_mock: MagicMock, sb_mock: MagicMock) -> BrisSyncPipeline:
    p = BrisSyncPipeline.__new__(BrisSyncPipeline)
    p.sb = sb_mock
    p.bris = bris_mock
    # 다른 메서드들은 mock 으로 (refresh_project_id 본체만 검증)
    p._sync_start = MagicMock(return_value='sync-1')
    p._sync_finish = MagicMock()
    p._sync_project_group = MagicMock()
    p._insert_raw_page = MagicMock()
    return p


def _bris_with(pv=PV_OK, bl=BL_TWO, echo=ECHO_OK, dm=DM_OK):
    """BrisClient mock — 4개 메서드가 (html, parsed) 튜플 반환."""
    bris = MagicMock()
    bris.PROJECT_VIEW_URL = 'http://test/project_view'
    bris.PROJECT_BIZ_URL = 'http://test/project_biz_list'
    bris.DM_VIEW_URL = 'http://test/dm_view'
    bris.ECHO_OPERATE_URL = 'http://test/echo_operate'
    bris.get_project_view_with_raw.return_value = ('<html>pv</html>', pv)
    bris.get_project_biz_list_with_raw.return_value = ('<html>bl</html>', bl)
    bris.get_echo_operate_with_raw.return_value = ('<html>eo</html>', echo)
    bris.get_dm_view_with_raw.return_value = ('<html>dm</html>', dm)
    return bris


# ----------------------------------------------------------------------------
# 정상 시나리오: echo ON + dm 모두 fetch
# ----------------------------------------------------------------------------

def test_happy_path_all_4_pages(monkeypatch):
    monkeypatch.delenv('BRIS_USER_ID', raising=False)
    monkeypatch.delenv('BRIS_PASSWORD', raising=False)
    pv = {**PV_OK, 'echoActive': '현황'}
    bris = _bris_with(pv=pv, bl=BL_TWO, echo=ECHO_OK, dm=DM_OK)
    sb = MagicMock()
    p = _make_pipeline(bris_mock=bris, sb_mock=sb)

    result = p.refresh_project_id('PID-001')

    assert result['bris_code'] == '2604-100'
    assert result['pages_fetched'] == 4
    assert result['total_records'] == 2  # bl 2 sessions
    assert result['errors'] == []

    # 4 fetcher 모두 호출됨
    bris.get_project_view_with_raw.assert_called_once_with('PID-001')
    bris.get_project_biz_list_with_raw.assert_called_once_with('PID-001', success_code='2604-100')
    bris.get_echo_operate_with_raw.assert_called_once_with('PID-001')
    bris.get_dm_view_with_raw.assert_called_once_with('CID-99')

    # Layer 0 raw_pages 4번 적재
    assert p._insert_raw_page.call_count == 4

    # 통합 group sync 호출 (bris_code='2604-100', records=2건)
    args = p._sync_project_group.call_args
    assert args.args[0] == '2604-100'
    assert len(args.args[1]) == 2

    # sync_finish success
    p._sync_finish.assert_called_once()
    assert p._sync_finish.call_args.args[1] == 'success'


def test_echo_off_skips_echo_and_dm():
    """echoActive 빈 값이면 echo_operate fetch 안 함 → customer_id 없어 dm 도 skip."""
    pv = {**PV_OK, 'echoActive': ''}
    bris = _bris_with(pv=pv, bl=BL_EMPTY, echo=ECHO_OK, dm=DM_OK)
    sb = MagicMock()
    p = _make_pipeline(bris_mock=bris, sb_mock=sb)

    # sessions=0 케이스 cleanup 쿼리 mock
    proj_q = MagicMock()
    proj_q.data = []
    sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = proj_q

    result = p.refresh_project_id('PID-001')

    bris.get_project_view_with_raw.assert_called_once()
    bris.get_project_biz_list_with_raw.assert_called_once()
    bris.get_echo_operate_with_raw.assert_not_called()
    bris.get_dm_view_with_raw.assert_not_called()
    assert result['pages_fetched'] == 2
    assert result['errors'] == []


def test_echo_on_but_no_client_contact_id_skips_dm():
    """echo 응답에 clientContactId 가 없으면 dm_view 만 skip."""
    pv = {**PV_OK, 'echoActive': '현황'}
    echo_no_cid = {'echoStatus': '에코 등록', 'clientContactId': None}
    bris = _bris_with(pv=pv, bl=BL_TWO, echo=echo_no_cid, dm=DM_OK)
    p = _make_pipeline(bris_mock=bris, sb_mock=MagicMock())

    p.refresh_project_id('PID-001')

    bris.get_echo_operate_with_raw.assert_called_once()
    bris.get_dm_view_with_raw.assert_not_called()


# ----------------------------------------------------------------------------
# 실패 경로
# ----------------------------------------------------------------------------

def test_project_view_failure_returns_error_without_calling_sync(monkeypatch):
    """project_view 가 실패하면 즉시 error 종료 — biz_list 등 후속 호출 없음."""
    monkeypatch.delenv('BRIS_USER_ID', raising=False)
    monkeypatch.delenv('BRIS_PASSWORD', raising=False)
    bris = _bris_with()
    bris.get_project_view_with_raw.side_effect = Exception('network down')
    p = _make_pipeline(bris_mock=bris, sb_mock=MagicMock())

    result = p.refresh_project_id('PID-001')

    assert any('project_view' in e for e in result['errors'])
    bris.get_project_biz_list_with_raw.assert_not_called()
    p._sync_project_group.assert_not_called()
    p._sync_finish.assert_called_once()
    assert p._sync_finish.call_args.args[1] == 'error'


def test_missing_order_code_returns_error():
    """orderCode 추출 실패 시 error 종료."""
    pv = {**PV_OK, 'orderCode': ''}
    bris = _bris_with(pv=pv)
    p = _make_pipeline(bris_mock=bris, sb_mock=MagicMock())

    result = p.refresh_project_id('PID-001')

    assert any('orderCode' in e or '수주코드' in e for e in result['errors'])
    bris.get_project_biz_list_with_raw.assert_not_called()
    p._sync_project_group.assert_not_called()


def test_biz_list_failure_is_tolerated_and_continues():
    """biz_list 실패해도 후속 단계 진행 + error 누적 + sessions=0 더미 처리."""
    bris = _bris_with(pv=PV_OK)
    bris.get_project_biz_list_with_raw.side_effect = Exception('biz down')
    sb = MagicMock()
    sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    p = _make_pipeline(bris_mock=bris, sb_mock=sb)

    result = p.refresh_project_id('PID-001')

    # biz_list 실패해도 echo/dm 단계 진입 (단, echoActive=='' 라 echo skip)
    assert any('project_biz_list' in e for e in result['errors'])
    # 빈 sessions 이지만 _sync_project_group 은 더미 1건으로 호출됨
    p._sync_project_group.assert_called_once()
    # 최종 sync_finish 는 success (pv 성공했고 group sync 도 호출됐으므로 pipeline 자체는 OK)
    p._sync_finish.assert_called_once()
    assert p._sync_finish.call_args.args[1] == 'success'


def test_echo_fetch_failure_tolerated():
    pv = {**PV_OK, 'echoActive': '현황'}
    bris = _bris_with(pv=pv, bl=BL_TWO)
    bris.get_echo_operate_with_raw.side_effect = Exception('echo timeout')
    p = _make_pipeline(bris_mock=bris, sb_mock=MagicMock())

    result = p.refresh_project_id('PID-001')

    assert any('echo_operate' in e for e in result['errors'])
    bris.get_dm_view_with_raw.assert_not_called()  # echo 실패 → cid 없음 → dm skip
    p._sync_project_group.assert_called_once()
    assert p._sync_finish.call_args.args[1] == 'success'


# ----------------------------------------------------------------------------
# 세션 만료 자동 재로그인 (_fetch_pid_with_relogin)
# ----------------------------------------------------------------------------

def test_session_expiry_with_credentials_triggers_relogin(monkeypatch):
    monkeypatch.setenv('BRIS_USER_ID', 'tester')
    monkeypatch.setenv('BRIS_PASSWORD', 'pw')
    bris = _bris_with(pv=PV_OK)
    # project_view 첫 호출 BrisSessionExpired → 재로그인 후 정상
    bris.get_project_view_with_raw.side_effect = [
        BrisSessionExpired('expired'),
        ('<html>pv</html>', PV_OK),
    ]
    bris.login.return_value = True
    p = _make_pipeline(bris_mock=bris, sb_mock=MagicMock())

    result = p.refresh_project_id('PID-001')

    bris.login.assert_called_once_with('tester', 'pw')
    assert bris.get_project_view_with_raw.call_count == 2  # 1회 실패 + 1회 retry
    assert not any('project_view' in e for e in result['errors'])


def test_session_expiry_without_credentials_raises_through(monkeypatch):
    monkeypatch.delenv('BRIS_USER_ID', raising=False)
    monkeypatch.delenv('BRIS_PASSWORD', raising=False)
    bris = _bris_with()
    bris.get_project_view_with_raw.side_effect = BrisSessionExpired('expired')
    p = _make_pipeline(bris_mock=bris, sb_mock=MagicMock())

    result = p.refresh_project_id('PID-001')

    # 자격증명 없으면 retry 안 함 → errors 에 누적
    assert any('project_view' in e for e in result['errors'])
    bris.login.assert_not_called()
    p._sync_project_group.assert_not_called()


def test_session_expiry_relogin_fails_propagates(monkeypatch):
    monkeypatch.setenv('BRIS_USER_ID', 'tester')
    monkeypatch.setenv('BRIS_PASSWORD', 'pw')
    bris = _bris_with(pv=PV_OK)
    bris.get_project_view_with_raw.side_effect = BrisSessionExpired('expired')
    bris.login.return_value = False  # 재로그인 실패
    p = _make_pipeline(bris_mock=bris, sb_mock=MagicMock())

    result = p.refresh_project_id('PID-001')

    bris.login.assert_called_once()
    assert any('project_view' in e for e in result['errors'])
    # 재로그인 실패 후 retry 안 함 → 단 1회만 호출
    assert bris.get_project_view_with_raw.call_count == 1


# ----------------------------------------------------------------------------
# sessions=0 빈 cs_courses 정리
# ----------------------------------------------------------------------------

def test_sessions_empty_triggers_empty_course_cleanup():
    """sessions=0 케이스 — cs_courses 의 더미(course_name=NULL+start_date=NULL) 삭제 호출."""
    bris = _bris_with(pv=PV_OK, bl=BL_EMPTY)
    sb = MagicMock()
    # cs_projects select → 1건 매칭 (uuid='abc')
    proj_q = MagicMock()
    proj_q.data = [{'id': 'proj-uuid'}]
    sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = proj_q

    p = _make_pipeline(bris_mock=bris, sb_mock=sb)
    p.refresh_project_id('PID-001')

    # cs_courses 삭제 호출되었는지 확인 — delete 체인 어디선가 한 번 사용
    delete_calls = [c for c in sb.table.call_args_list if c.args == ('cs_courses',)]
    assert delete_calls, 'cs_courses 테이블에 대한 호출 없음'


def test_sessions_present_skips_empty_course_cleanup():
    bris = _bris_with(pv=PV_OK, bl=BL_TWO)
    sb = MagicMock()
    p = _make_pipeline(bris_mock=bris, sb_mock=sb)
    p.refresh_project_id('PID-001')

    # cs_courses 직접 호출 없음 (cleanup 분기 진입 안 함)
    delete_calls = [c for c in sb.table.call_args_list if c.args == ('cs_courses',)]
    assert not delete_calls
