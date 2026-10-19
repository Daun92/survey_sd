@echo off
rem 고객사 담당자 유효성 신호 반영 — bris-sync warehouse place_dm_list → Supabase cs_contacts
rem 스케줄: CS_ContactDM_Sync_Daily 매일 09:45 (BRIS_DuckDB_Daily 07:00 · BRIS_Sync_Daily 09:00 · CS_SC_Sync_Daily 09:40 이후)
setlocal
set SCRIPT_DIR=%~dp0
set LOG=%SCRIPT_DIR%logs\contact_dm_sync_%date:~0,4%%date:~5,2%%date:~8,2%.log
if not exist "%SCRIPT_DIR%logs" mkdir "%SCRIPT_DIR%logs"
echo [%date% %time%] contact_dm_sync start >> "%LOG%"
"D:\claude\bris-sync\.venv\Scripts\python.exe" "%SCRIPT_DIR%contact_dm_from_warehouse.py" >> "%LOG%" 2>&1
echo [%date% %time%] contact_dm_sync exit=%errorlevel% >> "%LOG%"
endlocal
