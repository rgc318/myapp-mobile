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

新增 workflow：

- [/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/.github/workflows/build_release_apk.yml](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/.github/workflows/build_release_apk.yml)

触发方式：

- 当以下路径在 `main` 分支有变更时自动触发：
  - `frontend/myapp-mobile/**`
- 也支持手动触发：
  - `workflow_dispatch`

执行流程：

1. checkout 仓库
2. 安装 Node.js 依赖
3. 运行 `npm run lint`
4. 登录 Expo / EAS
5. 执行：

```bash
npx eas build --platform android --profile release-apk --non-interactive --wait
```

6. 输出 EAS 构建结果和下载地址

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
- 适合本地验证
- 更正式的测试发布仍建议优先走 EAS

---

## 8. 当前建议

当前阶段建议这样使用：

- 日常测试安装：
  - 使用 `release-apk`
- 真正准备上架：
  - 再使用 `production` 产出 `aab`

这样可以把：

- 内部测试分发
- 应用商店发布

清晰分开。
