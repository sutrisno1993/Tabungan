@echo off
title SITAB - Sistem Informasi Tabungan Siswa
echo ==========================================================
echo           SITAB - Sistem Informasi Tabungan Siswa
echo                    SMK 11 Maret Jakarta
echo ==========================================================
echo.
echo Sedang memulai aplikasi SITAB...
echo.

:: Memulai Backend di jendela terminal baru
echo [1/2] Menjalankan Backend (Port 3000)...
start "SITAB Backend (Port 3000)" cmd /c "cd /d "%~dp0backend" && npm run dev"

:: Memulai Frontend di jendela terminal baru
echo [2/2] Menjalankan Frontend (Port 5173)...
start "SITAB Frontend (Port 5173)" cmd /c "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ==========================================================
echo  Aplikasi sedang berjalan!
echo  - Frontend: http://localhost:5173
echo  - Backend : http://localhost:3000
echo  - Untuk menghentikan aplikasi, silakan tutup jendela CMD
echo    yang baru saja terbuka.
echo ==========================================================
echo.
pause
