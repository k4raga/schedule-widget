@echo off
cd /d "%~dp0"
start "" /B cmd /c npm start 2>nul
exit
