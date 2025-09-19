#!/bin/bash

echo "🚀 Backend server başlatılıyor..."

# Check if we're in a packaged app
if [ "$NODE_ENV" = "production" ] || [ "$APP_ENV" = "production" ]; then
    # In packaged app, use resources path
    RESOURCES_PATH="$(dirname "$0")/../Resources"
    BACKEND_PATH="$RESOURCES_PATH/backend"
else
    # In development
    BACKEND_PATH="$(dirname "$0")/backend"
fi

echo "Backend path: $BACKEND_PATH"

# Backend klasörüne git ve npm start çalıştır
cd "$BACKEND_PATH"
exec npm start
