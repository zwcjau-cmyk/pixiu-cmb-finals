# 平台环境变量清单

生产平台需要填写两项敏感变量：

| 变量名 | 是否必填 | 填写位置 | 用途 |
| --- | --- | --- | --- |
| `ARK_API_KEY` | 必填 | EdgeOne 后端项目的环境变量/密钥设置 | Agent 对话、图片等火山方舟能力鉴权 |
| `VOLC_ASR_API_KEY` | 语音输入必填 | EdgeOne 后端项目的环境变量/密钥设置 | 豆包语音 ASR 极速版鉴权；必须从“豆包语音”控制台获取，不能使用方舟 Key |

以下是非敏感配置，代码已经提供默认值；平台不填写也可以运行：

```text
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL_MAIN=deepseek-v4-1-flash-260910
ARK_MODEL_CHARACTER=doubao-seed-character-251128
ARK_MODEL_PRO=doubao-seed-2-0-pro-260215
ARK_MODEL_VISION=doubao-seed-2-0-pro-260215
ARK_MODEL_SEEDREAM=doubao-seedream-4-5-251128
VOLC_ASR_RESOURCE_ID=volc.bigasr.auc_turbo
VOLC_ASR_ENDPOINT=https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash
```

安全要求：

- 不要把真实密钥写进代码、`.env.example`、前端变量或上传压缩包。
- 两个 API Key 都只配置在后端平台，不能使用 `VITE_`、`PUBLIC_` 等会暴露到浏览器的前缀。
- 如果密钥曾经发到聊天、截图或公开平台，建议在火山方舟控制台轮换后再用于生产。
