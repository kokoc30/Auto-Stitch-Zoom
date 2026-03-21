param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Step {
  param([string]$Message)
  Write-Host "[start] $Message" -ForegroundColor Cyan
}

function Fail {
  param([string]$Message)
  Write-Host "[start] $Message" -ForegroundColor Red
  exit 1
}

Set-Location $projectRoot

Write-Step "Validating project root..."

if (-not (Test-Path (Join-Path $projectRoot 'package.json'))) {
  Fail "Root package.json was not found. Run this script from the project root."
}

if (-not (Test-Path (Join-Path $projectRoot 'client\package.json'))) {
  Fail "Client package.json is missing."
}

if (-not (Test-Path (Join-Path $projectRoot 'server\package.json'))) {
  Fail "Server package.json is missing."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail "Node.js is not available in PATH."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Fail "npm is not available in PATH."
}

if (-not (Test-Path (Join-Path $projectRoot 'client\node_modules'))) {
  Fail "Client dependencies are missing. Run 'npm run install:all' from the project root first."
}

if (-not (Test-Path (Join-Path $projectRoot 'server\node_modules'))) {
  Fail "Server dependencies are missing. Run 'npm run install:all' from the project root first."
}

$ffmpegAvailable = $false
$ffprobeAvailable = $false

if ($env:FFMPEG_BIN) {
  $ffmpegAvailable = Test-Path $env:FFMPEG_BIN
} else {
  $ffmpegAvailable = [bool](Get-Command ffmpeg -ErrorAction SilentlyContinue)
}

if ($env:FFPROBE_BIN) {
  $ffprobeAvailable = Test-Path $env:FFPROBE_BIN
} else {
  $ffprobeAvailable = [bool](Get-Command ffprobe -ErrorAction SilentlyContinue)
}

if (-not $ffmpegAvailable -or -not $ffprobeAvailable) {
  Write-Warning 'FFmpeg or ffprobe was not found in this shell. The backend can still start, but processing requires ffmpeg/ffprobe on PATH or FFMPEG_BIN / FFPROBE_BIN to be configured.'
}

Write-Step 'Starting backend and frontend...'
Write-Step 'Backend: http://localhost:3001'
Write-Step 'Frontend: watch for the Vite local URL below (usually http://localhost:5173)'
Write-Step 'Press Ctrl+C to stop both.'

npm run dev

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
