@echo off
echo ==========================================
echo GitHub-ga kodlarni avtomatik yuklash
echo ==========================================
echo.

cd /d "C:\Users\PC\Documents\GAS"

echo 1. Yangi o'zgarishlar qidirilmoqda...
git add .

echo.
echo 2. Versiya saqlanmoqda...
git commit -m "Avtomatik saqlash: %date% %time%"

echo.
echo 3. Internetga (GitHub) yuklanmoqda...
git push

echo.
echo ==========================================
echo BARCHA KODLAR MUVAFFAQIYATLI SAQLANDI!
echo ==========================================
pause
