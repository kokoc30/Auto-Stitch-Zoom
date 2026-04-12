param(
  [switch]$Share,
  [ValidateSet('ngrok', 'cloudflared')]
  [string]$Tunnel
)

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

function Invoke-Npm {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  $npmCommand = if ($IsWindows -or $env:OS -eq 'Windows_NT') { 'npm.cmd' } else { 'npm' }
  & $npmCommand @Args
  return $LASTEXITCODE
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

$clientModules = Test-Path (Join-Path $projectRoot 'client\node_modules')
$serverModules = Test-Path (Join-Path $projectRoot 'server\node_modules')

if (-not $clientModules -or -not $serverModules) {
  Write-Step "Dependencies missing - running npm run install:all..."
  $exitCode = Invoke-Npm -Args @('run', 'install:all')
  if ($exitCode -ne 0) {
    Fail "npm run install:all failed. Run '.\setup.ps1' for full first-time setup."
  }
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
  Write-Warning "FFmpeg or ffprobe was not found in this shell. The backend can still start, but processing requires ffmpeg/ffprobe on PATH or FFMPEG_BIN / FFPROBE_BIN to be configured."
}

$shareMode = $Share -or ($Tunnel -eq 'ngrok') -or ($Tunnel -eq 'cloudflared')

if ($shareMode) {
  $selectedTunnel = if ($Tunnel) { $Tunnel } else { 'cloudflared' }

  Write-Step "Share mode requested."
  Write-Step "Start the app in Terminal 1 with one of these:"
  Write-Step "  npm run start:prod"
  Write-Step "  npm run serve:prod"
  Write-Step "Then open Terminal 2 and run:"
  Write-Step "  npm run tunnel:$selectedTunnel"
  Write-Step "This script does not launch the tunnel automatically."
  exit 0
}

Write-Step "Starting backend and frontend..."
Write-Step "Backend: http://localhost:3001"
Write-Step "Frontend: watch for the Vite local URL below (usually http://localhost:5173)"
Write-Step "Press Ctrl+C to stop both."

$exitCode = Invoke-Npm -Args @('run', 'dev')
if ($exitCode -ne 0) {
  exit $exitCode
}