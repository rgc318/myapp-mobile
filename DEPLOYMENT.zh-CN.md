# myapp-mobile 自动打包说明

当前 `myapp-mobile` 使用 Expo + EAS 构建。

相关文件：

- [/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/package.json](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/package.json)
- [/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app.json](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app.json)
- [/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/eas.json](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/eas.json)
- [/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/.github/workflows/build_release_apk.yml](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/.github/workflows/build_release_apk.yml)

---

## 1. 当前构建档位

现在的 Android 构建分为三类：

- `development`
  - 开发调试包
  - 产物是 `apk`
- `preview`
  - 内部测试包
  - 产物是 `apk`
- `release-apk`
  - 正式测试用的发布 APK
  - 产物是 `apk`
- `production`
  - 应用商店发布包
  - 产物是 `aab`

说明：

- `APK` 适合当前内部测试和直接安装
- `AAB` 更适合后续上架应用商店

---

## 2. 为什么不继续用 debug APK

当前 Android 原生工程中的 `release` 仍然默认使用 `debug.keystore`：

- [/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/android/app/build.gradle](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/android/app/build.gradle)

所以本地直接 `assembleRelease` 虽然能产出 release 包，但不适合作为长期正式测试发布链路。

更推荐的方式是：

- 使用 EAS 托管 Android 签名
- 由 GitHub Actions 触发远程构建
- 产出可分发的 `release-apk`

补充说明：

- `expo doctor` 不建议把 `eas-cli` 安装在项目依赖里
- 推荐使用：
  - 全局安装的 `eas-cli`
  - 或 `npx eas-cli ...`

---

## 3. GitHub Actions 触发方式

当前移动端 workflow 分为两类。

检查类 workflow：

- [/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/.github/workflows/mobile_checks.yml](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/.github/workflows/mobile_checks.yml)

触发方式：

- `develop` 分支有移动端相关变更时自动触发
- 面向 `main` 或 `develop` 的 Pull Request 自动触发
- 也支持手动触发：
  - `workflow_dispatch`

执行内容：

- 安装依赖
- 运行 `npm run lint`

发布类 workflow：

- [/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/.github/workflows/build_release_apk.yml](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/.github/workflows/build_release_apk.yml)

触发方式：

- 当移动端相关路径在 `main` 分支有变更时自动触发
- 也支持手动触发：
  - `workflow_dispatch`

执行流程：

1. checkout 仓库
2. 安装 Node.js 依赖
3. 安装 JDK 17 和 Android SDK
4. 运行 `npm run lint`
5. 从 GitHub Secrets 还原 Android release keystore
6. 执行：

```bash
cd android
./gradlew assembleRelease
```

7. 上传 APK artifact
8. 创建 GitHub Release 并上传 APK

分支约定：

- `develop` 用于日常集成检查，不自动发布 APK
- `main` 用于稳定发布，推送后会构建 release APK 并发布到 GitHub Release
- 功能开发建议从 `develop` 拉 `feature/*` 或 `fix/*` 分支，验证后再合入 `develop`
- 准备正式测试包时，再把 `develop` 合入 `main`

---

## 4. 需要的 GitHub Secrets

至少需要配置：

- `EXPO_TOKEN`

配置位置：

- 仓库 `Settings`
- `Secrets and variables`
- `Actions`

`EXPO_TOKEN` 用于让 GitHub Actions 代表你们的 Expo 账号执行 EAS 构建。

---

## 5. 第一次启用前还要准备什么

第一次启用这条自动打包链路前，建议确认：

1. `myapp-mobile` 已经绑定到正确的 Expo / EAS 项目
2. Expo 账号下已经配置好 Android credentials
3. `app.json` 里的 Android 包名正确
   - 当前是：
     - `com.anonymous.myappmobile`
4. 需要的话，再把正式应用名、图标、启动图等品牌信息整理好

---

## 5.1 后端地址配置位置

当前 mobile 连接后端的基础地址主要配置在：

- [/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/config.ts](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/config.ts)

优先级是：

1. `EXPO_PUBLIC_API_BASE_URL`
2. `lib/config.ts` 中的默认地址
3. App 设置页中的运行时覆盖值

注意：

- 打包后的 APK 不能使用 `127.0.0.1`
- 必须使用手机能够访问到的局域网 IP 或公网域名
- 如果手机浏览器能访问后端，但 App 连不上，优先检查：
  - base URL 是否写对
  - Android release 是否允许明文 HTTP

---

## 5.2 iOS 构建限制

当前 iOS 构建如果使用：

```bash
npx eas-cli build --platform ios --profile preview
```

还需要满足 Apple 开发者体系要求。

如果 EAS 报：

- `You have no team associated with your Apple account`

通常表示：

- 当前 Apple ID 没有加入 Apple Developer Team
- 或没有 Apple Developer Program 付费资格

