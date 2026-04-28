"""FastAPI 진입점"""

from fastapi import FastAPI

# deps 를 먼저 import 하여 sys.path 설정 (bris_api/bris_to_supabase 발견용)
from . import deps  # noqa: F401
from .routers import meta, parse, sync


app = FastAPI(
    title='BRIS Parser & Sync API',
    description=(
        'BRIS HTML 파서 + Supabase 동기화 게이트웨이.\n\n'
        '- `/v1/parse/{kind}` — stateless 파서 (8종)\n'
        '- `/v1/sync` — BRIS fetch + Supabase upsert\n'
        '- `/v1/sync/from-html` — 로컬 HTML 동기화\n\n'
        '인증: `X-API-Key` 헤더 (env `BRIS_API_KEY`)'
    ),
    version='0.1.0',
)

app.include_router(meta.router)
app.include_router(parse.router, prefix='/v1')
app.include_router(sync.router, prefix='/v1')
