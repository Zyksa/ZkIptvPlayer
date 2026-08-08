!macro customHeader
  # Add VLC Option to NSIS Installer Wizard
!macroend

!macro customInstall
  # If VLC installation option is selected, download and install VLC silently
  DetailPrint "Vérification de l'installation de VLC Media Player..."
  IfFileExists "C:\Program Files\VideoLAN\VLC\vlc.exe" vlc_found vlc_not_found

  vlc_not_found:
    DetailPrint "Téléchargement recommandé de VLC Media Player..."
    inetc::get "https://get.videolan.org/vlc/3.0.21/win64/vlc-3.0.21-win64.exe" "$PLUGINSDIR\vlc_setup.exe" /END
    Pop $0
    StrCmp $0 "OK" dl_ok dl_err

  dl_ok:
    DetailPrint "Installation silencieuse de VLC Media Player..."
    ExecWait '"$PLUGINSDIR\vlc_setup.exe" /S'
    Goto vlc_done

  dl_err:
    DetailPrint "Erreur de téléchargement de VLC, suite de l'installation ZkPlayer."
    Goto vlc_done

  vlc_found:
    DetailPrint "VLC Media Player est déjà installé sur le système."

  vlc_done:
!macroend
