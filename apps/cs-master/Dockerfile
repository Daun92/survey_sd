# Phase 4: BRIS API Server container image
FROM python:3.13-slim AS runtime

# 시스템 업데이트 + 타임존(한국)
RUN apt-get update \
 && apt-get install -y --no-install-recommends tzdata \
 && ln -sf /usr/share/zoneinfo/Asia/Seoul /etc/localtime \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    TZ=Asia/Seoul \
    UVICORN_WORKERS=2

# non-root 사용자
RUN groupadd -g 1000 appuser \
 && useradd  -u 1000 -g 1000 -ms /bin/bash appuser

WORKDIR /app

# ---- 의존성 계층 분리 (빌드 캐시 활용) ----
# lib 메타데이터만 먼저 복사해 pip install
COPY lib/bris-parser-py/pyproject.toml lib/bris-parser-py/
COPY lib/bris-parser-py/README.md      lib/bris-parser-py/
COPY lib/bris-api/pyproject.toml       lib/bris-api/
COPY lib/bris-api/README.md            lib/bris-api/
# src 는 editable install 요구사항 충족용 (실제 코드는 아래에서 재복사)
COPY lib/bris-parser-py/src/bris_parser/__init__.py lib/bris-parser-py/src/bris_parser/__init__.py
COPY lib/bris-api/src/bris_api_server/__init__.py   lib/bris-api/src/bris_api_server/__init__.py

RUN pip install -e lib/bris-parser-py \
 && pip install -e "lib/bris-api[sync]"

# ---- 애플리케이션 코드 복사 ----
COPY lib/bris-parser-py/ lib/bris-parser-py/
COPY lib/bris-api/       lib/bris-api/
COPY bris_api.py         ./
COPY bris_to_supabase.py ./

# secrets 디렉터리 (쿠키 파일 마운트 대상)
RUN mkdir -p /secrets && chown -R appuser:appuser /app /secrets

USER appuser

EXPOSE 8000

# 헬스체크 — python 표준 라이브러리로 curl 의존 제거
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/v1/health',timeout=3).status==200 else 1)"

CMD ["sh", "-c", "uvicorn bris_api_server:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS}"]
