@echo off
title CRM Probel - Stop Dev
echo Procurando servidor na porta 3000...
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($c) { Stop-Process -Id $c.OwningProcess -Force; Write-Host ('Servidor parado (PID ' + $c.OwningProcess + ')') -ForegroundColor Green } else { Write-Host 'Nada rodando na porta 3000.' -ForegroundColor Yellow }"
echo.
pause
