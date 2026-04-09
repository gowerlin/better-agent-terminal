Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """" & Replace(WScript.ScriptFullName, "launch-hidden.vbs", "launch.bat") & """", 0, False
