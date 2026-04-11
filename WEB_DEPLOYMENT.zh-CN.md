# myapp-mobile Web 正式部署方案

本文档定义 `myapp-mobile` 的正式 Web 部署方案。当前结论是：

- Web 前端：Cloudflare Pages
- 后端 API：继续使用现有 `frappe_docker` / Frappe 服务
- Android APK：继续使用 GitHub Release 分发

也就是说，Web 与 APK 共用同一套业务前端代码，但走不同的分发渠道。

---

## 1. 目标定位

Web 版不是一次性的调试预览页，而是正式维护的业务前端入口。

它适合承担：

- 日常页面样式验证
- 表单与列表交互联调
- 销售、采购、报表、设置等非原生能力页面的真实验收
- `develop` 分支的高频测试

它不替代 APK 的这些能力：

- 相机 / 扫码等原生权限链路
- Android 安装包下载与安装
- 真机分享、文件、系统能力验证
- 最终发布前的原生体验确认

---

## 2. 采用方案

### 2.1 为什么选择 Cloudflare Pages

当前项目已经具备 Web 静态导出能力：

- [app.json](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app.json)
  - `web.output = "static"`
- [package.json](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/package.json)
  - `web:export = expo export --platform web`

实际验证结果也已经确认：

- 在 Node 22 环境下运行 `npx expo export --platform web`
- 可以成功导出到 [dist](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/dist)

因此当前最适合的正式方案是：

- 不为 Web 单独维护 Docker + Nginx
- 直接使用静态托管平台部署 Expo Web 导出结果
- Cloudflare Pages 负责 Web 站点分发、HTTPS、域名与缓存

### 2.2 为什么不优先使用 Web Docker

当前阶段如果再为 Web 维护一套 Docker/Nginx，会带来额外成本：

- 单独维护 Dockerfile
- 单独维护 Nginx 配置
- 单独维护镜像构建与镜像发布
- 与现有 APK / 后端部署链路形成三套前端分发模型

而当前 Web 产物本质是静态导出结果，优先使用 Cloudflare Pages 更轻、更稳、更适合高频更新。

---

## 3. 分支与环境策略

正式约定如下：

- `develop`
  - 部署到 Web staging
  - 连接 staging 后端
- `main`
  - 部署到 Web production
  - 连接 production 后端

建议最终域名形态：

- staging Web：
  - `staging-app.example.com`
- production Web：
  - `app.example.com`
- staging API：
  - `staging-api.example.com`
- production API：
  - `api.example.com`

如果暂时没有正式域名，也可以先用 Cloudflare Pages 的默认域名完成接入，再在后续切换自定义域。

---

## 4. Node 与本地构建要求

当前项目 Web 导出依赖现代 Node 运行时。

正式要求：

- Node 22

仓库内已经补充：

- [.nvmrc](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/.nvmrc)
- [package.json](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/package.json) 中的 `engines.node`

推荐本地构建步骤：

```bash
cd /home/rgc318/python-project/frappe_docker/frontend/myapp-mobile
source ~/.shell_env
nvm use
npm ci
npm run web:export
```

成功后静态产物位于：

- [dist](/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/dist)

---

## 5. Cloudflare Pages 配置

建议在 Cloudflare Pages 中建立两个项目，而不是一个项目混用多套分支逻辑。

### 5.1 staging 项目

- 项目名：`myapp-mobile-staging`
- Git 分支：`develop`
- 构建命令：
  - `npm ci && npm run web:export`
- 输出目录：
  - `dist`

### 5.2 production 项目

- 项目名：`myapp-mobile-production`
- Git 分支：`main`
- 构建命令：
  - `npm ci && npm run web:export`
- 输出目录：
  - `dist`

### 5.3 Node 版本

Cloudflare Pages 构建环境必须显式指定 Node 22。

建议在 Pages 环境变量中添加：

- `NODE_VERSION=22`

---

## 6. Web 后端地址策略

当前前端通过 `EXPO_PUBLIC_API_BASE_URL` 决定 Web 构建后的后端地址。

建议 Cloudflare Pages 按环境分别设置：

### 6.1 staging

- `EXPO_PUBLIC_API_BASE_URL=https://staging-api.example.com`

### 6.2 production

- `EXPO_PUBLIC_API_BASE_URL=https://api.example.com`

注意：

- Web 前端是静态构建，构建时环境变量会被写进产物
- 所以 staging 和 production 不能共用一份构建结果
- 必须按环境分别构建

---

## 7. 后端配合要求

Web 正式部署的关键难点不在前端静态托管，而在浏览器访问后端时的跨域与登录策略。

后端至少需要确认：

- 允许对应 Web 域名访问 API
- 正确配置 CORS
- 如果使用 Cookie / Session：
  - `Access-Control-Allow-Credentials: true`
  - `Access-Control-Allow-Origin` 不能是 `*`
  - `SameSite` / `Secure` 行为要适配 HTTPS 场景
- 浏览器环境下的 CSRF 获取流程稳定可用

如果后续发现跨域成本太高，可考虑下一阶段增加：

- Cloudflare Pages Functions
- 或在边缘层把 `/api/*` 反代到后端

但当前正式方案第一阶段不强依赖这一层，先按“前端直接请求后端 API”落地。

---

## 8. 发布流程

### 8.1 develop -> Web staging

推荐流程：

1. 开发完成后推送到 `develop`
2. Cloudflare Pages 自动构建 staging Web
3. 在浏览器中验证：
   - 登录
   - 首页
   - 销售 / 采购 / 报表 / 设置
   - 与 staging 后端接口连通性

### 8.2 main -> Web production

推荐流程：

1. `develop` 验证通过后合并到 `main`
2. Cloudflare Pages 自动构建 production Web
3. 同时保留 Android APK 的正式构建 / 发布链路

---

## 9. 当前已确认事项

目前已经确认：

- 项目可以成功导出 Web 静态构建
- 构建命令：
  - `npx expo export --platform web`
- 导出目录：
  - `dist`
- 当前执行环境如果落到系统 Node 18，会报：
  - `configs.toReversed is not a function`
- 使用 Node 22 环境后，导出可以正常完成

因此当前 Web 正式部署的阻塞点已经不是前端项目结构，而主要是：

- Cloudflare Pages 项目配置
- Web 环境变量配置
- 后端浏览器跨域 / 登录策略配置

---

## 10. 下一步实施清单

正式上线前，建议按顺序执行：

1. 在 Cloudflare Pages 创建 `staging` 与 `production` 两个项目
2. 配置 `NODE_VERSION=22`
3. 配置对应环境的 `EXPO_PUBLIC_API_BASE_URL`
4. 让 `develop` 接 staging Pages
5. 验证 Web 登录与接口访问
6. 再让 `main` 接 production Pages
7. 最后再根据需要决定是否补：
   - 自定义域名
   - Cloudflare Pages Functions 反代
   - 更多缓存策略

---

## 11. 不采用的方案

当前阶段明确不采用：

- 为 Web 单独新增 Dockerfile + Nginx 镜像
- 把 Web 部署并入 `frappe_docker` 的镜像构建链路
- 为 Web 和 APK 维护两套不同前端代码

这些方案可以在未来因运维统一需求再评估，但目前不是最优解。
