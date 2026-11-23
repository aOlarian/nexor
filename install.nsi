Unicode true
Name "Nexor"
OutFile "nexor-install.exe"
InstallDir "$LOCALAPPDATA\Programs\Nexor"
RequestExecutionLevel user

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Nexor"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File "Nexor.exe"
  File "LICENSE"
  File "WAILS-LICENSE.txt"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\Nexor"
  CreateShortcut "$SMPROGRAMS\Nexor\Nexor.lnk" "$INSTDIR\Nexor.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NexorOSS" "DisplayName" "Nexor"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NexorOSS" "UninstallString" '"$INSTDIR\Uninstall.exe"'
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$SMPROGRAMS\Nexor\Nexor.lnk"
  RMDir "$SMPROGRAMS\Nexor"
  Delete "$INSTDIR\Nexor.exe"
  Delete "$INSTDIR\LICENSE"
  Delete "$INSTDIR\WAILS-LICENSE.txt"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NexorOSS"
SectionEnd
