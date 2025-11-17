# Kill Node servers listening on given ports (defaults: 3000, 3001, 5050)
# Usage examples:
#   .\kill-servers.ps1
#   .\kill-servers.ps1 -Ports 3000,3001
# Via .bat wrapper:
#   double-click kill-servers.bat or run from terminal

param(
  [int[]]$Ports
)

if (-not $Ports -or $Ports.Count -eq 0) {
  $Ports = @(3000,3001,5050)
}

Write-Host ("Killing Node servers listening on ports: {0}" -f ($Ports -join ', ')) -ForegroundColor Cyan

$pids = @()
foreach ($port in $Ports) {
  $pattern = (":{0}\\s" -f $port)
  $listen = netstat -ano -p TCP | Select-String -Pattern $pattern | Where-Object { $_.Line -match "\sLISTENING\s" }
  if ($listen) {
    $pids += ($listen | ForEach-Object { ($_ -split '\\s+')[-1] })
  } else {
    Write-Host ("Port {0}: not listening" -f $port) -ForegroundColor DarkGray
  }
}

if (-not $pids -or $pids.Count -eq 0) {
  Write-Host "No listening Node processes found on target ports." -ForegroundColor Yellow
} else {
  $pids = $pids | Sort-Object -Unique
  foreach ($procId in $pids) {
    try {
      $proc = Get-Process -Id $procId -ErrorAction Stop
      if ($proc.ProcessName -match '^node(\.exe)?$') {
        Stop-Process -Id $procId -Force
        Write-Host ("Killed PID {0} ({1})" -f $procId, $proc.ProcessName) -ForegroundColor Green
      } else {
        Write-Host ("Skipping PID {0} ({1})" -f $procId, $proc.ProcessName) -ForegroundColor DarkYellow
      }
    } catch {
      Write-Host ("PID {0} not found" -f $procId) -ForegroundColor DarkGray
    }
  }
}

Start-Sleep -Milliseconds 400
foreach ($port in $Ports) {
  $pattern = (":{0}\\s" -f $port)
  $listenAfter = netstat -ano -p TCP | Select-String -Pattern $pattern | Where-Object { $_.Line -match "\sLISTENING\s" }
  if ($listenAfter) {
    Write-Host ("Port {0}: STILL LISTENING" -f $port) -ForegroundColor Red
  } else {
    Write-Host ("Port {0}: CLOSED" -f $port) -ForegroundColor Green
  }
}
