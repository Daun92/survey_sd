"""[배포] publish/ 결과물을 apps.exc.co.kr/staff/45/files/ 에 업로드.

apps.exc.co.kr = Django(세션+CSRF). 절차(가이드 D:\\00.26년업무\\07.HR실태조사\\apps-upload-guide.md):
  1) GET  /login/            → csrfmiddlewaretoken 추출 + csrftoken 쿠키
  2) POST /login/            → 세션 로그인(sessionid 쿠키)
  3) POST /staff/45/files/upload/  → multipart 업로드(X-CSRFToken 헤더, path=하위폴더)

자격증명: creds/apps_creds.txt  (APPS_ID=... / APPS_PW=...).  값은 로그에 출력하지 않음.
매일 파이프라인의 **비치명(non-fatal)** 마지막 단계 — 미인증/업로드 실패해도 로컬 publish/ 는 유효.

사용:
    python scripts/upload_apps.py            # publish/ 4종 업로드
    python scripts/upload_apps.py --dry-run  # 로그인까지만(업로드 안 함)
종료코드: 0=성공 / 2=자격증명 없음(건너뜀) / 1=로그인·업로드 실패
"""
from __future__ import annotations

import argparse
import io
import re
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SERVICE_ID = 45
BASE = "https://apps.exc.co.kr"
# 실제 로그인 경로·필드는 서버에서 확인(2026-06-01): action=/auth/login/, 필드 user_id/password
# (가이드의 /login/·username 은 이 서버와 상이 → 그대로 쓰면 404/로그인 실패).
LOGIN_URL = f"{BASE}/auth/login/"
FILES_URL = f"{BASE}/staff/{SERVICE_ID}/files/"
UPLOAD_URL = f"{BASE}/staff/{SERVICE_ID}/files/upload/"
REMOTE_PATH = "hrd22/"          # 전용 하위폴더(권장). API가 하위폴더 미지원이면 "" 로 변경.
PUBLISH = ROOT / "5_report" / "publish"
FILES = ["index.html", "dashboard.html", "segment.html", "deck.html", "appendix.html"]
# 자격증명: 프로젝트 로컬 우선, 없으면 상위(HR실태조사) 공유 폴더(가이드와 같은 위치)
CREDS_CANDIDATES = [ROOT / "creds" / "apps_creds.txt", ROOT.parent / "creds" / "apps_creds.txt"]
TIMEOUT = 30
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
_CSRF_RE = re.compile(r'name=["\']csrfmiddlewaretoken["\']\s+value=["\']([^"\']+)["\']')


def _creds_path() -> Path | None:
    return next((p for p in CREDS_CANDIDATES if p.exists()), None)


def read_creds() -> tuple[str, str] | None:
    p = _creds_path()
    if p is None:
        return None
    raw = p.read_bytes()
    txt = None
    for enc in ("utf-8-sig", "cp949"):           # BOM·한글 주석(ANSI) 견고화
        try:
            txt = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if txt is None:
        return None
    kv = {}
    for line in txt.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        kv[k.strip()] = v.strip().strip('"').strip("'")
    uid, pw = kv.get("APPS_ID"), kv.get("APPS_PW")
    return (uid, pw) if uid and pw else None


def login(s: requests.Session, uid: str, pw: str) -> bool:
    r = s.get(LOGIN_URL, timeout=TIMEOUT)
    m = _CSRF_RE.search(r.text)
    token = m.group(1) if m else s.cookies.get("csrftoken", "")
    if not token:
        print("  ✗ CSRF 토큰을 찾지 못함 — 로그인 페이지 구조 변경 의심")
        return False
    r2 = s.post(LOGIN_URL,
                data={"csrfmiddlewaretoken": token, "next": f"/staff/{SERVICE_ID}/files/",
                      "user_id": uid, "password": pw},
                headers={"Referer": LOGIN_URL}, timeout=TIMEOUT, allow_redirects=True)
    ok = ("sessionid" in s.cookies) and ("/auth/login" not in r2.url)
    print(f"  로그인 응답 {r2.status_code} · sessionid={'있음' if 'sessionid' in s.cookies else '없음'} · {'성공' if ok else '실패'}")
    return ok


def upload_file(s: requests.Session, fp: Path, remote_path: str) -> bool:
    csrf = s.cookies.get("csrftoken", "")
    data = fp.read_bytes()
    r = s.post(UPLOAD_URL,
               data={"path": remote_path},
               files={"files": (fp.name, data, "text/html")},
               headers={"X-CSRFToken": csrf, "Referer": FILES_URL},
               timeout=TIMEOUT)
    body = r.text[:200].replace("\n", " ")
    ok = r.status_code == 200 and ('"success": true' in r.text or '"success":true' in r.text)
    print(f"  {'✓' if ok else '✗'} {fp.name:16s} → {remote_path or '(root)'}  [{r.status_code}] {body}")
    return ok


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dir", type=Path, default=PUBLISH)
    ap.add_argument("--path", default=REMOTE_PATH, help="원격 하위폴더(기본 hrd22/, 루트는 빈 문자열)")
    ap.add_argument("--dry-run", action="store_true", help="로그인까지만 확인")
    args = ap.parse_args()
    remote_path = args.path

    creds = read_creds()
    if creds is None:
        cand = " 또는 ".join(str(p) for p in CREDS_CANDIDATES)
        print(f"⏭ 자격증명 없음 — 업로드 건너뜀. 다음 위치 중 하나에 APPS_ID/APPS_PW 작성: {cand}")
        return 2
    print(f"자격증명: {_creds_path()}")

    uid, pw = creds
    targets = [args.dir / f for f in FILES if (args.dir / f).exists()]
    if not targets:
        print(f"✗ 업로드 대상 없음: {args.dir.relative_to(ROOT) if args.dir.is_relative_to(ROOT) else args.dir}")
        return 1
    print(f"업로드 대상 {len(targets)}개 → {FILES_URL}{remote_path}")

    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"})
    if not login(s, uid, pw):
        print("✗ 로그인 실패 — 자격증명·CSRF·세션 확인(가이드 §6).")
        return 1
    if args.dry_run:
        print("✓ 로그인 성공 (--dry-run, 업로드 생략)")
        return 0

    results = [upload_file(s, fp, remote_path) for fp in targets]
    n_ok = sum(results)
    # 정적 경로가 아니라 preview 뷰어로 렌더됨(2026-06-01 확인)
    share = f"{BASE}/staff/{SERVICE_ID}/preview/{remote_path}index.html"
    print(f"\n업로드 완료 {n_ok}/{len(targets)}")
    print(f"공유 URL(허브): {share}")
    return 0 if n_ok == len(targets) else 1


if __name__ == "__main__":
    sys.exit(main() or 0)
