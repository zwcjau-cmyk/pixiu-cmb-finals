# 貔貅学长平台上传包

本包只包含现行生产代码，不包含真实 API Key、`.env`、用户运行数据、依赖缓存或本地构建产物。

## 目录

- `pixiu-design/`：Cloudflare Pages 前端，构建命令 `bun run build`，输出目录 `dist`。
- `cloud-functions/`：EdgeOne Python 后端与 `/api` 云函数。
- `edgeone.json`：EdgeOne 配置。
- `PLATFORM_API_KEYS.md`：平台环境变量清单。

## 上线前必须配置

在后端平台的密钥设置中填写 `ARK_API_KEY`。不要把真实值写入任何代码文件。

前端不需要 API Key。前端通过 `pixiu-design/public/pixiu-env.js` 指向后端公开地址。
