#!/bin/bash

echo "🚀 Etiketleme Sistemi Backend Server"
echo "===================================="

# Backend klasörüne git
cd "$(dirname "$0")/backend"

echo "📁 Backend klasörü: $(pwd)"
echo "🔧 Backend başlatılıyor..."

# npm start ile backend'i başlat
npm start
