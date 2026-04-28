"""
BRIS API 사용 예제 모음
======================
bris_api.py를 활용하는 다양한 시나리오 예제.
"""

from bris_api import BrisClient, BrisParser, BrisNotionSync


# ============================================================
# 예제 1: 쿠키로 인증 후 이번 달 데이터 조회 → Excel 저장
# ============================================================
def example_cookie_auth_to_excel():
    """
    브라우저에서 복사한 쿠키로 인증하여 데이터를 Excel로 내보내기.

    쿠키 확인 방법:
      1) 브라우저에서 BRIS 로그인 (https://bris.exc.co.kr)
      2) F12 → Application → Cookies → bris.exc.co.kr
      3) 쿠키 이름과 값을 복사
    """
    # 방법 A: 쿠키를 직접 전달
    client = BrisClient(cookies={
        "ASP.NET_SessionId": "여기에_세션ID_붙여넣기",
        # 필요 시 다른 쿠키도 추가
    })

    # 이번 달 데이터 조회
    records = client.get_this_month()
    print(f"이번 달 과정: {len(records)}건")

    # Excel 저장
    client.to_excel(records, "bris_이번달.xlsx")

    # CSV 저장
    client.to_csv(records, "bris_이번달.csv")


# ============================================================
# 예제 2: 쿠키 파일로 인증
# ============================================================
def example_cookie_file():
    """
    cookies.json 파일을 사용한 인증.

    cookies.json 형식:
    {
      "ASP.NET_SessionId": "abc123def456",
      "다른쿠키": "값"
    }
    """
    client = BrisClient.from_cookie_file("cookies.json")
    records = client.get_complain_data("2026-04-01", "2026-04-30")

    # 쿠키 저장 (다음에 재사용)
    client.save_cookies("cookies_saved.json")

    return records


# ============================================================
# 예제 3: ID/PW 로그인
# ============================================================
def example_login():
    """아이디/비밀번호로 로그인"""
    client = BrisClient()
    success = client.login("my_user_id", "my_password")

    if success:
        print("로그인 성공!")
        records = client.get_today()
        print(f"오늘 과정: {len(records)}건")

        # 세션 쿠키 저장 (다음 실행 시 재사용)
        client.save_cookies("cookies.json")
    else:
        print("로그인 실패 - 아이디/비밀번호를 확인하세요")


# ============================================================
# 예제 4: 환경변수 기반 인증 (자동화에 적합)
# ============================================================
def example_env_auth():
    """
    환경변수로 인증. cron job이나 자동화 스크립트에 적합.

    사전 설정:
      export BRIS_USER_ID=my_id
      export BRIS_PASSWORD=my_pw
    """
    client = BrisClient.from_env()
    records = client.get_this_month()
    client.to_excel(records, f"bris_월간_{records[0]['시작일'][:6]}.xlsx")


# ============================================================
# 예제 5: 검색 필터
# ============================================================
def example_search():
    """다양한 조건으로 검색"""
    client = BrisClient(cookies={"ASP.NET_SessionId": "..."})

    # 회사명으로 검색
    lotte = client.search("2026-04-01", "2026-04-30", company="롯데")
    print(f"롯데 관련: {len(lotte)}건")

    # 담당자로 검색
    kim = client.search("2026-04-01", "2026-04-30", manager="김미송")
    print(f"김미송 수주/수행: {len(kim)}건")

    # 에코 상태 필터
    excluded = client.search("2026-04-01", "2026-04-30", echo_status="에코 제외")
    print(f"에코 제외 건: {len(excluded)}건")

    # 복합 검색
    result = client.search(
        "2026-04-01", "2026-04-30",
        company="병무청",
        course="휴먼스킬",
    )
    print(f"병무청 + 휴먼스킬: {len(result)}건")


