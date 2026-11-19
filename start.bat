@echo off
title Padavo (पड़ाव) — Production-Status Portal Server
echo ========================================================
echo Starting Padavo B2B SaaS Engine (Har Padav Par Bharosa)
echo ========================================================
echo Local Portal: http://localhost:3001
echo Public UK Buyer Tracking: http://localhost:3001/buyer-tracking-uk.html
echo Health Check: http://localhost:3001/health
echo ========================================================
echo.
node server.js
pause
