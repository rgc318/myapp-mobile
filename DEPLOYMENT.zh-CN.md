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

## 6. 当前建议

当前阶段建议这样使用：

- 日常测试安装：
  - 使用 `release-apk`
- 真正准备上架：
  - 再使用 `production` 产出 `aab`

这样可以把：

- 内部测试分发
- 应用商店发布

清晰分开。
