$ErrorActionPreference = 'Stop'

$scripts = Split-Path -Parent $MyInvocation.MyCommand.Path
$project = Get-Location
$node = 'D:\Program Files\nodejs\node.exe'
$script = Join-Path $scripts 'schedule-batch.js'
$logDir = Join-Path $project '.kuaishou-publisher\logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$logOut = Join-Path $logDir 'rolling-task.stdout.log'
$logErr = Join-Path $logDir 'rolling-task.stderr.log'

Get-ScheduledTask -TaskName 'KuaishouAutoPublisher-*' -ErrorAction SilentlyContinue |
  Unregister-ScheduledTask -Confirm:$false

$config = Join-Path $project 'kuaishou.config.json'
$command = "`$env:KUAISHOU_CONFIG='$config'; & '$node' '$script' --rolling 1>> '$logOut' 2>> '$logErr'"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -Command `"$command`""
$trigger = New-ScheduledTaskTrigger -Daily -At '00:10'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 3) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'KuaishouRollingScheduler-0010' -Action $action -Trigger $trigger -Settings $settings -Description 'Add three videos to the Kuaishou scheduled queue every day' -Force | Out-Null
Write-Host 'Registered KuaishouRollingScheduler-0010'
