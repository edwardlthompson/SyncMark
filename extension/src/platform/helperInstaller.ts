import { CSHARP_HOST } from "./helperHostSource.js";

const GECKO_FALLBACK = "syncmark@edwardlthompson.github.io";

/** PowerShell body of the one-click Windows setup. Placeholders are filled by buildWindowsInstaller. */
const PS_BODY = String.raw`$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$chromeId = '__CHROME_ID__'
$geckoId = '__GECKO_ID__'
$name = 'com.syncmark.host'
function Say($text) {
  if ($env:SYNCMARK_SETUP_SILENT) { Write-Output $text } else { [void][Windows.Forms.MessageBox]::Show($text, 'SyncMark setup') }
}
try {
  $dir = Join-Path $env:LOCALAPPDATA 'SyncMark\host'
  New-Item -ItemType Directory -Force $dir | Out-Null
  $rootFile = Join-Path $dir 'root.txt'
  $root = $null
  if (Test-Path $rootFile) {
    $saved = (Get-Content $rootFile -Raw).Trim()
    if ($saved -and (Test-Path (Join-Path $saved 'space.json'))) { $root = $saved }
  }
  if (-not $root) {
    $found = @()
    $bases = @([Environment]::GetFolderPath('MyDocuments'), [Environment]::GetFolderPath('Desktop'), (Join-Path $env:USERPROFILE 'Downloads'), $env:USERPROFILE)
    foreach ($b in $bases) {
      if (-not $b -or -not (Test-Path $b)) { continue }
      if (Test-Path (Join-Path $b 'space.json')) { $found += $b }
      $found += @(Get-ChildItem $b -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'space.json') } | ForEach-Object { $_.FullName })
    }
    $found = @($found | Select-Object -Unique)
    if ($found.Count -eq 1) { $root = $found[0] }
  }
  while (-not $root) {
    $dlg = New-Object Windows.Forms.FolderBrowserDialog
    $dlg.Description = 'Choose your SyncMark data folder (the one that contains space.json).'
    $dlg.SelectedPath = [Environment]::GetFolderPath('MyDocuments')
    if ($dlg.ShowDialog() -ne 'OK') { Say 'Setup cancelled. Nothing was changed.'; exit 1 }
    if (Test-Path (Join-Path $dlg.SelectedPath 'space.json')) { $root = $dlg.SelectedPath }
    else { Say 'That folder has no space.json. Please pick the SyncMark data folder itself.' }
  }
  Get-Process SyncMarkHost -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Milliseconds 300
  $src = Join-Path $dir 'SyncMarkHost.cs'
  $exe = Join-Path $dir 'SyncMarkHost.exe'
  $cs = @'
__CSHARP__
'@
  [IO.File]::WriteAllText($src, $cs, (New-Object Text.UTF8Encoding $false))
  $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
  if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
  if (-not (Test-Path $csc)) { throw 'Windows .NET Framework 4 was not found.' }
  $out = & $csc /nologo /target:exe /optimize /out:$exe /r:System.Web.Extensions.dll $src 2>&1
  if ($LASTEXITCODE -ne 0) { throw ('Could not build the helper: ' + ($out -join ' ')) }
  [IO.File]::WriteAllText($rootFile, $root, (New-Object Text.UTF8Encoding $false))

  function Register($vendorKeys, $file) {
    foreach ($k in $vendorKeys) {
      $key = "HKCU:\Software\$k\NativeMessagingHosts\$name"
      New-Item -Path $key -Force | Out-Null
      Set-ItemProperty -Path $key -Name '(default)' -Value $file
    }
  }
  $ff = Join-Path $dir "$name.firefox.json"
  $ffJson = [ordered]@{ name = $name; description = 'SyncMark shared-folder helper'; path = $exe; type = 'stdio'; allowed_extensions = @($geckoId) }
  [IO.File]::WriteAllText($ff, ($ffJson | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))
  Register @('Mozilla') $ff
  if ($chromeId) {
    $ch = Join-Path $dir "$name.chrome.json"
    $origins = @("chrome-extension://$chromeId/")
    if (Test-Path $ch) {
      try { $origins += @((Get-Content $ch -Raw | ConvertFrom-Json).allowed_origins) } catch { }
    }
    $origins = @($origins | Where-Object { $_ } | Select-Object -Unique)
    $chJson = [ordered]@{ name = $name; description = 'SyncMark shared-folder helper'; path = $exe; type = 'stdio'; allowed_origins = $origins }
    [IO.File]::WriteAllText($ch, ($chJson | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))
    Register @('Google\Chrome', 'Microsoft\Edge', 'BraveSoftware\Brave-Browser') $ch
  }
  $nl = [Environment]::NewLine + [Environment]::NewLine
  Say ('All set! SyncMark will now sync instantly between your browsers.' + $nl + 'Shared folder: ' + $root + $nl + 'Go back to the SyncMark settings page - it connects by itself.')
} catch {
  Say ('Setup could not finish: ' + $_.Exception.Message)
  exit 1
}
`;

/** Self-contained double-click installer (.cmd wrapping PowerShell) for Windows. */
export function buildWindowsInstaller(chromeId: string, geckoId: string = GECKO_FALLBACK): string {
  const ps = PS_BODY.replace("__CHROME_ID__", chromeId)
    .replace("__GECKO_ID__", geckoId)
    .replace("__CSHARP__", () => CSHARP_HOST);
  const header = [
    "@echo off",
    "title SyncMark setup",
    "echo Setting up SyncMark instant sync, one moment...",
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText('%~f0'); $i=$t.IndexOf('#PS'+'START'); Invoke-Expression $t.Substring($i)"`,
    "exit /b %errorlevel%",
    "#PS" + "START",
  ];
  return `${header.join("\r\n")}\r\n${ps.replace(/\r?\n/g, "\r\n")}`;
}

/** Windows only: the installer fits only where csc.exe and the registry exist. */
export function isWindows(): boolean {
  return /Windows/i.test(globalThis.navigator?.userAgent ?? "");
}
