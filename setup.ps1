$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Step {
  param([string]$Message)
  Write-Host "[setup] $Message" -ForegroundColor Cyan
}

function Write-OK {
  param([string]$Message)
  Write-Host "[setup] $Message" -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Host "[setup] $Message" -ForegroundColor Yellow
}

function Fail {
  param([string]$Message)
  Write-Host "[setup] $Message" -ForegroundColor Red
  exit 1
}

Set-Location $projectRoot

Write-Host ''
Write-Host '================================================================' -ForegroundColor Cyan
Write-Host ' Auto Stitch & Zoom — first-time setup' -ForegroundColor Cyan
Write-Host '================================================================' -ForegroundColor Cyan
Write-Host ''

# ── 1. Node.js / npm ──────────────────────────────────────────────────

Write-Step 'Checking Node.js...'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail 'Node.js is not installed. Download it from https://nodejs.org (LTS recommended).'
}

$nodeVersion = (node --version) -replace '^v', ''
$nodeMajor = [int]($nodeVersion -split '\.')[0]
if ($nodeMajor -lt 18) {
  Fail "Node.js v$nodeVersion is too old. Version 18 or newer is required. Download from https://nodejs.org"
}
Write-OK "Node.js v$nodeVersion"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Fail 'npm is not available. It should be bundled with Node.js — reinstall Node from https://nodejs.org'
}

$npmVersion = npm --version
Write-OK "npm v$npmVersion"

# ── 2. Install npm dependencies ──────────────────────────────────────

Write-Step 'Installing npm dependencies (root, server, client)...'

npm install 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail 'npm install (root) failed.' }

npm run install:all
if ($LASTEXITCODE -ne 0) { Fail 'npm run install:all failed.' }

Write-OK 'All npm dependencies installed.'

# ── 3. FFmpeg / FFprobe ──────────────────────────────────────────────

Write-Step 'Checking ffmpeg and ffprobe...'

$ffmpegOK = $false
$ffprobeOK = $false

if ($env:FFMPEG_BIN -and (Test-Path $env:FFMPEG_BIN)) {
  $ffmpegOK = $true
} elseif (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
  $ffmpegOK = $true
}

if ($env:FFPROBE_BIN -and (Test-Path $env:FFPROBE_BIN)) {
  $ffprobeOK = $true
} elseif (Get-Command ffprobe -ErrorAction SilentlyContinue) {
  $ffprobeOK = $true
}

if ($ffmpegOK -and $ffprobeOK) {
  Write-OK 'ffmpeg and ffprobe found.'
} else {
  Write-Warn 'ffmpeg or ffprobe not found.'
  Write-Warn 'Server-side video processing will not work without them.'
  Write-Warn 'Browser-only processing still works without ffmpeg.'
  Write-Warn ''
  Write-Warn 'To install ffmpeg:'
  Write-Warn '  Windows (winget):  winget install Gyan.FFmpeg'
  Write-Warn '  Windows (choco):   choco install ffmpeg'
  Write-Warn '  Windows (scoop):   scoop install ffmpeg'
  Write-Warn '  macOS:             brew install ffmpeg'
  Write-Warn '  Linux:             sudo apt install ffmpeg'
  Write-Warn ''
  Write-Warn 'Or set FFMPEG_BIN / FFPROBE_BIN environment variables to the binary paths.'
}

# ── 4. Optional tunnel tools ─────────────────────────────────────────

Write-Step 'Checking optional tunnel tools...'

$hasNgrok = [bool](Get-Command ngrok -ErrorAction SilentlyContinue)
$hasCloudflared = [bool](Get-Command cloudflared -ErrorAction SilentlyContinue)

if ($hasNgrok -or $hasCloudflared) {
  $tunnelTools = @()
  if ($hasNgrok) { $tunnelTools += 'ngrok' }
  if ($hasCloudflared) { $tunnelTools += 'cloudflared' }
  Write-OK "Tunnel tools found: $($tunnelTools -join ', ')"
} else {
  Write-Warn 'No tunnel tools found (ngrok, cloudflared).'
  Write-Warn 'These are optional — only needed to share the app over the internet.'
  Write-Warn 'Install later if needed: https://ngrok.com/download or https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/'
}

# ── Done ─────────────────────────────────────────────────────────────

Write-Host ''
Write-Host '================================================================' -ForegroundColor Green
Write-Host ' Setup complete!' -ForegroundColor Green
Write-Host '================================================================' -ForegroundColor Green
Write-Host ''
Write-Host ' To run in dev mode (hot reload):' -ForegroundColor White
Write-Host '   .\start.ps1' -ForegroundColor Yellow
Write-Host ''
Write-Host ' To run in production mode (build + serve):' -ForegroundColor White
Write-Host '   npm run start:prod' -ForegroundColor Yellow
Write-Host ''
Write-Host ' To share via tunnel (run in a second terminal):' -ForegroundColor White
Write-Host '   npm run tunnel:ngrok' -ForegroundColor Yellow
Write-Host '   npm run tunnel:cloudflared' -ForegroundColor Yellow
Write-Host ''
