@echo off
rem Build the Android APK from the Capacitor project in cap\android.
rem
rem   scripts\build_apk.bat assembleDebug
rem   scripts\build_apk.bat assembleRelease
rem
rem Java: uses %JAVA_HOME% if set, otherwise falls back to build-env\jdk17
rem (this machine keeps a portable JDK 17 there).
rem
rem Note: on machines where %TEMP% is not writable, Gradle fails with
rem "Unable to create temporary directory". GRADLE_USER_HOME / TMP / TEMP are
rem redirected into .workbuddy\ to avoid that; drop those lines if unneeded.

set "ROOT=%~dp0.."

if not defined JAVA_HOME (
  if exist "%ROOT%\build-env\jdk17\bin\java.exe" set "JAVA_HOME=%ROOT%\build-env\jdk17"
)
if not defined JAVA_HOME (
  echo JAVA_HOME is not set and build-env\jdk17 was not found.
  echo Install JDK 17 or set JAVA_HOME, then re-run.
  exit /b 1
)

if not exist "%ROOT%\cap\android" (
  echo cap\android not found. See docs\BUILD-APK.md to create the Capacitor project first.
  exit /b 1
)

if not exist "%ROOT%\.workbuddy\jtmp" mkdir "%ROOT%\.workbuddy\jtmp"
set "GRADLE_USER_HOME=%ROOT%\.workbuddy\gradle-home"
set "TMP=%ROOT%\.workbuddy\jtmp"
set "TEMP=%ROOT%\.workbuddy\jtmp"

cd /d "%ROOT%\cap\android"

rem Prefer a locally unpacked Gradle distribution (no wrapper download needed).
set "GRADLE_HOME="
for /d %%D in ("%USERPROFILE%\.gradle\wrapper\dists\gradle-8.*\*") do (
  if exist "%%D\lib" set "GRADLE_HOME=%%D"
)

if defined GRADLE_HOME (
  "%JAVA_HOME%\bin\java.exe" -Djava.io.tmpdir="%ROOT%\.workbuddy\jtmp" -cp "%GRADLE_HOME%\lib\*" org.gradle.launcher.GradleMain %*
) else (
  call gradlew.bat %*
)
