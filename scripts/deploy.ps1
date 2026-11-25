<#
  Automated deploy to Vercel (and optional Supabase migration).

  One-time prerequisites:
    1. Copy .env.example to .env.production and fill in the three Supabase values
       (or leave them empty to deploy in playable in-memory fallback mode).
    2. Set VERCEL_TOKEN, or run `vercel login` once (interactive).
    3. (Optional, for auto-migrations) install the Supabase CLI and set
       SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD.

  Usage:
    powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1
#>
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

# --- load .env.production into the environment ---
if (Test-Path ".env.production") {
  Get-Content ".env.production" | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)\s*=\s*(.*)$') {
      [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
  }
}

if (-not $env:NEXT_PUBLIC_SUPABASE_URL -or -not $env:SUPABASE_SERVICE_ROLE_KEY) {
  Write-Warning "Supabase env vars missing -> deploying in in-memory fallback mode (playable, no persistence)."
}

# --- Vercel auth ---
if ($env:VERCEL_TOKEN) {
  vercel login --token $env:VERCEL_TOKEN
}

# --- link, set env, deploy ---
vercel link --yes

if ($env:NEXT_PUBLIC_SUPABASE_URL) {
  $env:NEXT_PUBLIC_SUPABASE_URL | vercel env add NEXT_PUBLIC_SUPABASE_URL production
}
if ($env:NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  $env:NEXT_PUBLIC_SUPABASE_ANON_KEY | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
}
if ($env:SUPABASE_SERVICE_ROLE_KEY) {
  $env:SUPABASE_SERVICE_ROLE_KEY | vercel env add SUPABASE_SERVICE_ROLE_KEY production
}

vercel deploy --prod

Write-Host ""
Write-Host "Deployed. If Supabase is configured, run these in your Supabase SQL editor:"
Write-Host "  1. supabase/migrations/0001_init.sql"
Write-Host "  2. supabase/migrations/0002_seed_bank.sql"
