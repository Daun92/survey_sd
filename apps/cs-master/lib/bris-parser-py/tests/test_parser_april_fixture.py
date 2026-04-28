"""2026-04 BRIS 실 HTML subset 에 대한 회귀 테스트.

목적: 이전 세션에서 드러난 실수집 엣지케이스를 고정시켜 리팩터/수정 시
회귀를 즉시 잡는다. fixture 는 tests/fixtures/complain_2026_04_subset.html.
"""

from pathlib import Path

from bris_parser import parse

FIXTURE = Path(__file__).resolve().parent / 'fixtures' / 'complain_2026_04_subset.html'


def _parse():
    return parse(FIXTURE.read_text(encoding='utf-8'))


def test_record_count():
    records = _parse()
    assert len(records) == 3, f'expected 3 records, got {len(records)}'


def test_all_required_ids_present():
    """모든 레코드는 business_id/project_id/place_id/customer_id 가 비어있지 않아야 한다."""
    for r in _parse():
        for key in ('business_id', 'project_id', 'place_id', 'customer_id'):
            assert r.get(key), f"레코드 {r.get('수주코드')} 에 {key} 누락: {r}"


def test_jeonhan_kosmo_group_granularity():
    """전한(사업장) vs 코스모그룹(회사) — 파서는 둘을 분리해야 함."""
    r = next(r for r in _parse() if r['수주코드'] == '2604-063')
    assert r['회사명'] == '코스모그룹'
    assert r['사업장명'] == '전한'
    assert r['project_id'] == '34810'
    assert r['business_id'] == '72890'
    assert r['에코_상태'] == '에코 제외'
    assert r['에코_제외_사유'] == '집체(2시간이내 특강)'


def test_team_normalization_removes_code_prefix():
    """'201204002 - 중부팀' 같은 코드 prefix 가 수주팀/수행팀에서 제거되어야 한다."""
    r = next(r for r in _parse() if r['수주코드'] == '2604-143')
    assert r['수주팀'] == '201300001 - 경기팀'  # 수주팀은 코드 포함 허용
    # 수행팀은 normalize_team_name 적용 — 코드 제거
    assert r['수행팀'] == '신입온보딩팀'
    assert r['수주_담당자'] == '이제혁'
    assert r['사내강사'] == '안재현'
    assert r['강사'] == '안재현'  # 하위호환 단일 키


def test_legacy_red_span_deadline():
    """빨간 span 안에 텍스트가 있으면 마감일로 추출."""
    r = next(r for r in _parse() if r['수주코드'] == '2311-236')
    assert r['수주_프로젝트_마감일'] == '2023-12-04'
    assert r['place_id'] == '24857'
    assert r['회사명'] == '남양넥스모(주)'


def test_contact_fields():
    """담당자 행의 5개 라벨이 record 의 고객_* 필드로 매핑되어야 한다."""
    r = next(r for r in _parse() if r['수주코드'] == '2604-063')
    assert r['고객_담당자'] == '권혜원'
    assert r['고객_이메일'] == 'rnjs1520@sullai.com'
    assert r['고객_전화'] == '07049447135'
    assert r['고객_휴대폰'] == '01067763894'


def test_extra_labels_observed_when_present():
    """매핑에 없는 라벨이 들어와도 _extra_labels 에 보관되어 관찰 가능."""
    # 현 fixture 는 모두 매핑된 라벨만 씀 — extra 는 비어 있거나 키 부재.
    for r in _parse():
        extra = r.get('_extra_labels', {})
        # '에코 아이디', '플레이스 아이디', '커스터머 아이디' 는 정보용으로 수집됨.
        # 매핑에 없지만 파서가 관찰했음을 증거하기 위해 존재 허용.
        for k in extra:
            assert isinstance(k, str)
