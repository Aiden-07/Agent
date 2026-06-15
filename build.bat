@echo off
echo ==========================================
echo      Building AgentEditor Distribution
echo ==========================================

REM 1. Clean up previous builds
echo [1/5] Cleaning up previous build artifacts...
if exist build rd /s /q build
if exist dist rd /s /q dist
if exist AgentEditor_Distribution rd /s /q AgentEditor_Distribution

REM 2. Run PyInstaller
echo [2/5] Compiling executable with PyInstaller...
pyinstaller server.spec
if %errorlevel% neq 0 (
    echo Error: PyInstaller failed!
    pause
    exit /b %errorlevel%
)

REM 3. Create Distribution Directory
echo [3/5] Creating distribution directory...
mkdir AgentEditor_Distribution

REM 4. Copy Files
echo [4/5] Copying files...

REM Copy Executable
copy dist\AgentEditor.exe AgentEditor_Distribution\

REM Copy Static Resources
echo   - Copying index.html...
copy index.html AgentEditor_Distribution\
echo   - Copying README.md...
copy README.md AgentEditor_Distribution\

echo   - Copying css...
xcopy css AgentEditor_Distribution\css\ /E /I /Y
echo   - Copying js...
xcopy js AgentEditor_Distribution\js\ /E /I /Y
echo   - Copying views...
xcopy views AgentEditor_Distribution\views\ /E /I /Y
echo   - Copying data...
xcopy data AgentEditor_Distribution\data\ /E /I /Y

REM 5. Create Zip Archive (using PowerShell)
echo [5/5] Creating Zip archive...
if exist AgentEditor_Distribution.zip del AgentEditor_Distribution.zip
powershell Compress-Archive -Path AgentEditor_Distribution -DestinationPath AgentEditor_Distribution.zip

echo ==========================================
echo      Build Complete!
echo ==========================================
echo Output directory: AgentEditor_Distribution
echo Zip file: AgentEditor_Distribution.zip
echo.
