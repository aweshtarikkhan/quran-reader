param(
  [int]$PageCount = 604,
  [string]$BaseUrl = "https://raw.githubusercontent.com/QuranHub/quran-pages-images/main/kfgqpc/hafs-wasat",
  [string]$OutputDir = "assets/mushaf"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

for ($i = 1; $i -le $PageCount; $i++) {
  $dest = Join-Path $OutputDir ("{0}.jpg" -f $i)
  if (Test-Path $dest) {
    continue
  }

  $url = "$BaseUrl/$i.jpg"
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
    Write-Output "Downloaded page $i"
  }
  catch {
    Write-Warning "Failed page $i from $url"
  }
}

Write-Output "Done. Saved pages in $OutputDir"