# ============================================================
# 예제 6: 로컬 HTML 파일 파싱 (인증 불필요)
# ============================================================
def example_parse_local_html():
    """
    이미 저장된 HTML 파일을 파싱.
    인증 없이 테스트하거나, 수동으로 저장한 페이지를 처리할 때 유용.
    """
    with open("saved_page.html", "r", encoding="utf-8") as f:
        html = f.read()

    records = BrisParser.parse(html)
    print(f"파싱 결과: {len(records)}건")

    # 특정 필드만 출력
    for r in records:
        print(f"  {r.get('회사명', '?')} | {r.get('과정명', '?')} | "
              f"매출: {r.get('과정_총매출', 0):,}원")

    # Excel로 저장
    BrisClient.to_excel(records, "parsed_result.xlsx")


# ============================================================
# 예제 7: Notion 동기화
# ============================================================
def example_notion_sync():
    """
    BRIS 데이터를 Notion 데이터베이스에 동기화.

    사전 준비:
      1) Notion Integration 생성 (https://www.notion.so/my-integrations)
      2) API 키 복사
      3) 대상 페이지에서 Integration 연결 (Share → Invite)
    """
    # BRIS 데이터 조회
    client = BrisClient(cookies={"ASP.NET_SessionId": "..."})
    records = client.get_complain_data("2026-04-01", "2026-04-30")

    # Notion 동기화
    sync = BrisNotionSync(
        api_key="ntn_여기에_노션_API키",
        database_id="여기에_데이터베이스_ID",  # 기존 DB가 있으면
    )

    # 또는 새 데이터베이스 생성 후 동기화
    # sync = BrisNotionSync(api_key="ntn_...")
    # sync.create_database(parent_page_id="상위_페이지_ID")

    result = sync.sync_records(records)
    print(f"동기화 결과: {result}")


# ============================================================
# 예제 8: 다른 Python 코드에서 호출 (모듈 사용)
# ============================================================
def example_as_module():
    """
    다른 파이썬 프로젝트에서 bris_api를 모듈로 사용하는 패턴.

    프로젝트 구조:
      my_project/
        bris_api.py       ← 이 파일을 복사
        my_dashboard.py   ← 아래 코드
    """
    from bris_api import BrisClient

    def get_monthly_summary(year: int, month: int) -> dict:
        """월별 요약 데이터 생성"""
        client = BrisClient.from_cookie_file("cookies.json")
        start = f"{year}-{month:02d}-01"

        # 말일 계산
        from datetime import datetime, timedelta
        if month == 12:
            end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = datetime(year, month + 1, 1) - timedelta(days=1)
        end = end_date.strftime("%Y-%m-%d")

        records = client.get_complain_data(start, end)

        return {
            "기간": f"{start} ~ {end}",
            "총_건수": len(records),
            "총_매출": sum(r.get('과정_총매출', 0) for r in records),
            "회사별": _group_by(records, '회사명'),
            "담당자별": _group_by(records, '수행_담당자'),
        }

    def _group_by(records, field):
        groups = {}
        for r in records:
            key = r.get(field, '미지정') or '미지정'
            if key not in groups:
                groups[key] = {"건수": 0, "매출합": 0}
            groups[key]["건수"] += 1
            groups[key]["매출합"] += r.get('과정_총매출', 0)
        return groups

    # 사용
    summary = get_monthly_summary(2026, 4)
    print(f"4월 요약: {summary['총_건수']}건, 매출 {summary['총_매출']:,}원")


# ============================================================
if __name__ == "__main__":
    print("BRIS API 사용 예제")
    print("=" * 40)
    print()
    print("이 파일의 각 함수를 참고하여 사용하세요:")
    print("  1. example_cookie_auth_to_excel() - 쿠키 인증 → Excel")
    print("  2. example_cookie_file()          - 쿠키 파일 인증")
    print("  3. example_login()                - ID/PW 로그인")
    print("  4. example_env_auth()             - 환경변수 인증")
    print("  5. example_search()               - 검색 필터")
    print("  6. example_parse_local_html()     - 로컬 HTML 파싱")
    print("  7. example_notion_sync()          - Notion 동기화")
    print("  8. example_as_module()            - 모듈로 사용")
