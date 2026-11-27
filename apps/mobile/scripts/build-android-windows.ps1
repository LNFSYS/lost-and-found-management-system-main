[CmdletBinding()]
param(
  [switch]$Emulator
)

$ErrorActionPreference = "Stop"
$mobileDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$androidDirectory = Join-Path $mobileDirectory "android"
$gradleWrapper = Join-Path $androidDirectory "gradlew.bat"

Push-Location $mobileDirectory
try {
  if (-not (Test-Path -LiteralPath $androidDirectory)) {
    & npx.cmd expo prebuild --platform android
    if ($LASTEXITCODE -ne 0) {
      throw "Expo prebuild failed with exit code $LASTEXITCODE."
    }
  }

  if (-not (Test-Path -LiteralPath $gradleWrapper)) {
    throw "Android Gradle wrapper was not generated at $gradleWrapper."
  }

  $initScriptPath = Join-Path ([IO.Path]::GetTempPath()) ("lnfs-android-{0}.gradle" -f [guid]::NewGuid().ToString("N"))
  $initScript = @'
gradle.projectsEvaluated {
    def appProject = gradle.rootProject.findProject(':app')
    def androidExtension = appProject?.extensions?.findByName('android')
    def cmakeOptions = androidExtension?.externalNativeBuild?.cmake

    if (appProject == null || cmakeOptions == null) {
        throw new GradleException('Could not find the Android app CMake configuration.')
    }

    def projectHash = Integer.toHexString(appProject.projectDir.absolutePath.toLowerCase().hashCode())
    cmakeOptions.buildStagingDirectory = new File(new File(System.getProperty('java.io.tmpdir'), 'lnfs-cmake'), projectHash)

    def cmakeArguments = androidExtension.defaultConfig.externalNativeBuild.cmake.arguments
    if (!cmakeArguments.contains('-DCMAKE_OBJECT_PATH_MAX=245')) {
        cmakeArguments.add('-DCMAKE_OBJECT_PATH_MAX=245')
    }
}
'@

  $utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
  [IO.File]::WriteAllText($initScriptPath, $initScript, $utf8WithoutBom)

  try {
    $gradleArguments = @("--init-script", $initScriptPath, "assembleDebug")
    if ($Emulator) {
      $gradleArguments += "-PreactNativeArchitectures=x86_64"
    }

    & $gradleWrapper @gradleArguments
    if ($LASTEXITCODE -ne 0) {
      throw "Android build failed with exit code $LASTEXITCODE."
    }
  } finally {
    Remove-Item -LiteralPath $initScriptPath -Force -ErrorAction SilentlyContinue
  }
} finally {
  Pop-Location
}
