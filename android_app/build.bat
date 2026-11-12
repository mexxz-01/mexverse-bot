@echo off
setlocal enabledelayedexpansion

set "SDK=C:\Users\DELL\AppData\Local\Android\Sdk"
set "BUILD_TOOLS=%SDK%\build-tools\35.0.0"
set "PLATFORM=%SDK%\platforms\android-35"
set "APP_DIR=C:\smp\bot\android_app"

echo [1/6] Cleaning build folder...
if exist "%APP_DIR%\build" rd /s /q "%APP_DIR%\build"
mkdir "%APP_DIR%\build\compiled_res"
mkdir "%APP_DIR%\build\gen"
mkdir "%APP_DIR%\build\classes"

echo [2/6] Compiling resources with aapt2...
"%BUILD_TOOLS%\aapt2.exe" compile --dir "%APP_DIR%\res" -o "%APP_DIR%\build\compiled_res.zip"
if %ERRORLEVEL% NEQ 0 (
  echo Error compiling resources!
  exit /b 1
)

echo [3/6] Linking resources and generating R.java...
"%BUILD_TOOLS%\aapt2.exe" link -o "%APP_DIR%\build\base.apk" ^
  -I "%PLATFORM%\android.jar" ^
  --manifest "%APP_DIR%\AndroidManifest.xml" ^
  --java "%APP_DIR%\build\gen" ^
  --auto-add-overlay ^
  "%APP_DIR%\build\compiled_res.zip"
if %ERRORLEVEL% NEQ 0 (
  echo Error linking resources!
  exit /b 1
)

echo [4/6] Compiling Java source files...
javac -d "%APP_DIR%\build\classes" ^
  -cp "%PLATFORM%\android.jar" ^
  --release 17 ^
  "%APP_DIR%\build\gen\com\mexverse\switchapp\R.java" ^
  "%APP_DIR%\src\com\mexverse\switchapp\MainActivity.java"
if %ERRORLEVEL% NEQ 0 (
  echo Error compiling Java classes!
  exit /b 1
)

echo [5/6] Dexing bytecode with d8...
cd /d "%APP_DIR%\build\classes"
cmd /c "%BUILD_TOOLS%\d8.bat" --output "%APP_DIR%\build" --min-api 24 com\mexverse\switchapp\*.class
if %ERRORLEVEL% NEQ 0 (
  echo Error dexing bytecode!
  exit /b 1
)
cd /d "%APP_DIR%"

echo [6/6] Packaging and signing APK...
cd /d "%APP_DIR%\build"
tar -xf "%APP_DIR%\build\base.apk" -C "%APP_DIR%\build\unaligned" 2>nul || (
  mkdir "%APP_DIR%\build\unaligned"
  tar -xf "%APP_DIR%\build\base.apk" -C "%APP_DIR%\build\unaligned"
)
copy "%APP_DIR%\build\classes.dex" "%APP_DIR%\build\unaligned\" >nul

cd /d "%APP_DIR%\build\unaligned"
tar -cf "%APP_DIR%\build\app-unaligned.apk" --format zip *
cd /d "%APP_DIR%"

if not exist "%APP_DIR%\debug.keystore" (
  echo Generating debug keystore...
  keytool -genkeypair -v -keystore "%APP_DIR%\debug.keystore" -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=Android Debug,O=Android,C=US"
)

cmd /c "%BUILD_TOOLS%\apksigner.bat" sign --ks "%APP_DIR%\debug.keystore" --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android --out "%APP_DIR%\MEXVERSE-Bot-Switch.apk" "%APP_DIR%\build\app-unaligned.apk"
if %ERRORLEVEL% NEQ 0 (
  echo Error signing APK!
  exit /b 1
)

echo.
echo ==============================================
echo [SUCCESS] APK BUILT SUCCESSFULLY!
echo Path: %APP_DIR%\MEXVERSE-Bot-Switch.apk
copy /y "%APP_DIR%\MEXVERSE-Bot-Switch.apk" "C:\Users\DELL\Desktop\MEXVERSE-Bot-Switch.apk"
echo Copied to Desktop: C:\Users\DELL\Desktop\MEXVERSE-Bot-Switch.apk
echo ==============================================
