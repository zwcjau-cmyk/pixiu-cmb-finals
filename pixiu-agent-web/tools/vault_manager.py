"""金库资金管理工具 - 管理零钱、定期存款、投资理财和梦想清单，按 user_id 隔离存储"""
import json
import copy
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional
from agno.tools import Toolkit

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# 使用 mock_data.py 中的完整版 DEFAULT_VAULT（含 products/transactions/principal/monthly_profit）
from data.mock_data import DEFAULT_VAULT

_CN_TZ = timezone(timedelta(hours=8))


def _get_user_vault_file(user_id: str) -> Path:
    """按 user_id 返回隔离的金库文件路径"""
    safe_id = user_id.replace("/", "_").replace("..", "_")
    return DATA_DIR / f"vault_{safe_id}.json"


def _load_vault(user_id: str = "default_user") -> dict:
    vault_file = _get_user_vault_file(user_id)
    if vault_file.exists():
        data = json.loads(vault_file.read_text(encoding="utf-8"))
        accounts = data.get("accounts", {})
        if "active_pool" in accounts:
            accounts["active_pool"]["label"] = "零钱"
        if "fixed_deposit" in accounts:
            accounts["fixed_deposit"]["label"] = "定期存款"
        if "fund_collection" in accounts:
            accounts["fund_collection"]["label"] = "投资理财"
        return data
    return copy.deepcopy(DEFAULT_VAULT)


def _save_vault(data: dict, user_id: str = "default_user"):
    vault_file = _get_user_vault_file(user_id)
    vault_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def apply_ledger_cash_flow(
    user_id: str,
    amount: float,
    flow_type: str,
    description: str = "",
    date: Optional[str] = None,
) -> dict:
    """将记账收支同步到零钱。

    支出从银行卡余额开始依次扣减，收入默认进入银行卡余额。
    如果已知活期余额不足，仅扣减可用余额并返回未匹配金额，不会制造负的存款余额。
    """
    if flow_type not in {"expense", "income"} or amount <= 0:
        return {"success": False, "message": "收支类型或金额不正确"}

    data = _load_vault(user_id)
    account = data["accounts"]["active_pool"]
    products = account.setdefault("products", [])
    requested = float(amount)
    applied = requested

    if flow_type == "expense":
        applied = min(requested, max(float(account.get("balance", 0)), 0.0))
        remaining = applied
        for product in products:
            deduction = min(float(product.get("amount", 0)), remaining)
            product["amount"] = round(float(product.get("amount", 0)) - deduction, 2)
            remaining = round(remaining - deduction, 2)
            if remaining <= 0:
                break
        signed_amount = -applied
        transaction_type = "out"
        transaction_description = f"记账支出：{description or '日常消费'}"
    else:
        if products:
            products[0]["amount"] = round(float(products[0].get("amount", 0)) + requested, 2)
        signed_amount = requested
        transaction_type = "in"
        transaction_description = f"记账收入：{description or '其他收入'}"

    account["balance"] = round(float(account.get("balance", 0)) + signed_amount, 2)
    account["principal"] = account["balance"]
    data["total_assets"] = round(sum(float(item.get("balance", 0)) for item in data["accounts"].values()), 2)
    data["monthly_net_flow"] = round(float(data.get("monthly_net_flow", 0)) + signed_amount, 2)
    month = (date or datetime.now(_CN_TZ).strftime("%Y-%m-%d"))[:7]
    history = data.setdefault("monthly_history", [])
    month_row = next((row for row in history if row.get("month") == month), None)
    if month_row is None:
        month_row = {"month": month, "income": 0.0, "expense": 0.0}
        history.append(month_row)
        history.sort(key=lambda row: row.get("month", ""))
    month_row[flow_type] = round(float(month_row.get(flow_type, 0)) + requested, 2)
    month_row.update({
        "cash": account["balance"],
        "fixed_deposit": float(data["accounts"]["fixed_deposit"]["balance"]),
        "investment": float(data["accounts"]["fund_collection"]["balance"]),
        "total_assets": data["total_assets"],
    })
    account.setdefault("transactions", []).insert(0, {
        "type": transaction_type,
        "amount": applied if flow_type == "expense" else requested,
        "date": date or datetime.now(_CN_TZ).strftime("%Y-%m-%d"),
        "description": transaction_description,
    })
    _save_vault(data, user_id)

    return {
        "success": True,
        "fully_applied": applied == requested,
        "applied_amount": applied,
        "unfunded_amount": round(requested - applied, 2),
        "new_balance": account["balance"],
        "total_assets": data["total_assets"],
    }


