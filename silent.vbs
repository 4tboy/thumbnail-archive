' silent.vbs — Launches ThumbnailArchive.exe with no console window.
' Usage (called by Inno Setup icons/shortcuts):
'   wscript.exe "silent.vbs" "ThumbnailArchive.exe"
'
' WScript.Arguments(0) = full path to ThumbnailArchive.exe
' The second argument 0 in shell.Run = SW_HIDE (no window)
' The third argument False = do not wait for the process to finish

Option Explicit

Dim shell, exePath

If WScript.Arguments.Count = 0 Then
    WScript.Quit 1
End If

exePath = WScript.Arguments(0)

Set shell = CreateObject("WScript.Shell")
shell.Run """" & exePath & """", 0, False

Set shell = Nothing
