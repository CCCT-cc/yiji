' 一记 - 重建桌面快捷方式
' 双击本文件即可在桌面生成「一记.lnk」图标
Set WshShell = CreateObject("WScript.Shell")
desktop = WshShell.SpecialFolders("Desktop")
exePath = "C:\Users\HUAWEI\WorkBuddy\2026-09-02-19-27-28\yiji-desktop\dist\一记-win32-x64\一记.exe"
Set shortcut = WshShell.CreateShortcut(desktop & "\一记.lnk")
shortcut.TargetPath = exePath
shortcut.WorkingDirectory = "C:\Users\HUAWEI\WorkBuddy\2026-09-02-19-27-28\yiji-desktop\dist\一记-win32-x64"
shortcut.Description = "一记 - 个人记账"
shortcut.IconLocation = exePath & ",0"
shortcut.Save
MsgBox "已创建桌面快捷方式：一记.lnk", vbInformation, "一记"
