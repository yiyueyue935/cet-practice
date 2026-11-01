# 打包 Android APK

前端代码是纯静态站点，用 [Capacitor](https://capacitorjs.com/) 套一层 WebView 就能出安装包。
仓库不包含 `cap/`（Gradle 工程与构建产物体积大、且含本机签名材料），用下面的步骤在本地生成。

## 0. 准备

- Node.js ≥ 18
- JDK 17
- Android SDK（`compileSdk` 34 / `minSdk` 22 / `targetSdk` 34，Capacitor 6 的默认值即可）
- 环境变量 `ANDROID_HOME` 指向 SDK

## 1. 建 Capacitor 工程

```bash
mkdir cap && cp capacitor/* cap/ && cd cap
npm install
npx cap add android
```

`capacitor/capacitor.config.json` 里已经写好 `appId: com.guoji.cet`、`appName: 过级`、`webDir: www`。

## 2. 同步前端资源

```bash
cd ..
node scripts/sync_apk_assets.js
```

它把 `app/` 拷到 `cap/www` 与 `cap/android/app/src/main/assets/public`，
默认**跳过 `app/audio/`**（本仓库也不带录音）。

然后：

```bash
cd cap && npx cap sync android
```

## 3. 改应用信息（可选）

`cap/android/app/build.gradle` 里：

```gradle
defaultConfig {
    applicationId "com.guoji.cet"
    versionCode 1
    versionName "1.0"
    resValue "string", "app_name", "过级"
}
```

## 4. 签名

自用可以直接打 debug 包：

```bash
scripts\build_apk.bat assembleDebug        # Windows
cd cap/android && ./gradlew assembleDebug  # macOS / Linux
```

要发布就生成自己的 keystore，并写 `cap/android/keystore.properties`：

```properties
storeFile=../app/release.keystore
storePassword=你的口令
keyAlias=guoji
keyPassword=你的口令
```

`build.gradle` 里的 `signingConfigs.release` 会自动读这个文件；文件不存在时不会报错（只是不签名）。

```bash
scripts\build_apk.bat assembleRelease
# 产物：cap/android/app/build/outputs/apk/release/app-release.apk
```

> **keystore 与口令务必备份**。丢了就无法覆盖升级，只能换包名重新发。

## 5. 关于录音

仓库默认不内置听力录音，听力用系统 TTS 朗读题干与选项（APK 约 9MB）。

要内置录音：

1. 把音频放到 `app/audio/<setId>.mp3`
2. 在 `app/data/exam/audio.js` 里补 `"<setId>": "audio/<setId>.mp3"`
3. `node scripts/sync_apk_assets.js --with-audio`

音频版权请自行确认 —— 考试录音通常不允许再分发。

## 常见问题

**`%TEMP%` 不可写导致 Gradle 失败**：把 `GRADLE_USER_HOME`、`TMP`、`TEMP` 指到项目内的可写目录，
`scripts/build_apk.bat` 已经做了这件事（指向 `.workbuddy/`），可以照着改。

**中文路径导致 `ld.exe: cannot open output file`**：ESP32/NDK 之类工具链对非 ASCII 路径不友好，
把工程放到纯英文路径下再构建。

**WebView 里 TTS 不出声**：见 README「语音朗读」一节；确认系统装了英语语音包。
