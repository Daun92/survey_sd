"""Python 파서 단위 테스트 — 한글 키 출력 검증"""

from pathlib import Path

from bris_parser import BrisParser, parse

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent / 'bris-parser' / 'test' / 'fixtures'


def _load(name: str) -> str:
    return (FIXTURES_DIR / f'{name}.html').read_text(encoding='utf-8')


def test_basic():
    records = parse(_load('integrated_basic'))
    assert len(records) == 1
    r = records[0]
    assert r['business_id'] == '10001'
    assert r['project_id'] == '20001'
    assert r['echo_id'] == ''
    assert r['customer_id'] == ''
    assert r['과정명'] == '기본 과정'
    assert r['프로그램명'] == '기본 프로그램'
    assert r['과정_총매출'] == 500000
    assert r['시작일'] == '2026-03-01'
    assert r['종료일'] == '2026-03-02'
    assert r['대면_비대면'] == '대면'
    assert r['수주_프로젝트_마감일'] == '미적용'


def test_instructors_split_rows():
    records = parse(_load('integrated_with_instructors'))
    assert len(records) == 1
    r = records[0]
    assert r['사내강사'] == '안재현, 박철수'
    assert r['외부강사'] == '이몽룡'
    # 하위호환: 합산이 '강사' 키에
    assert r['강사'] == '안재현, 박철수, 이몽룡'
    assert r['수주_담당자'] == '홍길동'
    assert r['수주팀'] == '서울1팀'
    assert r['수행_담당자'] == '김영희'
    assert r['수행팀'] == '경기팀'  # '201205002 - 경기팀' → 코드 제거
    assert r['회사명'] == '테스트회사'
    assert r['고객_담당자'] == '최담당'


def test_echo_excluded_red_span():
    records = parse(_load('integrated_echo_excluded'))
    r = records[0]
    # 빨간 span 마감일 추출
    assert r['수주_프로젝트_마감일'] == '2026-04-15'
    # 빨간 span 에코 제외
    assert r['에코_상태'] == '에코 제외'
    # 한 행에 사내+외부 동시
    assert r['사내강사'] == '박사내'
    assert r['외부강사'] == '김외부, 이외부'


def test_columns_exported():
    # BrisParser.COLUMNS 가 '강사' 신규 키를 포함하는지
    assert '강사' in BrisParser.COLUMNS
    assert '사내강사' in BrisParser.COLUMNS
    assert '외부강사' in BrisParser.COLUMNS
