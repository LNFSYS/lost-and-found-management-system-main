param(
    [Parameter(Mandatory = $true)]
    [string] $PlantUmlJar
)

$ErrorActionPreference = 'Stop'
$jar = (Resolve-Path -LiteralPath $PlantUmlJar).Path
$sources = @(Get-ChildItem -LiteralPath $PSScriptRoot -Recurse -Filter '*.puml' -File |
    Sort-Object FullName | ForEach-Object { $_.FullName })
if ($sources.Count -eq 0) { throw 'No sequence sources found' }

& java '-Djava.awt.headless=true' -jar $jar --check-syntax @sources
if ($LASTEXITCODE -ne 0) { throw 'PlantUML syntax validation failed' }
& java '-Djava.awt.headless=true' -jar $jar --png --disable-metadata @sources
if ($LASTEXITCODE -ne 0) { throw 'Sequence rendering failed' }

& node (Join-Path $PSScriptRoot 'check.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Sequence catalogue validation failed' }
