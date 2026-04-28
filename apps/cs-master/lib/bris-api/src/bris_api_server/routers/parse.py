"""파서 엔드포인트 — POST /v1/parse/{kind}"""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..auth import verify_api_key

# bris_parser 패키지에서 함수 import (deps.py에서 sys.path 설정됨)
from bris_parser import (
    BrisParser, parse_as_camelcase,
    extract_edu_detail_data, extract_echoview_data, extract_echo_data,
    extract_project_detail_data, extract_project_biz_list, extract_dm_data,
)

router = APIRouter(tags=['parse'])

# kind → 파싱 함수 매핑
_PARSERS = {
    'integrated': BrisParser.parse,
    'integrated/camelcase': parse_as_camelcase,
    'edu-detail': extract_edu_detail_data,
    'echo-view': extract_echoview_data,
    'echo-data': extract_echo_data,
    'project-detail': extract_project_detail_data,
    'project-biz': extract_project_biz_list,
    'dm': extract_dm_data,
}


async def _read_html(request: Request) -> str:
    """body가 JSON({'html':...})이면 추출, 아니면 raw text로"""
    ct = (request.headers.get('content-type') or '').lower()
    if 'application/json' in ct:
        body = await request.json()
        if not isinstance(body, dict) or 'html' not in body:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                'JSON body must contain "html" field',
            )
        return body['html']
    raw = await request.body()
    return raw.decode('utf-8', errors='replace')


def _make_endpoint(kind: str, fn):
    """클로저로 각 kind 별 엔드포인트 생성"""
    async def endpoint(request: Request, _=Depends(verify_api_key)):
        html = await _read_html(request)
        try:
            return fn(html)
        except Exception as e:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f'Parse failed: {type(e).__name__}: {e}',
            )
    endpoint.__name__ = f'parse_{kind.replace("-", "_").replace("/", "_")}'
    return endpoint


# 각 kind 별로 명시적 라우트 등록 (Swagger UI에 모두 노출됨)
for _kind, _fn in _PARSERS.items():
    router.post(
        f'/parse/{_kind}',
        summary=f'Parse {_kind}',
        description=f'Parse BRIS HTML for {_kind} page. Body: raw HTML or JSON {{"html": "..."}}',
    )(_make_endpoint(_kind, _fn))
