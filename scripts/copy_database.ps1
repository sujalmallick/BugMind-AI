<#
Copies the BugMind database from one Postgres server to another (e.g. Azure -> Neon).
Needs only Docker: pg_dump / pg_restore / psql run from the official postgres image.

  pwsh scripts/copy_database.ps1

You are asked for both connection URLs (typed, not echoed, never written to disk).
For Neon use the DIRECT host (without "-pooler") for the copy, with ?sslmode=require.
Stop the app first so nothing is written to the old database during the copy.

Steps: dump the source to a local backup file, restore it into the (empty) target
in one transaction, then compare the row count of every table on both sides.
#>
param(
    # Must be >= the source server's major version.
    [string]$PostgresImage = "postgres:17",
    [string]$BackupDir = (Join-Path $HOME "bugmind-db-backup")
)

$ErrorActionPreference = "Stop"

# URLs are passed to containers by name (-e VAR), so they never appear on a command line.
function Invoke-Pg([string]$script) {
    docker run --rm -e SRC_URL -e DST_URL -e COUNT_SQL -v "${BackupDir}:/backup" $PostgresImage sh -c $script
    if ($LASTEXITCODE -ne 0) { throw "Step failed (exit $LASTEXITCODE)." }
}

try {
    if (-not $env:SRC_URL) { $env:SRC_URL = Read-Host "Source database URL (old, e.g. Azure)" -MaskInput }
    if (-not $env:DST_URL) { $env:DST_URL = Read-Host "Target database URL (new, e.g. Neon direct host)" -MaskInput }
    if (-not $env:SRC_URL -or -not $env:DST_URL) { throw "Both URLs are required." }
    if ($env:SRC_URL -eq $env:DST_URL) { throw "Source and target are the same database." }

    New-Item -ItemType Directory -Force $BackupDir | Out-Null
    $file = "bugmind-$(Get-Date -Format yyyyMMdd-HHmmss).dump"

    Write-Host "`n1/3 Dumping the source database to $BackupDir\$file ..."
    Invoke-Pg "pg_dump --format=custom --no-owner --no-privileges --file=/backup/$file `"`$SRC_URL`""

    Write-Host "`n2/3 Restoring into the target ..."
    # All or nothing: on any error the target is left untouched. Owners and grants are
    # skipped because database roles differ between providers.
    Invoke-Pg "pg_restore --no-owner --no-privileges --single-transaction --exit-on-error --dbname=`"`$DST_URL`" /backup/$file"

    Write-Host "`n3/3 Comparing row counts ..."
    $env:COUNT_SQL = "SELECT table_name || '=' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
    $src = Invoke-Pg 'psql "$SRC_URL" -At -c "$COUNT_SQL"'
    $dst = Invoke-Pg 'psql "$DST_URL" -At -c "$COUNT_SQL"'

    $src | ForEach-Object { Write-Host "  $_" }
    $diff = Compare-Object @($src) @($dst)
    if ($diff) {
        Write-Host "`nRow counts DIFFER (<= source only, => target only):" -ForegroundColor Red
        $diff | Format-Table -AutoSize
        exit 1
    }
    Write-Host "`nAll $(@($src).Count) tables match. Backup kept at $BackupDir\$file (it contains user data; keep it private)." -ForegroundColor Green
}
finally {
    Remove-Item Env:SRC_URL, Env:DST_URL, Env:COUNT_SQL -ErrorAction SilentlyContinue
}
