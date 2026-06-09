# HRD 22th survey - daily data refresh (for Windows Task Scheduler)
#   fetch_raw -> validate -> render(deck/result/segment) -> outliers -> dashboard -> hub(publish/) -> upload(apps.exc, non-fatal)
#   Log: logs/pipeline_YYYYMMDD_HHMMSS.log  | propagates exit code so the scheduler sees failures.
#   Upload needs creds/apps_creds.txt (skipped if absent; never aborts the run).
#
# NOTE: content is ASCII-only on purpose. Task Scheduler runs powershell.exe (PS 5.1),
#       which reads a BOM-less UTF-8 .ps1 as the legacy code page and would corrupt any
#       non-ASCII (Korean) path literal. Paths are derived from $PSScriptRoot at runtime instead.
#
# Register (admin PowerShell), daily 07:00 -- already done via Register-ScheduledTask 'HRD22_daily'.
# Manual run:  powershell -NoProfile -ExecutionPolicy Bypass -File <this file>

$ErrorActionPreference = 'Stop'

# Force UTF-8 so Korean stdout from the python steps is captured/logged correctly under powershell.exe (PS 5.1).
try { chcp 65001 > $null } catch {}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$proj = Split-Path -Parent $PSScriptRoot      # scripts/ -> project root (Korean path, resolved at runtime)
$py   = 'C:\Python313\python.exe'             # adjust if Python lives elsewhere: (Get-Command python).Source

$logDir = Join-Path $proj 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir ("pipeline_{0}.log" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))

Set-Location $proj
$env:PYTHONIOENCODING = 'utf-8'
& $py 'scripts\run_pipeline.py' *>&1 | Tee-Object -FilePath $log
$code = $LASTEXITCODE
if ($code -ne 0) { Write-Host "[daily_update] FAILED (exit $code) - log: $log" }
exit $code
