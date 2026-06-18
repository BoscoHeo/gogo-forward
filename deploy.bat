@echo off
set PATH=C:\Program Files\nodejs;%PATH%

echo.
echo === GoGo-Forward Deploy ===
echo.
echo Step 1: Firebase Login...
call "C:\Program Files\nodejs\npx.cmd" -y firebase-tools login

echo.
echo Step 2: Deploying...
call "C:\Program Files\nodejs\npx.cmd" -y firebase-tools deploy --only hosting --project gogo-forward

echo.
echo === DONE! ===
echo URL: https://gogo-forward.web.app
echo.
pause
