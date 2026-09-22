export interface Candle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type Decision = 'buy' | 'sell' | 'hold'

export interface TradeDecision {
  round: number
  decision: Decision
  candleIndex: number
  date: string
  price: number
  positionBefore: number
  positionAfter: number
  cashAfter: number
  sharesAfter: number
  averageCostAfter: number
}

export interface PortfolioState {
  cash: number
  shares: number
  averageCost: number
  targetPosition: number
}

const money = (value: number) => Math.round(value * 100) / 100

export function executeDecision(
  state: PortfolioState,
  decision: Decision,
  executionPrice: number,
): PortfolioState {
  if (decision === 'hold') return { ...state }
  const direction = decision === 'buy' ? 0.25 : -0.25
  const targetPosition = Math.max(0, Math.min(1, state.targetPosition + direction))
  const totalAssets = state.cash + state.shares * executionPrice
  const targetMarketValue = totalAssets * targetPosition
  const currentMarketValue = state.shares * executionPrice
  const deltaValue = targetMarketValue - currentMarketValue
  const deltaShares = deltaValue / executionPrice
  const nextShares = Math.max(0, state.shares + deltaShares)
  const nextCash = Math.max(0, state.cash - deltaValue)
  let averageCost = state.averageCost

  if (deltaShares > 0) {
    averageCost = (state.shares * state.averageCost + deltaShares * executionPrice) / nextShares
  } else if (nextShares < 1e-8) {
    averageCost = 0
  }

  return {
    cash: money(nextCash),
    shares: nextShares,
    averageCost: money(averageCost),
    targetPosition,
  }
}

export function portfolioValue(state: Pick<PortfolioState, 'cash' | 'shares'>, price: number) {
  return money(state.cash + state.shares * price)
}

export function calculateMaxDrawdown(candles: Candle[], decisions: TradeDecision[]) {
  let state: Pick<PortfolioState, 'cash' | 'shares'> = { cash: 10_000, shares: 0 }
  let peak = 10_000
  let maxDrawdown = 0
  const byIndex = new Map(decisions.map(item => [item.candleIndex, item]))

  candles.forEach((candle, index) => {
    const trade = byIndex.get(index)
    if (trade) state = { cash: trade.cashAfter, shares: trade.sharesAfter }
    const value = portfolioValue(state, candle.close)
    peak = Math.max(peak, value)
    maxDrawdown = Math.min(maxDrawdown, value / peak - 1)
  })
  return maxDrawdown
}

export function buildReview(candles: Candle[], decisions: TradeDecision[]) {
  const trades = decisions.filter(item => item.decision !== 'hold')
  const averagePosition = decisions.reduce((sum, item) => sum + item.positionAfter, 0) / decisions.length
  const chased = trades.some(item => item.decision === 'buy' && item.candleIndex >= 3 && candles[item.candleIndex - 1].close / candles[item.candleIndex - 4].close - 1 > 0.05)
  const panicSold = trades.some(item => item.decision === 'sell' && item.candleIndex >= 3 && candles[item.candleIndex - 1].close / candles[item.candleIndex - 4].close - 1 < -0.05)

  let strength = '你始终保留了部分现金，没有让一次判断占满全部仓位。'
  if (!trades.length) strength = '你守住了不熟悉就不交易的边界，没有为了操作而操作。'
  else if (averagePosition <= 0.5) strength = '你的平均仓位没有超过 50%，面对未知行情仍保留了调整空间。'

  let caution = '本局没有出现特别极端的操作，下一步重点是让每次交易都有一致的理由。'
  if (!trades.length) caution = '始终空仓规避了波动，也完全没有参与行情变化。'
  else if (trades.length >= 5) caution = '买卖次数偏多，说明策略容易随短期涨跌摇摆。'
  else if (averagePosition >= 0.75) caution = '长期高仓位放大了回撤，仓位本身也需要成为决策变量。'
  else if (chased) caution = '你曾在连续上涨后加仓，可能存在追涨倾向。'
  else if (panicSold) caution = '你曾在快速下跌后卖出，可能存在恐慌离场倾向。'

  return { strength, caution, action: '下一局先设定最高 50% 仓位，再观察自己是否更能承受回撤。' }
}
