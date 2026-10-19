@echo off
rem SC(수주 소유권) 반영 — bris-sync warehouse → Supabase cs_projects.sc_name
rem 스케줄: CS_SC_Sync_Daily 매일 09:40 (BRIS_DuckDB_Daily 07:00 · BRIS_Sync_Daily 09:00 이후)
setlocal
set SCRIPT_DIR=%~dp0
set LOG=%SCRIPT_DIR%logs\sc_sync_%date:~0,4%%date:~5,2%%date:~8,2%.log
if not exist "%SCRIPT_DIR%logs" mkdir "%SCRIPT_DIR%logs"
echo [%date% %time%] sc_sync start >> "%LOG%"
"D:\claude\bris-sync\.venv\Scripts\python.exe" "%SCRIPT_DIR%sc_from_warehouse.py" >> "%LOG%" 2>&1
echo [%date% %time%] sc_sync exit=%errorlevel% >> "%LOG%"
endlocal
