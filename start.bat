@echo off
title Padavo (पड़ाव) — Production-Status Portal Server
echo ========================================================
echo Starting Padavo B2B SaaS Engine (Har Padav Par Bharosa)
echo ========================================================
echo Primary SaaS Access: http://localhost:5500
echo Landing Page: http://localhost:5500/home.html
echo Exporter Portal: http://localhost:5500/index.html
echo Public UK Buyer Tracking: http://localhost:5500/buyer-tracking-uk.html
echo Health Check: http://localhost:5500/health
echo ========================================================
echo.
node server.js
pause
