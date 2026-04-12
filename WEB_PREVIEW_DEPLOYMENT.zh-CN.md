# Web 预览容器部署

本文档描述 `myapp-mobile` 在测试阶段的 Web 预览部署方案。这个方案的目标不是正式上线，而是为了让测试人员和业务同学在 `develop` 更新后，快速通过浏览器查看页面和走流程，不必每次都重新安装 APK。

## 1. 方案定位

- 用途：内部测试、验收预览、接口联调
- 触发分支：`develop`
- 运行方式：独立 Docker 容器运行 `expo start --web`
- 后端依赖：连接现有 staging 后端 API
- 非目标：生产级 Web 静态站、正式移动端替代品

## 2. 整体架构

```text
develop push
  -> GitHub Actions 构建 myapp-mobile-web-preview 镜像
  -> 推送到 GHCR
  -> SSH 到 staging 服务器
  -> 更新 /srv/myapp-mobile-preview 下的容器

mobile-web-preview
  -> 暴露 8081（宿主机默认映射 38081）
  -> 浏览器访问用于测试预览
  -> 通过 EXPO_PUBLIC_API_BASE_URL 调用 staging 后端
```

## 3. 相关文件

- `Dockerfile.preview`
- `.dockerignore`
- `deploy/preview/compose.preview.yaml`
- `.github/workflows/deploy_web_preview.yml`

## 4. GitHub 仓库配置

请在 `myapp-mobile` 仓库中配置以下 Secrets / Variables。

### Secrets

- `STAGING_SSH_HOST`
- `STAGING_SSH_PORT`
- `STAGING_SSH_USER`
- `STAGING_SSH_PRIVATE_KEY`
- `GHCR_USERNAME`
- `GHCR_TOKEN`

说明：

- 预览 workflow 的“构建并推送镜像”使用 GitHub Actions 内置的 `GITHUB_TOKEN`
- 服务器侧“拉取镜像并启动容器”使用 `GHCR_USERNAME` + `GHCR_TOKEN`
- 因此 `GHCR_TOKEN` 只需具备 `read:packages`
- 如果后续 GitHub Packages 权限模型变化，优先检查仓库的 `Settings -> Actions -> General -> Workflow permissions` 是否为 `Read and write permissions`

### Variables

- `EXPO_PUBLIC_API_BASE_URL_WEB_PREVIEW`
  - 推荐值：`https://erpnext.rgcdev.top`
- `MOBILE_WEB_PREVIEW_PORT`
  - 可选，默认 `38081`

## 5. 服务器侧行为

workflow 部署时会在服务器创建或更新：

- `/srv/myapp-mobile-preview/.env`
- `/srv/myapp-mobile-preview/compose.preview.yaml`

然后执行：

```bash
docker compose --env-file .env -f compose.preview.yaml pull
docker compose --env-file .env -f compose.preview.yaml up -d
```

## 6. 访问方式

默认端口映射：

```text
宿主机 38081 -> 容器 8081
```

因此初始可通过类似地址访问：

```text
http://<server-ip>:38081
```

如果后续要接入自定义域名或反向代理，可再单独为该容器加 Nginx / Cloudflare / 隧道。

## 7. 适用与限制

适合：

- 查看最新页面布局
- 让测试人员快速体验 `develop`
- 验证普通接口和表单流程

限制：

- 这是预览容器，不是生产部署
- `expo start --web` 稳定性和缓存策略不等同于正式静态站
- 若涉及浏览器 Cookie / Session 限制，仍需结合后端域名策略处理
- 真机能力（扫码、安装更新、原生权限）仍以 APK 为准

## 8. 建议流程

1. 开发代码合入 `develop`
2. GitHub Actions 自动更新 Web 预览容器
3. 测试同学通过浏览器访问预览地址
4. 真机能力和最终体验继续通过 APK 验证
