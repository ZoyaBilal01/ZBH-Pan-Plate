$ErrorActionPreference = 'Stop'
try {
  $r = Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.20.4/win-x64/node.exe' -Method Head -UseBasicParsing -TimeoutSec 12
  Write-Output ("NET_OK status=" + $r.StatusCode)
} catch {
  Write-Output ("NET_FAIL: " + $_.Exception.Message)
}
