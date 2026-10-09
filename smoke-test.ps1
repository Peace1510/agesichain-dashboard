# smoke-test.ps1 — Level 2 API smoke tests
# Run: powershell -ExecutionPolicy Bypass -File smoke-test.ps1

$base = "http://localhost:3001"

Write-Host "`n=== 1. GET /api/telemetry (empty store) ===" -ForegroundColor Cyan
$r = Invoke-RestMethod -Uri "$base/api/telemetry" -Method GET
$r | ConvertTo-Json -Depth 10
Write-Host "snapshot is null: $($r.snapshot -eq $null)"
Write-Host "meta.id: $($r.meta.id)"

Write-Host "`n=== 2. POST /api/telemetry (single real reading) ===" -ForegroundColor Cyan
$body1 = @{
    device_id   = "ESP32_COLDCHAIN_01"
    timestamp   = 1728480711
    temperature = 5.4
    humidity    = 45.2
    latitude    = 18.52043
    longitude   = 73.85674
    speed_kmh   = 32.0
} | ConvertTo-Json
$r2 = Invoke-RestMethod -Uri "$base/api/telemetry" -Method POST `
        -Body $body1 -ContentType "application/json"
$r2 | ConvertTo-Json -Depth 10
Write-Host "success: $($r2.success)"
Write-Host "status: $($r2.snapshot)"

Write-Host "`n=== 3. POST /api/simulate HEAT_SPIKE ===" -ForegroundColor Yellow
$body3 = '{"type":"HEAT_SPIKE"}' 
$r3 = Invoke-RestMethod -Uri "$base/api/simulate" -Method POST `
        -Body $body3 -ContentType "application/json"
$r3 | ConvertTo-Json -Depth 10
Write-Host "type:    $($r3.type)"
Write-Host "message: $($r3.message)"
if ($r3.snapshot) {
    Write-Host "status:  $($r3.snapshot.evaluation.status)"
    Write-Host "viability: $($r3.snapshot.cumulative_viability)"
    Write-Host "t_spoil:   $($r3.snapshot.time_to_spoil_hours) hr"
}

Write-Host "`n=== 4. GET /api/simulate (discovery) ===" -ForegroundColor Cyan
$r4 = Invoke-RestMethod -Uri "$base/api/simulate" -Method GET
$r4 | ConvertTo-Json -Depth 5

Write-Host "`n=== 5. POST /api/simulate NORMALIZE ===" -ForegroundColor Green
$body5 = '{"type":"NORMALIZE"}'
$r5 = Invoke-RestMethod -Uri "$base/api/simulate" -Method POST `
        -Body $body5 -ContentType "application/json"
Write-Host "message: $($r5.message)"
if ($r5.snapshot) {
    Write-Host "status:  $($r5.snapshot.evaluation.status)"
}

Write-Host "`n=== 6. POST /api/simulate RESET ===" -ForegroundColor Magenta
$body6 = '{"type":"RESET"}'
$r6 = Invoke-RestMethod -Uri "$base/api/simulate" -Method POST `
        -Body $body6 -ContentType "application/json"
Write-Host "message: $($r6.message)"
Write-Host "snapshot after reset: $($r6.snapshot)"

Write-Host "`n=== 7. GET /api/telemetry (after reset) ===" -ForegroundColor Cyan
$r7 = Invoke-RestMethod -Uri "$base/api/telemetry" -Method GET
Write-Host "history count: $($r7.history.Count)"
Write-Host "snapshot: $($r7.snapshot)"

Write-Host "`n=== 8. POST /api/telemetry (invalid body - missing device_id) ===" -ForegroundColor Red
try {
    $body8 = '{"timestamp":1728480711,"temperature":5.4}'
    $r8 = Invoke-RestMethod -Uri "$base/api/telemetry" -Method POST `
            -Body $body8 -ContentType "application/json"
} catch {
    $errBody = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "Expected 422 error:"
    $errBody | ConvertTo-Json
}

Write-Host "`n=== ALL TESTS COMPLETE ===" -ForegroundColor Green
