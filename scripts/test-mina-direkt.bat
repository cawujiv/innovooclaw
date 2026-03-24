@echo off
echo === MINA Direkttest ===
echo.
echo [Test 1] MINA direkt aufrufen:
powershell -Command ^
  "$b='{\"message\":\"Kontostand\",\"maxTokens\":800}'; $r=Invoke-RestMethod 'http://localhost:3000/api/agent/mina' -Method POST -ContentType 'application/json' -Body $b -TimeoutSec 60; Write-Host 'Agent:' $r.agent; Write-Host 'Reply:' $r.reply"

echo.
echo [Test 2] Drive-Ordner MINA pruefen:
powershell -Command ^
  "$r=Invoke-RestMethod 'http://localhost:3000/api/drive/list?folder=MINA&agent=mina' -TimeoutSec 15; Write-Host 'Ordner:' $r.ordner; Write-Host 'Anzahl:' $r.anzahl; $r.dateien | ForEach-Object { Write-Host '  -' $_.name '|' $_.geaendert }"

echo.
echo [Test 3] Aktuelle Tools von MINA laut Server:
powershell -Command ^
  "$r=Invoke-RestMethod 'http://localhost:3000/api/tool-overrides' -TimeoutSec 10; $m=$r.mina; Write-Host 'MINA effectiveTools:' ($m.effectiveTools -join ', ')"

echo.
pause
