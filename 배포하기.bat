@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   고고전진! Firebase 배포 스크립트
echo ========================================
echo.

set PATH=C:\Program Files\nodejs;%PATH%

echo [1/3] Firebase 로그인 중... (브라우저가 열립니다)
echo   → Google 계정으로 로그인해주세요
echo.
call npx -y firebase-tools login

echo.
echo [2/3] 배포 준비 중...
echo.

echo [3/3] Firebase에 배포합니다...
call npx -y firebase-tools deploy --only hosting --project gogo-forward

echo.
echo ========================================
echo   배포 완료!
echo   https://gogo-forward.web.app
echo ========================================
echo.
pause
