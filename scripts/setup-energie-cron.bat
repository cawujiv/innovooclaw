@echo off
REM Windows Task Scheduler Setup für Energie-Abendroutine
REM Einmalig ausführen um den Task anzulegen (als Administrator)

set TASK_NAME=innovooClaw_Energie_Abend
set SCRIPT=C:\Users\Manfred\Documents\MCP-DATA\innovooClaw\scripts\cron-energie-abend.js
set NODE_PATH=node

REM Task täglich um 21:00 Uhr anlegen
schtasks /Create /TN "%TASK_NAME%" /TR "%NODE_PATH% %SCRIPT%" /SC DAILY /ST 21:00 /F /RU SYSTEM

if %ERRORLEVEL% EQU 0 (
    echo ✅ Task "%TASK_NAME%" erfolgreich angelegt - läuft täglich um 21:00 Uhr
) else (
    echo ❌ Fehler beim Anlegen des Tasks - als Administrator ausführen!
)

echo.
echo Zum Testen (sofort ausführen):
echo   node %SCRIPT%
echo.
echo Task-Status prüfen:
echo   schtasks /Query /TN "%TASK_NAME%" /FO LIST
echo.
pause
