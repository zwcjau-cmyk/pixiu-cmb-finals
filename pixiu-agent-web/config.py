"""貔貅学长 Agent 配置模块"""
import os
from dotenv import load_dotenv

load_dotenv()

# API 配置
ARK_API_KEY = os.getenv("ARK_API_KEY")
ARK_BASE_URL = os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")

# 模型配置
MODEL_PRO = os.getenv("ARK_MODEL_PRO", "doubao-seed-2-0-pro-260215")
MODEL_CHARACTER = os.getenv("ARK_MODEL_CHARACTER", "doubao-seed-character-251128")
MODEL_VISION = os.getenv("ARK_MODEL_VISION", "doubao-seed-2-0-pro-260215")
MODEL_SEEDREAM = os.getenv("ARK_MODEL_SEEDREAM", "doubao-seedream-4-5-251128")
MODEL_ASR = os.getenv("ARK_MODEL_ASR", "doubao-seed-asr-1-0")

# 校验 ARK_API_KEY 是否已配置
if not ARK_API_KEY:
    raise EnvironmentError(
        "ARK_API_KEY not set. Please set the ARK_API_KEY environment variable.\n"
        "You can add it to .env file in pixiu-agent-web/ directory:\n"
        "ARK_API_KEY=your-ark-api-key\n"
        "ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3\n"
        "ARK_MODEL_CHARACTER=doubao-seed-character-251128"
    )
