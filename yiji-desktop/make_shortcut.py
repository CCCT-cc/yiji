import os
from win32com.shell import shell, shellcon
from win32com.client import Dispatch

target = r'C:\Users\HUAWEI\WorkBuddy\2026-09-02-19-27-28\yiji-desktop\dist\一记-win32-x64\一记.exe'
workdir = r'C:\Users\HUAWEI\WorkBuddy\2026-09-02-19-27-28\yiji-desktop\dist\一记-win32-x64'
lnk = r'C:\Users\HUAWEI\Desktop\一记.lnk'

shortcut = Dispatch('WScript.Shell').CreateShortcut(lnk)
shortcut.TargetPath = target
shortcut.WorkingDirectory = workdir
shortcut.Description = '一记 · 极简记账'
shortcut.IconLocation = target + ',0'
shortcut.Save()

print('SHORTCUT_CREATED', os.path.exists(lnk))
print('SIZE', os.path.getsize(lnk))
