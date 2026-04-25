$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut("$env:USERPROFILE\Desktop\Schedule Widget.lnk")
$s.TargetPath = "wscript.exe"
$s.Arguments = "`"$PSScriptRoot\start.vbs`""
$s.WorkingDirectory = $PSScriptRoot
$s.Description = "Schedule Widget"
$s.Save()
Write-Host "Shortcut created on Desktop"
