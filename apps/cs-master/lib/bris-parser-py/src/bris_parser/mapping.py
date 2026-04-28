"""
한글 키 ↔ JS camelCase 키 매핑.

JS 파서(`lib/bris-parser`)와의 동등성 검증 및 크로스-플랫폼 일관성을 위해 사용.
"""

# Python 출력 키 → JS 출력 키
FIELD_MAP = {
    'business_id': 'businessId',
    'project_id': 'projectId',
    'echo_id': 'echoId',
    'place_id': 'placeId',
    'customer_id': 'customerId',
    '과정명': 'courseName',
    '프로그램명': 'programName',
    '과정_총매출': 'totalRevenue',
    '시작일': 'startDate',
    '종료일': 'endDate',
    '대면_비대면': 'eduDelivery',
    '수주코드': 'orderCode',
    '수주_프로젝트명': 'projectName',
    '수주_프로젝트_등록일': 'registrationDate',
    '수주일': 'orderDate',
    '수주_프로젝트_마감일': 'projectClosed',
    '에코_상태': 'echoStatus',
    '에코_제외_사유': 'echoExcludeReason',
    '수주_담당자': 'am',
    '수주팀': 'amTeam',
    '수행_담당자': 'performer',
    '수행팀': 'performerTeam',
    '사내강사': 'internalInstructors',
    '외부강사': 'externalInstructors',
    '강사': 'instructor',
    '회사명': 'company',
    '사업자번호': 'businessNumber',
    '사업장명': 'placeName',
    '고객_담당자': 'dmName',
    '고객_부서': 'dmDept',
    '고객_이메일': 'dmEmail',
    '고객_전화': 'dmPhone',
    '고객_휴대폰': 'dmMobile',
}

# JS 출력 스키마에서 빈 문자열로 기본값 채울 camelCase 필드들
# (Python 파서가 info-row 부재 등으로 키 자체를 만들지 않았을 때 사용)
_JS_OUTPUT_SCHEMA = [
    'businessId', 'projectId', 'echoId', 'placeId', 'customerId',
    'courseName', 'programName', 'totalRevenue', 'startDate', 'endDate',
    'eduDelivery', 'orderCode', 'projectName', 'registrationDate', 'orderDate',
    'projectClosed',
    'echoStatus', 'echoExcludeReason',
    'am', 'amTeam', 'performer', 'performerTeam',
    'instructor', 'internalInstructors', 'externalInstructors',
    'company', 'businessNumber', 'placeName',
    'dmName', 'dmDept', 'dmEmail', 'dmPhone', 'dmMobile',
]


def to_camelcase(record: dict) -> dict:
    """
    한글 키 record → camelCase 키 record (JS 출력 스키마와 정렬)

    - totalRevenue: Python int → JS string
    - 누락 필드는 빈 문자열로 채움 (JS 출력과 동일 shape 보장)
    - None 값도 빈 문자열로 변환
    """
    result = {js: '' for js in _JS_OUTPUT_SCHEMA}  # 기본값

    for ko, js in FIELD_MAP.items():
        if ko not in record:
            continue
        v = record[ko]
        if v is None:
            result[js] = ''
        elif js == 'totalRevenue':
            result[js] = str(v) if v else '0'
        else:
            result[js] = v

    # JS 출력 스키마 순서대로 정렬된 dict 반환
    return {k: result[k] for k in _JS_OUTPUT_SCHEMA}
