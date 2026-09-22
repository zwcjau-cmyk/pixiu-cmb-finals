import { describe, expect, test } from 'bun:test'
import { calculateMaxDrawdown, executeDecision, portfolioValue, type Candle, type TradeDecision } from './tradePracticeMath'

describe('涨跌练习场计算', () => {
  test('买入和卖出按25个百分点调整仓位且不做空', () => {
    const initial = { cash: 10_000, shares: 0, averageCost: 0, targetPosition: 0 }
    const firstBuy = executeDecision(initial, 'buy', 100)
    expect(firstBuy.cash).toBe(7_500)
    expect(firstBuy.shares).toBe(25)
    expect(firstBuy.targetPosition).toBe(0.25)

    const secondBuy = executeDecision(firstBuy, 'buy', 120)
    expect(secondBuy.targetPosition).toBe(0.5)
    expect(portfolioValue(secondBuy, 120)).toBe(10_500)

    const sell = executeDecision(secondBuy, 'sell', 90)
    expect(sell.targetPosition).toBe(0.25)
    const empty = executeDecision(executeDecision(executeDecision(executeDecision(sell, 'sell', 90), 'sell', 90), 'sell', 90), 'sell', 90)
    expect(empty.targetPosition).toBe(0)
    expect(empty.shares).toBe(0)
  })

  test('观望不改变资金状态', () => {
    const state = { cash: 8_000, shares: 20, averageCost: 100, targetPosition: 0.25 }
    expect(executeDecision(state, 'hold', 110)).toEqual(state)
  })

  test('最大回撤按组合资产而非单纯股价计算', () => {
    const candles: Candle[] = [100, 120, 90].map((close, index) => ({ date: `2026-01-0${index + 1}`, open: close, high: close, low: close, close, volume: 100 }))
    const decisions: TradeDecision[] = [{ round: 1, decision: 'buy', candleIndex: 0, date: candles[0].date, price: 100, positionBefore: 0, positionAfter: 1, cashAfter: 0, sharesAfter: 100, averageCostAfter: 100 }]
    expect(calculateMaxDrawdown(candles, decisions)).toBeCloseTo(-0.25)
  })
})
