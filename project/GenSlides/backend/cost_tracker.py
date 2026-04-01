from models import CostInfo, ImageProvider


class CostTracker:
    # 估算成本 (基于实际 API 定价调整)
    GEMINI_COST_PER_CALL = 0.001  # 假设 $0.001/次
    MINIMAX_COST_PER_CALL = 0.01   # 假设 $0.01/次

    def __init__(self):
        self.gemini_calls: int = 0
        self.minimax_calls: int = 0

    def record_call(self, provider: ImageProvider) -> None:
        if provider == ImageProvider.GEMINI:
            self.gemini_calls += 1
        elif provider == ImageProvider.MINIMAX:
            self.minimax_calls += 1

    def get_cost_info(self) -> CostInfo:
        gemini_cost = self.gemini_calls * self.GEMINI_COST_PER_CALL
        minimax_cost = self.minimax_calls * self.MINIMAX_COST_PER_CALL
        return CostInfo(
            gemini_calls=self.gemini_calls,
            minimax_calls=self.minimax_calls,
            gemini_cost=round(gemini_cost, 6),
            minimax_cost=round(minimax_cost, 6),
            total_cost=round(gemini_cost + minimax_cost, 6)
        )

    def reset(self) -> None:
        self.gemini_calls = 0
        self.minimax_calls = 0