class VaultManagerTool(Toolkit):
    def __init__(self):
        super().__init__(name="vault_manager")
        self._current_user_id = "default_user"
        self.register(self.get_vault_status)
        self.register(self.deposit_to_account)
        self.register(self.update_goal_progress)

    def get_vault_status(self) -> str:
        """获取用户金库的整体状态，包括总资产、零钱、定期存款、投资理财的余额以及梦想清单进度。

        Returns:
            金库完整状态 JSON
        """
        data = _load_vault(self._current_user_id)
        return json.dumps(data, ensure_ascii=False)

    def deposit_to_account(self, account: str, amount: float) -> str:
        """存钱到指定账户。当用户说存了钱/转入/充值到某个账户时调用。

        Args:
            account: 账户类型，可选值：
                - "active_pool"（零钱）
                - "fixed_deposit"（定期存款）
                - "fund_collection"（投资理财）
            amount: 存入金额（正数表示存入，负数表示取出）

        Returns:
            更新结果，包含新的总资产和账户余额
        """
        user_id = self._current_user_id
        data = _load_vault(user_id)
        if account not in data.get("accounts", {}):
            return json.dumps({"success": False, "message": f"未知账户: {account}"}, ensure_ascii=False)

        data["accounts"][account]["balance"] += amount
        data["total_assets"] = sum(acc["balance"] for acc in data["accounts"].values())
        data["monthly_growth"] = data.get("monthly_growth", 0) + amount
        _save_vault(data, user_id)

        return json.dumps({
            "success": True,
            "total_assets": data["total_assets"],
            "account_label": data["accounts"][account]["label"],
            "new_balance": data["accounts"][account]["balance"],
            "message": f"{data['accounts'][account]['label']}已存入 ¥{amount}，当前余额 ¥{data['accounts'][account]['balance']:.2f}，总资产 ¥{data['total_assets']:.2f}"
        }, ensure_ascii=False)

    def update_goal_progress(self, goal_name: str, amount: float) -> str:
        """更新梦想清单中某个目标的进度。当用户说为某个目标存了钱时调用。

        Args:
            goal_name: 目标名称，如 "AirPods Pro"、"毕业旅行基金"、"新款iPad"
            amount: 本次新存入的金额

        Returns:
            更新结果，包含目标最新进度
        """
        user_id = self._current_user_id
        data = _load_vault(user_id)
        goals = data.get("goals", [])

        for goal in goals:
            if goal["name"] == goal_name:
                goal["current"] = min(goal["current"] + amount, goal["target"])
                progress = int(goal["current"] / goal["target"] * 100)
                _save_vault(data, user_id)
                return json.dumps({
                    "success": True,
                    "goal": goal,
                    "progress": progress,
                    "message": f"「{goal_name}」进度更新：¥{goal['current']:.0f}/¥{goal['target']} ({progress}%)"
                }, ensure_ascii=False)

        # 没找到，新建目标
        new_goal = {"name": goal_name, "target": amount, "current": 0, "emoji": "🎯"}
        goals.append(new_goal)
        data["goals"] = goals
        _save_vault(data, user_id)
        return json.dumps({
            "success": True,
            "goal": new_goal,
            "message": f"新目标「{goal_name}」已创建，目标金额 ¥{amount}"
        }, ensure_ascii=False)
