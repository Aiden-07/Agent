#!/bin/bash
echo "=========================================="
echo "     Building AgentEditor Distribution"
echo "=========================================="

# Add local python bin to path just in case
export PATH=$PATH:$HOME/Library/Python/3.9/bin

# 1. Clean up previous builds
echo "[1/5] Cleaning up previous build artifacts..."
rm -rf build dist AgentEditor_Distribution AgentEditor_Distribution.zip

# 2. Run PyInstaller
echo "[2/5] Compiling executable with PyInstaller..."
/usr/bin/python3 -m PyInstaller server.spec
if [ $? -ne 0 ]; then
    echo "Error: PyInstaller failed!"
    exit 1
fi

# 3. Create Distribution Directory
echo "[3/5] Creating distribution directory..."
mkdir -p AgentEditor_Distribution

# 4. Copy Files
echo "[4/5] Copying files..."

# Copy Executable
cp dist/AgentEditor AgentEditor_Distribution/

# Copy Static Resources
echo "  - Copying index.html..."
cp index.html AgentEditor_Distribution/
echo "  - Copying README.md..."
cp README.md AgentEditor_Distribution/

echo "  - Copying css..."
cp -r css AgentEditor_Distribution/
echo "  - Copying js..."
cp -r js AgentEditor_Distribution/
echo "  - Copying views..."
cp -r views AgentEditor_Distribution/
echo "  - Copying data..."
cp -r data AgentEditor_Distribution/

# 5. Create Zip Archive
echo "[5/5] Creating Zip archive..."
rm -f AgentEditor_Distribution.zip
cd AgentEditor_Distribution
zip -r ../AgentEditor_Distribution.zip ./*
cd ..

echo "=========================================="
echo "     Build Complete!"
echo "=========================================="
echo "Output directory: AgentEditor_Distribution"
echo "Zip file: AgentEditor_Distribution.zip"
echo ""
