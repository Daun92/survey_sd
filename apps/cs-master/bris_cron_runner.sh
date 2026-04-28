#!/bin/bash
# ============================================================
# BRIS → Supabase 주간 자동 동기화 스크립트
# ============================================================
# crontab 등록 예시 (매주 월요일 오전 9시):
#   0 9 * * 1 /path/to/bris_cron_runner.sh >> /var/log/bris_sync.log 2>&1
#
# 필요 환경변수 (.env 파일 또는 export):
#   SUPABASE_URL, SUPABASE_SERVICE_KEY, BRIS_COOKIE_FILE
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "========================================"
echo "[$LOG_DATE] BRIS 동기화 시작"
echo "========================================"

# .env 파일이 있으면 로드
if [ -f "$SCRIPT_DIR/.env" ]; then
    echo "[info] .env 파일 로드: $SCRIPT_DIR/.env"
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
fi

# 필수 환경변수 확인
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "[ERROR] SUPABASE_URL, SUPABASE_SERVICE_KEY 환경변수 필요"
    exit 1
fi

if [ -z "$BRIS_COOKIE_FILE" ]; then
    BRIS_COOKIE_FILE="$SCRIPT_DIR/cookies.json"
fi

if [ ! -f "$BRIS_COOKIE_FILE" ]; then
    echo "[ERROR] 쿠키 파일 없음: $BRIS_COOKIE_FILE"
    echo "[info] BRIS 로그인 후 쿠키 파일을 생성하세요"
    exit 1
fi

export BRIS_COOKIE_FILE

# Python 실행
cd "$SCRIPT_DIR"
python3 bris_to_supabase.py cron

EXIT_CODE=$?
END_DATE=$(date '+%Y-%m-%d %H:%M:%S')

if [ $EXIT_CODE -eq 0 ]; then
    echo "[$END_DATE] 동기화 성공"
else
    echo "[$END_DATE] 동기화 실패 (exit code: $EXIT_CODE)"
fi

echo "========================================"