这意味着：

- Android 可以比较自由地打测试 APK
- iOS 如果没有开发者团队，通常只能先做本地开发/模拟器调试
- 不能顺利继续走正式的云端签名与分发构建

---

## 6. Android release 连接 HTTP 后端

当前 staging 后端还是：

- `http://<局域网IP>:28080`

如果 release APK 需要直连这个 HTTP 地址，Android release 默认可能会拦截明文流量。

为了解决这个问题，当前已经在：

- [/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/android/app/src/main/AndroidManifest.xml](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/android/app/src/main/AndroidManifest.xml)

的 `<application>` 上加入：

```xml
android:usesCleartextTraffic="true"
```

这意味着：

- 当前 release APK 可以访问内网 `http://...` 后端
- 等后面后端切到 HTTPS 后，可以再考虑去掉这项放行

---

## 7. 手动打包命令

### 7.1 云端 EAS 构建 release APK

推荐命令：

```bash
npx eas-cli build --platform android --profile release-apk
```

或者如果你全局安装了 `eas-cli`：

```bash
eas build --platform android --profile release-apk
```

### 7.2 本地原生构建 release APK

如果仓库里已经有 `android/` 原生工程，可以直接：

```bash
cd android
./gradlew assembleRelease
```

注意：

- 当前本地 `assembleRelease` 仍然使用 debug keystore 的 release 配置

---

## 8. GitHub Actions 自动打包 release APK

当前仓库已经补充主仓库级 workflow：

- [/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/.github/workflows/build_release_apk.yml](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/.github/workflows/build_release_apk.yml)

这条 workflow 的目标是：

- 在 `main` 分支有 `frontend/myapp-mobile/**` 相关变更时自动构建
- 也支持手动触发 `workflow_dispatch`
- 在 GitHub Actions 中直接构建 Android `release APK`
- 构建完成后把 APK 作为 artifact 上传
- 构建完成后自动发布到 GitHub Release

当前流程不依赖 EAS 配额，更适合测试阶段高频出包。

### 8.1 需要准备的 GitHub Secrets

在仓库 `Settings -> Secrets and variables -> Actions` 中添加：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

另外建议在同一页面的 `Variables` 中添加：

- `EXPO_PUBLIC_API_BASE_URL`

说明：

- `EXPO_PUBLIC_API_BASE_URL`
  - 用于在 GitHub Actions 打包时注入移动端默认后端地址
  - 例如：
    - `http://39.104.204.79:18888`
  - 这类地址属于构建配置，更适合放在 `Variables` 而不是 `Secrets`

说明：

- `ANDROID_KEYSTORE_BASE64`
  - 是 Android release keystore 文件的 base64 编码结果
- `ANDROID_KEYSTORE_PASSWORD`
  - keystore 密码
- `ANDROID_KEY_ALIAS`
  - key alias
- `ANDROID_KEY_PASSWORD`
  - alias 对应的 key 密码

### 8.2 如何生成 release keystore

如果当前还没有正式 keystore，可以在本地执行：

```bash
keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore myapp-mobile-release.keystore \
  -alias myappmobile \
  -keyalg RSA \
  -keysize 2048 \
  -validity 3650
```

执行过程中会提示输入：

- keystore 密码
- key 密码
- 证书信息

建议：

- 把 keystore 文件保存在安全位置，不要提交到仓库
- 记录好密码和 alias
- 团队内至少保留一份安全备份，否则后续无法延续同一签名

### 8.3 如何生成 `ANDROID_KEYSTORE_BASE64`

Linux / macOS / WSL 可执行：

```bash
base64 -w 0 myapp-mobile-release.keystore > myapp-mobile-release.keystore.base64
```

如果当前环境的 `base64` 不支持 `-w`，可以改用：

```bash
base64 myapp-mobile-release.keystore | tr -d '\n' > myapp-mobile-release.keystore.base64
```

然后把生成文件中的整行内容复制到 GitHub Secret `ANDROID_KEYSTORE_BASE64`。

### 8.4 workflow 里实际会做什么

这条 workflow 会自动完成：

1. checkout 仓库
2. 安装 Node.js
3. 安装 JDK 17
4. 安装 Android SDK
5. 执行 `npm ci`
6. 执行 `npm run lint`
7. 从 `ANDROID_KEYSTORE_BASE64` 还原 `release.keystore`
8. 执行：

```bash
cd frontend/myapp-mobile/android
./gradlew assembleRelease
```

9. 上传生成的 `release APK`
10. 自动创建一个新的 GitHub Release，并把 APK 作为 release asset 上传

### 8.5 构建成功后去哪里下载 APK

构建成功后有两个下载入口。

第一种是在 GitHub Actions 对应的 workflow run 页面中找到 artifact：

- `myapp-mobile-release-apk`

