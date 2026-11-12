$ErrorActionPreference = "Stop"

$SDK = "C:\Users\DELL\AppData\Local\Android\Sdk"
$BUILD_TOOLS = "$SDK\build-tools\35.0.0"
$PLATFORM = "$SDK\platforms\android-35"
$APP_DIR = "C:\smp\bot\android_app"
$BUILD_DIR = "$APP_DIR\build"

Write-Host "[1/6] Cleaning build directory..."
if (Test-Path $BUILD_DIR) { Remove-Item -Recurse -Force $BUILD_DIR }
New-Item -ItemType Directory -Force -Path "$BUILD_DIR\gen", "$BUILD_DIR\classes" | Out-Null

Write-Host "[2/6] Compiling resources with aapt2..."
& "$BUILD_TOOLS\aapt2.exe" compile --dir "$APP_DIR\res" -o "$BUILD_DIR\compiled_res.zip"
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

Write-Host "[3/6] Linking resources with aapt2..."
& "$BUILD_TOOLS\aapt2.exe" link -o "$BUILD_DIR\base.apk" `
  -I "$PLATFORM\android.jar" `
  --manifest "$APP_DIR\AndroidManifest.xml" `
  --java "$BUILD_DIR\gen" `
  --auto-add-overlay `
  "$BUILD_DIR\compiled_res.zip"
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

Write-Host "[4/6] Compiling Java code with javac..."
$javaFiles = Get-ChildItem -Path "$BUILD_DIR\gen", "$APP_DIR\src" -Recurse -Filter "*.java" | ForEach-Object { $_.FullName }
& javac -d "$BUILD_DIR\classes" -cp "$PLATFORM\android.jar" --release 17 $javaFiles
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

Write-Host "[5/6] Dexing bytecode with D8..."
$classFiles = Get-ChildItem -Path "$BUILD_DIR\classes" -Recurse -Filter "*.class" | ForEach-Object { $_.FullName }
& java -cp "$BUILD_TOOLS\lib\d8.jar" com.android.tools.r8.D8 --output $BUILD_DIR --min-api 24 --lib "$PLATFORM\android.jar" $classFiles
if ($LASTEXITCODE -ne 0) { throw "D8 failed" }

Write-Host "[6/6] Packaging, aligning and signing APK..."
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open("$BUILD_DIR\base.apk", "Update")
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "$BUILD_DIR\classes.dex", "classes.dex")
$zip.Dispose()

# Zipalign
& "$BUILD_TOOLS\zipalign.exe" -f -p 4 "$BUILD_DIR\base.apk" "$BUILD_DIR\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

# Keystore
$keystore = "$APP_DIR\debug.keystore"
if (-not (Test-Path $keystore)) {
    Write-Host "Generating debug keystore..."
    & keytool -genkeypair -v -keystore $keystore -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=Android Debug,O=Android,C=US"
}

# Sign APK
$outputApk = "$APP_DIR\MEXVERSE-Bot-Switch.apk"
& java -jar "$BUILD_TOOLS\lib\apksigner.jar" sign --ks $keystore --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android --out $outputApk "$BUILD_DIR\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }

# Copy to Desktop
Copy-Item -Force $outputApk "C:\Users\DELL\Desktop\MEXVERSE-Bot-Switch.apk"

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "✅ ANDROID APK SUCCESSFULLY BUILT AND SIGNED!" -ForegroundColor Green
Write-Host "• APK Path:     $outputApk" -ForegroundColor Cyan
Write-Host "• Desktop Path: C:\Users\DELL\Desktop\MEXVERSE-Bot-Switch.apk" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Green
