# EdgeOne Makers deployment

Deploy this directory as an EdgeOne Makers project.

- Repository: `zwcjau-cmyk/pixiu-cmb-finals`
- Root directory: `pixiu-agent-web`
- Production branch: `main`
- Framework preset: `Other`
- Build command: leave empty
- Output directory: leave empty

Required secret:

```text
ARK_API_KEY=<Volcengine Ark API key>
```

Optional environment variables already have defaults in `config.py`:

```text
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL_CHARACTER=doubao-seed-character-251128
ARK_MODEL_PRO=doubao-seed-2-0-pro-260215
ARK_MODEL_VISION=doubao-seed-2-0-pro-260215
ARK_MODEL_SEEDREAM=doubao-seedream-4-5-251128
ARK_MODEL_ASR=doubao-seed-asr-1-0
```

After deployment, verify:

```text
https://<project-domain>/api/health
```

Expected response:

```json
{"status":"ok","agent":"貔貅学长"}
```

## Current persistence limitation

The adapter copies the backend to `/tmp` because the demo currently writes
SQLite, JSON and generated stickers to local files. This state can disappear
after a cold start, redeployment or instance change. Move persistent data to a
managed database/object store before treating this as production storage.
