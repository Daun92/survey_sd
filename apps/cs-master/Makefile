.PHONY: help build up down logs shell test smoke clean

IMAGE := bris-api-server:0.1.0
PORT  := 8000

help:
	@echo "build   - Docker 이미지 빌드"
	@echo "up      - 컨테이너 기동 (detached)"
	@echo "down    - 컨테이너 중지 + 제거"
	@echo "logs    - 실시간 로그 tail"
	@echo "shell   - 컨테이너 내부 shell 진입"
	@echo "test    - 컨테이너 내부에서 pytest 실행"
	@echo "smoke   - 외부 HTTP smoke 테스트 (health + parse/dm)"

build:
	docker compose build

up:
	docker compose up -d
	@sleep 2
	@$(MAKE) smoke

down:
	docker compose down

logs:
	docker compose logs -f bris-api

shell:
	docker compose exec bris-api bash

test:
	docker compose run --rm bris-api \
	  sh -c "pip install pytest httpx && cd lib/bris-api && python -m pytest -q"

smoke:
	@curl -sf http://localhost:$(PORT)/v1/health || { echo "FAIL /v1/health"; exit 1; }
	@echo "OK /v1/health"
	@curl -sf -X POST http://localhost:$(PORT)/v1/parse/dm \
	  -H "X-API-Key: $${BRIS_API_KEY:-change-me-to-random-string}" \
	  -H "Content-Type: text/html" \
	  --data-binary "@lib/bris-parser/test/fixtures/dm.html" >/dev/null \
	  || { echo "FAIL /v1/parse/dm"; exit 1; }
	@echo "OK /v1/parse/dm"

clean:
	docker compose down -v --rmi local
