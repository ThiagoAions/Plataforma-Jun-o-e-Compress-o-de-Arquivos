@echo off
echo ========================================
echo   AIONS Docs - Iniciando...
echo ========================================
echo.

echo [1/2] Instalando dependencias...
call npm install

echo.
echo [2/2] Iniciando servidor de desenvolvimento...
echo.
echo Acesse: http://localhost:5173
echo Pressione Ctrl+C para encerrar.
echo.
call npm run dev
