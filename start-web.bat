@echo off
rem ZkPlayer - mode web : catalogue dans le navigateur, lecture dans VLC.
rem Double-cliquez sur ce fichier. Aucun .exe a signer.
setlocal
cd /d "%~dp0"
title ZkPlayer (mode web)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable. Installez-le depuis https://nodejs.org/ puis relancez.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installation des dependances (premiere fois uniquement^)...
  call npm install --no-audit --no-fund || goto :error
)

if not exist "dist\index.html" (
  echo Construction de l'interface (premiere fois uniquement^)...
  call npm run build:web || goto :error
)

node server\web-server.mjs
goto :eof

:error
echo.
echo Une erreur est survenue.
pause
exit /b 1
