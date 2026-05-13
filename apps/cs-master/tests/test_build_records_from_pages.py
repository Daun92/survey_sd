"""_build_records_from_pages — 4페이지 → 통합 record 변환 단위 테스트.

순수 변환 함수 (Supabase, requests 둘 다 호출 안 함) 라서 BrisSyncPipeline
인스턴스를 가짜 supabase·BrisClient 로 만들어 메서드만 호출한다.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from bris_to_supabase import BrisSyncPipeline


@pytest.fixture
def pipeline() -> BrisSyncPipeline:
    """Supabase·BRIS 호출이 일어나지 않는 메서드 단독 테스트용 인스턴스.

    `_build_records_from_pages` 는 self 멤버를 사용하지 않는 순수 변환 함수라
    `__init__` 우회하고 `__new__` 로 만든다 (create_client/login 호출 회피).
    """
    p = BrisSyncPipeline.__new__(BrisSyncPipeline)
    p.sb = MagicMock()
    p.bris = MagicMock()
    return p


# ----------------------------------------------------------------------------
# pv (project_view) — 모든 record 공통 필드의 source
# bl (project_biz_list) — 차수 단위
# eo (echo_operate) — 에코 활성 시
# dm (dm_view) — customer_id 가 있을 때
# ----------------------------------------------------------------------------

PV_BASE = {
    'projectId': 'PID-001',
    'orderCode': '2604-100',
    'projectName': '리더십 과정 (원격)',
    'company': 'ACME',
    'am': '정용호',
    'amTeam': '경기팀',
    'team': '운영팀',
    'projectClosed': '2026-12-31',
    'echoActive': '',
}


def test_sessions_empty_creates_dummy_row(pipeline):
    """biz_list 차수=0 이라도 프로젝트 자체 등록 위해 더미 1건이 만들어진다."""
    records = pipeline._build_records_from_pages(PV_BASE, {'sessions': []}, None, None)

    assert len(records) == 1
    rec = records[0]
    assert rec['project_id'] == 'PID-001'
    assert rec['수주코드'] == '2604-100'
    assert rec['과정명'] == ''
    assert rec['시작일'] == ''
    assert rec['대면_비대면'] == '대면'  # nonFaceToFace False default


def test_sessions_multi_each_becomes_record(pipeline):
    bl = {
        'sessions': [
            {'businessId': 'B1', 'courseName': '1차수', 'revenue': '1000',
             'startDate': '2026-04-01', 'endDate': '2026-04-03', 'nonFaceToFace': False},
            {'businessId': 'B2', 'courseName': '2차수', 'revenue': '2000',
             'startDate': '2026-05-01', 'endDate': '2026-05-03', 'nonFaceToFace': True},
        ],
        'totalCount': 2,
    }
    records = pipeline._build_records_from_pages(PV_BASE, bl, None, None)
    assert len(records) == 2
    assert records[0]['business_id'] == 'B1'
    assert records[0]['과정명'] == '1차수'
    assert records[0]['대면_비대면'] == '대면'
    assert records[1]['business_id'] == 'B2'
    assert records[1]['대면_비대면'] == '비대면'


def test_deadline_normalization_strips_미적용(pipeline):
    pv = {**PV_BASE, 'projectClosed': '미적용'}
    records = pipeline._build_records_from_pages(pv, {'sessions': []}, None, None)
    assert records[0]['수주_프로젝트_마감일'] == ''


def test_deadline_real_value_kept(pipeline):
    pv = {**PV_BASE, 'projectClosed': '2026-12-31'}
    records = pipeline._build_records_from_pages(pv, {'sessions': []}, None, None)
    assert records[0]['수주_프로젝트_마감일'] == '2026-12-31'


def test_echo_status_from_echo_data_priority(pipeline):
    """eo.echoStatus 가 있으면 그대로 사용 (project_view 변환은 fallback)."""
    pv = {**PV_BASE, 'echoActive': '현황'}  # pv 변환 시 '에코 현황'
    eo = {'echoStatus': '에코 사전점검'}
    records = pipeline._build_records_from_pages(pv, {'sessions': []}, None, eo)
    assert records[0]['에코_상태'] == '에코 사전점검'


def test_echo_status_fallback_from_pv_echoActive(pipeline):
    """eo 가 없으면 pv.echoActive 를 한국어 라벨로 변환."""
    pv = {**PV_BASE, 'echoActive': '등록'}
    records = pipeline._build_records_from_pages(pv, {'sessions': []}, None, None)
    assert records[0]['에코_상태'] == '에코 등록'


def test_echo_status_unknown_value_results_blank(pipeline):
    pv = {**PV_BASE, 'echoActive': '알수없는값'}
    records = pipeline._build_records_from_pages(pv, {'sessions': []}, None, None)
    assert records[0]['에코_상태'] == ''


def test_company_priority_dm_over_pv(pipeline):
    """사업장명: dm.company > pv.company. 회사명: pv.company > dm.company."""
    pv = {**PV_BASE, 'company': 'PV-Corp'}
    dm = {'company': 'DM-Corp', 'name': '고객A'}
    records = pipeline._build_records_from_pages(pv, {'sessions': []}, dm, None)
    assert records[0]['사업장명'] == 'DM-Corp'   # dm 우선
    assert records[0]['회사명'] == 'PV-Corp'     # pv 우선


def test_customer_id_priority_dm_over_echo(pipeline):
    """customer_id: dm.customerId > echo.clientContactId"""
    dm = {'customerId': 'CID-DM'}
    eo = {'clientContactId': 'CID-ECHO'}
    records = pipeline._build_records_from_pages(PV_BASE, {'sessions': []}, dm, eo)
    assert records[0]['customer_id'] == 'CID-DM'


def test_customer_id_fallback_to_echo_when_dm_missing(pipeline):
    eo = {'clientContactId': 'CID-ECHO'}
    records = pipeline._build_records_from_pages(PV_BASE, {'sessions': []}, None, eo)
    assert records[0]['customer_id'] == 'CID-ECHO'


def test_am_team_separation(pipeline):
    """수주_담당자 = pv.am, 수주팀 = pv.amTeam, 수행팀 = pv.team — 3 필드 모두 보존."""
    records = pipeline._build_records_from_pages(PV_BASE, {'sessions': []}, None, None)
    rec = records[0]
    assert rec['수주_담당자'] == '정용호'
    assert rec['수주팀'] == '경기팀'
    assert rec['수행팀'] == '운영팀'


def test_dm_contact_fields_passthrough(pipeline):
    dm = {
        'name': '고객A',
        'department': '인사팀',
        'email': 'a@example.com',
        'phone': '02-1234-5678',
        'mobile': '010-0000-0000',
    }
    records = pipeline._build_records_from_pages(PV_BASE, {'sessions': []}, dm, None)
    rec = records[0]
    assert rec['고객_담당자'] == '고객A'
    assert rec['고객_부서'] == '인사팀'
    assert rec['고객_이메일'] == 'a@example.com'
    assert rec['고객_전화'] == '02-1234-5678'
    assert rec['고객_휴대폰'] == '010-0000-0000'


def test_dm_missing_results_blank_contact_fields(pipeline):
    records = pipeline._build_records_from_pages(PV_BASE, {'sessions': []}, None, None)
    rec = records[0]
    for k in ('고객_담당자', '고객_부서', '고객_이메일', '고객_전화', '고객_휴대폰'):
        assert rec[k] == ''


def test_revenue_default_zero_when_missing(pipeline):
    bl = {'sessions': [{'businessId': 'B1', 'courseName': 'x', 'revenue': ''}]}
    records = pipeline._build_records_from_pages(PV_BASE, bl, None, None)
    assert records[0]['과정_총매출'] == '0'


def test_revenue_passthrough_when_present(pipeline):
    bl = {'sessions': [{'businessId': 'B1', 'courseName': 'x', 'revenue': '12345'}]}
    records = pipeline._build_records_from_pages(PV_BASE, bl, None, None)
    assert records[0]['과정_총매출'] == '12345'


def test_record_shape_has_all_keys(pipeline):
    """기존 _sync_project_group 가 기대하는 통합 record 키가 모두 존재한다."""
    expected = {
        'business_id', 'project_id', 'customer_id',
        '과정명', '프로그램명', '과정_총매출', '시작일', '종료일', '대면_비대면',
        '수주코드', '수주_프로젝트명', '수주_프로젝트_등록일', '수주일', '수주_프로젝트_마감일',
        '에코_상태', '에코_제외_사유',
        '수주_담당자', '수주팀', '수행_담당자', '수행팀',
        '사내강사', '외부강사',
        '회사명', '사업자번호', '사업장명',
        '고객_담당자', '고객_부서', '고객_이메일', '고객_전화', '고객_휴대폰',
    }
    records = pipeline._build_records_from_pages(PV_BASE, {'sessions': []}, None, None)
    actual = set(records[0].keys())
    missing = expected - actual
    assert not missing, f'누락된 키: {missing}'
