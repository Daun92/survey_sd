@echo off
rem 고객사 담당자 유효성 신호 반영 — bris-sync warehouse place_dm_list → Supabase cs_contacts
rem 스케줄: CS_ContactDM_Sync_Daily 매일 18:00 (BRIS_DuckDB_Daily 04:20 적재분 반영)
rem 실행 위치: main 고정 worktree survey_sd-ops (작업 트리 브랜치 전환에 영향받지 않도록)
setlocal
set PYTHONIOENCODING=utf-8
set SCRIPT_DIR=%~dp0
set LOG=%SCRIPT_DIR%logs\contact_dm_sync_%date:~0,4%%date:~5,2%%date:~8,2%.log
if not exist "%SCRIPT_DIR%logs" mkdir "%SCRIPT_DIR%logs"
echo [%date% %time%] contact_dm_sync start >> "%LOG%"
"D:\claude\bris-sync\.venv\Scripts\python.exe" "%SCRIPT_DIR%contact_dm_from_warehouse.py" >> "%LOG%" 2>&1
echo [%date% %time%] contact_dm_sync exit=%errorlevel% >> "%LOG%"
endlocal
