Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
electronPath = fso.BuildPath(projectDir, "node_modules\electron\dist\electron.exe")

' Close the previous widget instance so the shortcut and autostart
' always reopen a fresh copy instead of stacking Electron windows.
command = "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""$widgetPath = '" & Replace(electronPath, "'", "''") & "'; " & _
          "Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $widgetPath } | Stop-Process -Force; " & _
          "Start-Sleep -Milliseconds 500; " & _
          "Start-Process -WindowStyle Hidden -FilePath 'C:\Windows\System32\cmd.exe' -ArgumentList '/c','npm start' -WorkingDirectory '" & Replace(projectDir, "'", "''") & "'"""

shell.Run command, 0, False
