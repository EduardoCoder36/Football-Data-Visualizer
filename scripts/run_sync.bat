@echo off
REM ============================================================================
REM Orchestrated Runner for Cup, European & Match Predictions Sync
REM Suitable for Windows Task Scheduler or manual runs.
REM ============================================================================

setlocal enabledelayedexpansion
cd /d "%~dp0\.."

echo [INFO] Activating virtual environment...
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
) else (
    echo [WARNING] .venv not found, using system Python.
)

echo.
echo [1/2] Syncing Cup ^& European Fixtures (API-Football)...
python scripts/sync_cups_and_europe.py
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Cup ^& European fixture sync failed with exit code %ERRORLEVEL%.
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Synchronizing Match Predictions V2 ^& Multi-Competition Fatigue...
python scripts/sync_upcoming_predictions_v2.py
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Prediction sync failed with exit code %ERRORLEVEL%.
    exit /b %ERRORLEVEL%
)

echo.
echo [SUCCESS] Multi-competition sync and prediction pipeline completed successfully.
exit /b 0
