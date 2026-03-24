@echo off
cd /d %~dp0
echo Cleanup innovooClaw Temp-Dateien...
del /f /q proxy_tail.tmp 2>nul
del /f /q _proxy_head.tmp 2>nul
del /f /q _proxy_head_new.tmp 2>nul
del /f /q _proxy_tail.tmp 2>nul
del /f /q proxy.js_ori 2>nul
del /f /q proxy.js_prev 2>nul
del /f /q proxy_tail.tmp 2>nul
echo Fertig.
