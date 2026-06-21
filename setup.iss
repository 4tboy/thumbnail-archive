; ============================================================
;  Thumbnail Archive – Inno Setup Script
;  Production Level | Version 2.0.0
;  Author  : 4tboy
;  Compiler: Inno Setup 6.x
; ============================================================

; --------------- Compile-time constants ---------------------
#define MyAppName        "Thumbnail Archive"
#define MyAppVersion     "2.0.0"
#define MyAppPublisher   "4tboy"
#define MyAppURL         "https://github.com/4tboy"
#define MyAppExeName     "ThumbnailArchive.exe"
; GUID without braces — used in SetupMutex and registry keys
#define MyAppGUID        "5D00EAE6-F802-4A73-A3B9-9D67BC4E7C4F"
#define MySourceDir      "c:\Users\ak80s\Downloads\Ai work\Thumbnail downloader"

; ============================================================
[Setup]
; --- Identity & versioning ---
; AppId uses double-{{ to produce a literal { before the GUID
AppId                     = {{{#MyAppGUID}}
AppName                   = {#MyAppName}
AppVersion                = {#MyAppVersion}
AppVerName                = {#MyAppName} {#MyAppVersion}
AppPublisher              = {#MyAppPublisher}
AppPublisherURL           = {#MyAppURL}
AppSupportURL             = {#MyAppURL}
AppUpdatesURL             = {#MyAppURL}
AppCopyright              = Copyright (C) 2026 {#MyAppPublisher}

; --- Install location ---
; Installs to machine-wide Program Files folder (requires admin UAC)
DefaultDirName            = {autopf}\{#MyAppName}
DefaultGroupName          = {#MyAppName}
DisableProgramGroupPage   = yes
DirExistsWarning          = no

; "admin" = required to write to C:\Windows\System32\drivers\etc\hosts
PrivilegesRequired        = admin

; --- Output ---
OutputDir                 = {#MySourceDir}\dist
OutputBaseFilename        = ThumbnailArchiveSetup_v{#MyAppVersion}
SetupIconFile             = {#MySourceDir}\icon.ico
UninstallDisplayIcon      = {app}\icon.ico
UninstallDisplayName      = {#MyAppName} {#MyAppVersion}

; --- Compression (best ratio) ---
Compression               = lzma2
SolidCompression          = yes
LZMAUseSeparateProcess    = yes

; --- Wizard appearance ---
WizardStyle               = modern
WizardSizePercent         = 120

; --- Version info embedded in setup exe ---
VersionInfoVersion        = {#MyAppVersion}.0
VersionInfoCompany        = {#MyAppPublisher}
VersionInfoDescription    = {#MyAppName} Installer
VersionInfoProductName    = {#MyAppName}
VersionInfoProductVersion = {#MyAppVersion}

; Prevent running multiple instances of the installer
SetupMutex                = {#MyAppGUID}_SetupMutex

; ============================================================
[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

; ============================================================
[Messages]
; Customise the welcome & finish page text
WelcomeLabel1             = Welcome to {#MyAppName} {#MyAppVersion}
WelcomeLabel2             = This will set up {#MyAppName} on your computer.%n%n%n• Download YouTube & Vimeo thumbnails in full resolution%n• Runs silently — no terminal window%n%nClick Next to continue.
FinishedLabel             = {#MyAppName} has been installed.%n%nClick Finish to launch the app.

; ============================================================
[Tasks]
; Optional desktop shortcut (unchecked by default — less clutter)
Name: "desktopicon";  Description: "{cm:CreateDesktopIcon}";    GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
; Run at Windows startup (checked by default)
Name: "startupicon";  Description: "Launch {#MyAppName} when Windows starts"; GroupDescription: "Startup:"

; ============================================================
[Files]
; Main executable
Source: "{#MySourceDir}\dist\{#MyAppExeName}";  DestDir: "{app}"; Flags: ignoreversion

; Supporting launcher assets
Source: "{#MySourceDir}\icon.ico";              DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceDir}\silent.vbs";            DestDir: "{app}"; Flags: ignoreversion

; ============================================================
[Dirs]
; Pre-create a Downloads folder with full user permissions
Name: "{app}\Downloads"; Permissions: users-full

; ============================================================
[Icons]
; Start menu shortcut — launched via silent.vbs (no console window)
Name: "{group}\{#MyAppName}"; Filename: "wscript.exe"; Parameters: """{app}\silent.vbs"" ""{app}\{#MyAppExeName}"""; IconFilename: "{app}\icon.ico"; Comment: "Open {#MyAppName}"

; Desktop shortcut (only created when task is selected)
Name: "{autodesktop}\{#MyAppName}"; Filename: "wscript.exe"; Parameters: """{app}\silent.vbs"" ""{app}\{#MyAppExeName}"""; IconFilename: "{app}\icon.ico"; Comment: "Open {#MyAppName}"; Tasks: desktopicon

; Uninstall shortcut in Start menu group
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"; IconFilename: "{app}\icon.ico"

; ============================================================
[Registry]
; Store install path so the app can locate assets
Root: HKLM; Subkey: "Software\{#MyAppPublisher}\{#MyAppName}"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey

; Store installed version for diagnostics / update detection
Root: HKLM; Subkey: "Software\{#MyAppPublisher}\{#MyAppName}"; ValueType: string; ValueName: "Version"; ValueData: "{#MyAppVersion}"

; Run at startup — points directly to the exe so that Windows Startup Apps
; shows the correct "Thumbnail Archive" name and application icon.
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "{#MyAppName}"; ValueData: """{app}\{#MyAppExeName}"" --startup"; Flags: uninsdeletevalue; Tasks: startupicon

; ============================================================
[Run]
; Launch the app silently when the wizard finishes (user can untick)
; Uses --startup flag so the console window is immediately hidden
Filename: "{app}\{#MyAppExeName}"; Parameters: "--startup"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

; ============================================================
[UninstallRun]
; Remove the "Run on Startup" registry key that tray.js may have created
Filename: "reg"; Parameters: "delete ""HKCU\Software\Microsoft\Windows\CurrentVersion\Run"" /v ""Thumbnail Archive"" /f"; Flags: runhidden
Filename: "reg"; Parameters: "delete ""HKCU\Software\Microsoft\Windows\CurrentVersion\Run"" /v ""ThumbnailArchive"" /f"; Flags: runhidden

; ============================================================
[UninstallDelete]
; Remove downloads folder only if user left it empty
Type: dirifempty; Name: "{app}\Downloads"

; ============================================================
[Code]
// ---------------------------------------------------------------
//  Pascal script — runs during install and uninstall
// ---------------------------------------------------------------

// Check if same version is already installed; ask user to confirm reinstall.
function InitializeSetup(): Boolean;
var
  OldVersion: String;
  OldPath:    String;
begin
  Result := True;

  if RegQueryStringValue(HKEY_LOCAL_MACHINE,
      'Software\{#MyAppPublisher}\{#MyAppName}', 'Version', OldVersion) then
  begin
    if OldVersion = '{#MyAppVersion}' then
    begin
      if MsgBox('{#MyAppName} ' + OldVersion + ' is already installed.'
          + #13#10 + 'Would you like to reinstall it?',
          mbConfirmation, MB_YESNO) = IDNO then
      begin
        Result := False;
        Exit;
      end;
    end else begin
      RegQueryStringValue(HKEY_LOCAL_MACHINE,
          'Software\{#MyAppPublisher}\{#MyAppName}', 'InstallPath', OldPath);
      Log('Upgrading from ' + OldVersion + ' at ' + OldPath);
    end;
  end;
end;

// Clean up all registry keys and hosts file after uninstall.
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  HostsPath: string;
  HostsLines: TArrayOfString;
  I: Integer;
  NewHosts: TArrayOfString;
  NewCount: Integer;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    RegDeleteKeyIncludingSubkeys(HKEY_LOCAL_MACHINE,
        'Software\{#MyAppPublisher}\{#MyAppName}');
    Log('{#MyAppName} registry keys removed.');

    HostsPath := ExpandConstant('{sysnative}\drivers\etc\hosts');
    if LoadStringsFromFile(HostsPath, HostsLines) then
    begin
      SetArrayLength(NewHosts, GetArrayLength(HostsLines));
      NewCount := 0;
      for I := 0 to GetArrayLength(HostsLines) - 1 do
      begin
        if Pos('ta.tool', HostsLines[I]) = 0 then
        begin
          NewHosts[NewCount] := HostsLines[I];
          NewCount := NewCount + 1;
        end;
      end;
      if NewCount < GetArrayLength(HostsLines) then
      begin
        SetArrayLength(NewHosts, NewCount);
        SaveStringsToFile(HostsPath, NewHosts, False);
        Log('Removed ta.tool from hosts file.');
      end;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  HostsPath: string;
  HostsLines: TArrayOfString;
  I: Integer;
  AlreadyExists: Boolean;
begin
  if CurStep = ssPostInstall then
  begin
    HostsPath := ExpandConstant('{sysnative}\drivers\etc\hosts');
    AlreadyExists := False;
    if LoadStringsFromFile(HostsPath, HostsLines) then
    begin
      for I := 0 to GetArrayLength(HostsLines) - 1 do
      begin
        if Pos('ta.tool', HostsLines[I]) > 0 then
        begin
          AlreadyExists := True;
          Break;
        end;
      end;
      
      if not AlreadyExists then
      begin
        SetArrayLength(HostsLines, GetArrayLength(HostsLines) + 1);
        HostsLines[GetArrayLength(HostsLines) - 1] := '127.0.0.1 ta.tool';
        SaveStringsToFile(HostsPath, HostsLines, False);
        Log('Added ta.tool to hosts file.');
      end;
    end;
  end;
end;
