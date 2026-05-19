@echo off
title CRM Probel - Dev Server
cd /d "%~dp0"
cls
echo ========================================
echo   CRM Probel - Servidor de Desenvolvimento
echo ========================================
echo.
echo URL: http://localhost:3000
echo.
echo Para parar: Ctrl+C ou feche esta janela.
echo NAO feche enquanto estiver usando o CRM.
echo.
echo ========================================
echo.
call npm run dev
echo.
echo ========================================
echo   Servidor parou.
echo ========================================
echo.
echo Pressione qualquer tecla para fechar.
pause >nul
