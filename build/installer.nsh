; installer.nsh — macros NSIS personnalisees pour Findium

!macro customUnInstall
  IfFileExists "$APPDATA\Findium\findium-data\*.*" 0 findium_skip_data_dialog
  MessageBox MB_YESNO|MB_ICONEXCLAMATION "Vos enquetes chiffrees sont stockees dans :$\r$\n$APPDATA\Findium\findium-data$\r$\n$\r$\nSauvegardez ce dossier sur un autre support si vous voulez les conserver.$\r$\n$\r$\nSupprimer definitivement vos enquetes ?" IDNO findium_skip_data_dialog
  RMDir /r "$APPDATA\Findium\findium-data"
  findium_skip_data_dialog:
!macroend