第二种是在仓库的 `Releases` 页面下载本次自动发布的 release asset。

当前自动发布策略：

- 每次成功构建都会创建一个新的 release
- tag 形如：
  - `mobile-v1.0.0+build.123`
- release 名称形如：
  - `myapp-mobile v1.0.0 build 123`

如果后续移动端要做“检查更新”，更推荐读取 GitHub Releases，而不是直接读 workflow artifact。

### 8.6 当前签名配置说明

当前 Android release 构建已经支持通过 CI 参数注入签名：

- [/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/android/app/build.gradle](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/android/app/build.gradle)

逻辑是：

- 如果 GitHub Actions 提供了完整的 release keystore 参数，则使用正式签名
- 如果没有提供，则本地仍可回退到 debug 签名配置

建议：

- CI 自动打包始终使用正式 keystore
- 本地开发调试继续使用 debug keystore 即可

### 8.7 当前注意事项

- 不建议把 keystore 文件直接提交到仓库
- 不建议把密码写进 `gradle.properties`
- 如果本地需要代理下载 Gradle 依赖，请把代理配置写到用户目录下的：
  - `~/.gradle/gradle.properties`
- 不要把本机专用代理地址提交进项目，否则 GitHub Actions 中可能会因为访问 `127.0.0.1` 代理而构建失败

---

## 9. 当前建议

当前阶段建议这样使用：

- 日常测试安装：
  - 使用 `release-apk`
- 真正准备上架：
  - 再使用 `production` 产出 `aab`

这样可以把：

- 内部测试分发
- 应用商店发布

清晰分开。

---

## 10. App 内“检查更新”配置

当前移动端“检查更新”已经改成：

- 前端调用后端统一接口：
  - `myapp.api.gateway.get_mobile_release_info_v1`
- 后端再去读取 GitHub Releases

这样做的好处是：

- 前端不用直接依赖 GitHub API
- 后续如果从 GitHub Releases 切换到对象存储/CDN，前端不用改
- 私有仓库场景也更容易通过后端统一处理鉴权

### 10.1 后端需要的站点配置

至少需要在站点配置中提供：

- `myapp_mobile_release_repo`

示例：

```json
{
  "myapp_mobile_release_repo": "rgc318/myapp-mobile"
}
```

后端会默认读取：

- `https://api.github.com/repos/<owner>/<repo>/releases/latest`

### 10.2 可选配置

如果你们后面需要更细一点的控制，还可以补：

- `myapp_mobile_release_api_url`
  - 手工指定完整 Release API 地址
- `myapp_mobile_release_token`
  - 如果 Release 源是私有仓库，可用 token 让后端访问 GitHub API
- `myapp_mobile_release_asset_suffix`
  - 默认是 `.apk`
- `myapp_mobile_release_include_prerelease`
  - 是否允许读取 prerelease

### 10.3 当前版本比较规则

当前前后端会优先比较：

- `version`

也会尝试从 GitHub Release 的 tag / name 中识别：

- `build.<number>`

但要注意：

- 你们当前 App 自身的版本号还主要是 `app.json` 中的 `version`
- 如果连续发布多个相同 `version` 的测试 APK，当前 App 端暂时不能稳定识别“同版本号下的新构建”

所以现阶段建议：

- 每次准备发测试包时，同步维护 `frontend/myapp-mobile/app.json` 里的 `version`

后续如果要把“同版本多次测试构建”的更新判断做得更准，再补 Android 原生 build number 策略会更稳。

### 10.4 当前前端交互行为

当前“检查更新”页面行为已经调整为：

- 点击 `检查更新`
  - 前端调用后端接口读取最新 GitHub Release
  - 页面内会显示：
    - 当前版本
    - 最新版本
    - 发布时间
    - 更新来源
    - 更新说明
- 如果发现新版本：
  - 会直接弹出更新确认弹窗
  - 弹窗中继续展示版本差异、发布时间和更新说明
  - 点击 `立即下载` 会优先打开 release asset 的 `download_url`
  - 如果没有可用 asset 直链，再退回 release 页面
- 如果用户直接点击 `打开下载页`：
  - 当前前端会在必要时先自动执行一次版本检查
  - 拿到下载地址后再跳转

这套行为的定位是：

- 非应用商店分发场景下的 APK 测试包更新
- 不是 Android Play 商店的 In-App Update
- 也不是 App 内部静默热更新

也就是说，当前方案的目标是：

- 在 App 内完成版本检查和更新提示
- 在确认后把用户直接带到 APK 下载链接或 Release 页面

而不是：

- 在 App 内自行下载 APK 并接管安装流程

后续如果测试分发频率继续增加，可以再考虑补一层更完整的 Android 原生下载/安装体验；但当前 GitHub Release 分发阶段，这种“检查 -> 弹窗 -> 跳转下载”的方式更稳。
