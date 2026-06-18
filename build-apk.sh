#!/bin/bash

echo "🚀 START BUILD APK..."

# 1. Build web
echo "📦 Building web app..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build web failed"
  exit 1
fi

# 2. Copy + Sync Capacitor
echo "🔄 Sync Capacitor..."
npx cap copy android
npx cap sync android

if [ $? -ne 0 ]; then
  echo "❌ Capacitor sync failed"
  exit 1
fi

# 3. Build APK bằng Gradle
echo "📱 Building APK (debug)..."
cd android || exit

./gradlew assembleDebug

if [ $? -ne 0 ]; then
  echo "❌ Gradle build failed"
  exit 1
fi

# 4. Output APK path
APK_PATH="app/build/outputs/apk/debug/app-debug.apk"

echo "✅ BUILD SUCCESS!"
echo "📍 APK location: android/$APK_PATH"