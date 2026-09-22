"""预算计算工具：确定性校验分项、小计、机动金和总额。"""
import json
from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_HALF_UP
from typing import Optional

from agno.tools import Toolkit


def _money(value) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class BudgetCalculatorTool(Toolkit):
    def __init__(self):
        super().__init__(name="budget_calculator")
        self.register(self.calculate_budget)

    def calculate_budget(
        self,
        items_json: str,
        contingency_rate: float = 0.10,
        stated_total: Optional[float] = None,
        available_cash: Optional[float] = None,
        months: Optional[int] = None,
    ) -> str:
        """计算预算分项合计、机动金和最终总额，并校验声明总额。

        Args:
            items_json: JSON 对象，键为预算项目，值为金额，例如 {"住宿": 1200, "餐饮": 600}。
            contingency_rate: 机动金比例，默认 0.10，即 10%。
            stated_total: 可选，准备向用户展示的总额；工具会检查它是否等于计算结果。
            available_cash: 可选，当前可用于目标的零钱；用于计算资金缺口和完成目标后的余额。
            months: 可选，距离目标的月数；与 available_cash 一起用于计算每月最低留存额。
        """
        try:
            items = json.loads(items_json)
            if not isinstance(items, dict) or not items:
                raise ValueError("items_json 必须是包含至少一个项目的 JSON 对象")

            normalized = {}
            for name, value in items.items():
                amount = _money(value)
                if amount < 0:
                    raise ValueError(f"预算项目不能为负数：{name}")
                normalized[str(name)] = amount

            rate = Decimal(str(contingency_rate))
            if rate < 0 or rate > 1:
                raise ValueError("contingency_rate 必须在 0 到 1 之间")

            subtotal = sum(normalized.values(), Decimal("0.00"))
            contingency = (subtotal * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            total = subtotal + contingency
            stated = _money(stated_total) if stated_total is not None else None
            cash = _money(available_cash) if available_cash is not None else None
            if cash is not None and cash < 0:
                raise ValueError("available_cash 不能为负数")
            if months is not None and months <= 0:
                raise ValueError("months 必须是正整数")

            funding_gap = max(total - cash, Decimal("0.00")) if cash is not None else None
            monthly_saving = None
            if funding_gap is not None and months is not None:
                monthly_saving = (funding_gap / Decimal(months)).quantize(
                    Decimal("0.01"), rounding=ROUND_CEILING
                )

            return json.dumps({
                "success": True,
                "items": {name: float(amount) for name, amount in normalized.items()},
                "subtotal": float(subtotal),
                "contingency_rate": float(rate),
                "contingency": float(contingency),
                "total": float(total),
                "stated_total": float(stated) if stated is not None else None,
                "total_matches": stated == total if stated is not None else None,
                "available_cash": float(cash) if cash is not None else None,
                "funding_gap": float(funding_gap) if funding_gap is not None else None,
                "monthly_saving_needed": float(monthly_saving) if monthly_saving is not None else None,
                "cash_after_planned_spend": float(cash + (funding_gap or Decimal("0.00")) - subtotal) if cash is not None else None,
            }, ensure_ascii=False)
        except (json.JSONDecodeError, InvalidOperation, TypeError, ValueError) as exc:
            return json.dumps({"success": False, "message": str(exc)}, ensure_ascii=False)
