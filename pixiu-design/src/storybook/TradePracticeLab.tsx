import { useMemo, useState } from 'react'
import { RotateCcw, TrendingDown, TrendingUp } from 'lucide-react'
import questionsJson from '../data/tradePracticeQuestions.json'
import { PaperSheet } from './StorybookPanels'
import {
  buildReview,
  calculateMaxDrawdown,
  executeDecision,
  portfolioValue,
  type Candle,
  type Decision,
  type PortfolioState,
  type TradeDecision,
} from './tradePracticeMath'

interface Question {
  id: string
  name: string
  code: string
  source: string
  candles: Candle[]
}

interface PersistedGame extends PortfolioState {
  questionId: string
  round: number
  visibleCount: number
  decisions: TradeDecision[]
  finished: boolean
}

const questions = questionsJson as Question[]
const STORAGE_KEY = 'pixiu_trade_practice_v2'
const RESULT_KEY = 'pixiu_trade_results_v2'
const INITIAL_CASH = 10_000
const INITIAL_VISIBLE = 24
const TOTAL_ROUNDS = 8
const REVEAL_PER_ROUND = 4

function chooseQuestion(exclude?: string) {
  const choices = questions.filter(item => item.id !== exclude)
  return choices[Math.floor(Math.random() * choices.length)] || questions[0]
}

function freshGame(exclude?: string): PersistedGame {
  return {
    questionId: chooseQuestion(exclude).id,
    round: 1,
    visibleCount: INITIAL_VISIBLE,
    cash: INITIAL_CASH,
    shares: 0,
    averageCost: 0,
    targetPosition: 0,
    decisions: [],
    finished: false,
  }
}

function loadGame(): PersistedGame {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as PersistedGame | null
    if (saved && questions.some(item => item.id === saved.questionId)) return saved
  } catch { /* 使用新游戏 */ }
  return freshGame()
}

function formatMoney(value: number) {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
}

export function TradePracticeLab({ onClose }: { onClose: () => void }) {
  const [game, setGame] = useState<PersistedGame>(loadGame)
  const question = questions.find(item => item.id === game.questionId) || questions[0]
  const visibleCandles = question.candles.slice(0, game.visibleCount)
  const currentPrice = visibleCandles.at(-1)?.close || 0
  const totalAssets = portfolioValue(game, currentPrice)
  const floatingProfit = game.shares * (currentPrice - game.averageCost)
  const actualPosition = totalAssets ? game.shares * currentPrice / totalAssets : 0

  function persist(next: PersistedGame) {
    setGame(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function decide(decision: Decision) {
    if (game.finished) return
    const executionIndex = game.visibleCount
    const execution = question.candles[executionIndex]
    if (!execution) return
    const nextState = executeDecision(game, decision, execution.open)
    const record: TradeDecision = {
      round: game.round,
      decision,
      candleIndex: executionIndex,
      date: execution.date,
      price: execution.open,
      positionBefore: game.targetPosition,
      positionAfter: nextState.targetPosition,
      cashAfter: nextState.cash,
      sharesAfter: nextState.shares,
      averageCostAfter: nextState.averageCost,
    }
    const finished = game.round === TOTAL_ROUNDS
    const next: PersistedGame = {
      ...game,
      ...nextState,
      round: finished ? TOTAL_ROUNDS : game.round + 1,
      visibleCount: Math.min(question.candles.length, game.visibleCount + REVEAL_PER_ROUND),
      decisions: [...game.decisions, record],
      finished,
    }
    persist(next)
    if (finished) {
      const result = { questionId: question.id, finishedAt: new Date().toISOString(), decisions: next.decisions }
      const previous = JSON.parse(localStorage.getItem(RESULT_KEY) || '[]')
      localStorage.setItem(RESULT_KEY, JSON.stringify([result, ...previous].slice(0, 10)))
    }
  }

  function restart() {
    const next = freshGame(question.id)
    persist(next)
  }

  return (
    <PaperSheet
      title={game.finished ? '本局复盘' : '涨跌练习场'}
      subtitle={game.finished ? '揭晓历史行情，复盘你的决策与仓位。' : '匿名历史行情决策游戏 · 初始虚拟资金 ¥10,000'}
      onClose={onClose}
      className="trade-practice-sheet"
    >
      {game.finished ? (
        <TradeResult question={question} game={game} onRestart={restart} />
      ) : (
        <>
          <div className="trade-status-grid">
            <span><small>轮次</small><b>{game.round}/{TOTAL_ROUNDS}</b></span>
            <span><small>现金</small><b>{formatMoney(game.cash)}</b></span>
            <span><small>持仓</small><b>{Math.round(actualPosition * 100)}%</b></span>
            <span><small>浮动收益</small><b className={floatingProfit < 0 ? 'down' : 'up'}>{formatMoney(floatingProfit)}</b></span>
          </div>
          <CandlestickChart candles={visibleCandles} decisions={game.decisions} averageCost={game.averageCost} anonymous />
          <div className="trade-execution-note">本轮决策将在下一交易日开盘价成交，并揭示后续 4 根日 K 线。</div>
          <div className="trade-actions">
            <button className="buy" disabled={game.targetPosition >= 1} onClick={() => decide('buy')}><TrendingUp />买入 25%</button>
            <button className="sell" disabled={game.targetPosition <= 0} onClick={() => decide('sell')}><TrendingDown />卖出 25%</button>
            <button onClick={() => decide('hold')}>观望</button>
          </div>
          <div className="trade-legend"><span><i className="rise" />红色＝上涨</span><span><i className="fall" />绿色＝下跌</span><span>B 买入 / S 卖出</span></div>
          <small className="risk-note">历史模拟，不构成投资建议；虚拟资金与零钱、定期存款、投资理财完全隔离。</small>
        </>
      )}
    </PaperSheet>
  )
}

function TradeResult({ question, game, onRestart }: { question: Question; game: PersistedGame; onRestart: () => void }) {
  const finalPrice = question.candles.at(-1)?.close || 0
  const endingAssets = portfolioValue(game, finalPrice)
  const userReturn = endingAssets / INITIAL_CASH - 1
  const benchmarkReturn = finalPrice / question.candles[INITIAL_VISIBLE - 1].close - 1
  const maxDrawdown = calculateMaxDrawdown(question.candles, game.decisions)
  const averagePosition = game.decisions.reduce((sum, item) => sum + item.positionAfter, 0) / game.decisions.length
  const trades = game.decisions.filter(item => item.decision !== 'hold')
  const review = buildReview(question.candles, game.decisions)

  return (
    <>
      <div className="trade-reveal">
        <small>本局标的</small><b>{question.name} · {question.code}</b>
        <span>{question.candles[0].date} 至 {question.candles.at(-1)?.date}</span>
      </div>
      <CandlestickChart candles={question.candles} decisions={game.decisions} averageCost={game.averageCost} />
      <div className="result-metrics">
        <span><small>期末资产</small><b>{formatMoney(endingAssets)}</b></span>
        <span><small>本局收益</small><b className={userReturn < 0 ? 'down' : 'up'}>{formatPercent(userReturn)}</b></span>
        <span><small>同期涨跌</small><b className={benchmarkReturn < 0 ? 'down' : 'up'}>{formatPercent(benchmarkReturn)}</b></span>
        <span><small>最大回撤</small><b className="down">{formatPercent(maxDrawdown)}</b></span>
        <span><small>交易次数</small><b>{trades.length}</b></span>
        <span><small>平均仓位</small><b>{Math.round(averagePosition * 100)}%</b></span>
      </div>
      <div className="trade-timeline">
        <h3>决策时间轴</h3>
        {game.decisions.map(item => (
          <p key={item.round} className={item.decision}>
            <b>第 {item.round} 轮 · {item.decision === 'buy' ? '买入 25%' : item.decision === 'sell' ? '卖出 25%' : '观望'}</b>
            <span>{item.date}｜{formatMoney(item.price)}｜仓位 {Math.round(item.positionBefore * 100)}%→{Math.round(item.positionAfter * 100)}%</span>
          </p>
        ))}
      </div>
      <div className="rule-review">
        <p><b>本局结果</b><span>8轮共交易 {trades.length} 次，平均仓位 {Math.round(averagePosition * 100)}%，最终收益 {formatPercent(userReturn)}，同期股票 {formatPercent(benchmarkReturn)}。</span></p>
        <p><b>做得较好</b><span>{review.strength}</span></p>
        <p><b>需要注意</b><span>{review.caution}</span></p>
        <p><b>下一局动作</b><span>{review.action}</span></p>
      </div>
      <button className="storybook-primary" onClick={onRestart}><RotateCcw size={16} />换一段行情再练一局</button>
      <small className="trade-source">数据源：{question.source}。复盘只评价本局行为，不判断真实投资能力。</small>
    </>
  )
}

function CandlestickChart({ candles, decisions, averageCost, anonymous = false }: {
  candles: Candle[]
  decisions: TradeDecision[]
  averageCost: number
  anonymous?: boolean
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const width = 340
  const height = 238
  const left = 8
  const right = 42
  const priceTop = 16
  const priceBottom = 172
  const volumeTop = 186
  const volumeBottom = 222
  const chartWidth = width - left - right
  const priceMin = Math.min(...candles.map(item => item.low))
  const priceMax = Math.max(...candles.map(item => item.high))
  const padding = (priceMax - priceMin || 1) * 0.08
  const low = priceMin - padding
  const high = priceMax + padding
  const maxVolume = Math.max(...candles.map(item => item.volume))
  const step = chartWidth / candles.length
  const bodyWidth = Math.max(2, Math.min(7, step * 0.62))
  const y = (price: number) => priceTop + (high - price) / (high - low) * (priceBottom - priceTop)
  const x = (index: number) => left + step * index + step / 2
  const selected = selectedIndex === null ? null : candles[selectedIndex]
  const current = candles.at(-1)!
  const ticks = useMemo(() => Array.from({ length: 4 }, (_, index) => high - (high - low) * index / 3), [high, low])

  function selectAt(clientX: number, target: SVGSVGElement) {
    const rect = target.getBoundingClientRect()
    const localX = (clientX - rect.left) / rect.width * width
    const index = Math.max(0, Math.min(candles.length - 1, Math.floor((localX - left) / step)))
    setSelectedIndex(index)
  }

  return (
    <div className="candlestick-wrap">
      <div className="chart-heading"><span>{anonymous ? '匿名 A 股 · 日线' : '完整历史走势'}</span><b className={current.close >= current.open ? 'up' : 'down'}>{formatMoney(current.close)}</b></div>
      {selected && <div className="ohlcv-tip"><b>{selected.date}</b><span>开 {selected.open.toFixed(2)}</span><span>高 {selected.high.toFixed(2)}</span><span>低 {selected.low.toFixed(2)}</span><span>收 {selected.close.toFixed(2)}</span><span>量 {(selected.volume / 10_000).toFixed(1)}万</span></div>}
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="日K线与成交量图" onPointerMove={event => selectAt(event.clientX, event.currentTarget)} onPointerLeave={() => setSelectedIndex(null)}>
        {ticks.map(value => <g key={value}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="chart-line" /><text x={width - right + 4} y={y(value) + 3}>{value.toFixed(2)}</text></g>)}
        <line x1={left} x2={width - right} y1={volumeTop - 6} y2={volumeTop - 6} className="chart-axis" />
        <text x={left} y={volumeTop - 9}>成交量</text>
        {candles.map((candle, index) => {
          const rise = candle.close >= candle.open
          const colorClass = rise ? 'candle-rise' : 'candle-fall'
          const top = y(Math.max(candle.open, candle.close))
          const bottom = y(Math.min(candle.open, candle.close))
          const volumeHeight = candle.volume / maxVolume * (volumeBottom - volumeTop)
          return <g key={candle.date} className={colorClass}>
            <line x1={x(index)} x2={x(index)} y1={y(candle.high)} y2={y(candle.low)} />
            <rect x={x(index) - bodyWidth / 2} y={top} width={bodyWidth} height={Math.max(1.5, bottom - top)} />
            <rect className="volume-bar" x={x(index) - bodyWidth / 2} y={volumeBottom - volumeHeight} width={bodyWidth} height={volumeHeight} />
          </g>
        })}
        {averageCost > 0 && averageCost >= low && averageCost <= high && <g className="cost-line"><line x1={left} x2={width - right} y1={y(averageCost)} y2={y(averageCost)} /><text x={left + 3} y={y(averageCost) - 3}>成本 {averageCost.toFixed(2)}</text></g>}
        <g className="current-line"><line x1={left} x2={width - right} y1={y(current.close)} y2={y(current.close)} /><text x={width - right + 4} y={y(current.close) - 3}>{((current.close / candles[0].close - 1) * 100).toFixed(1)}%</text></g>
        {decisions.filter(item => item.decision !== 'hold' && item.candleIndex < candles.length).map(item => <g key={item.round} className={`trade-marker ${item.decision}`}><circle cx={x(item.candleIndex)} cy={y(item.price)} r="7" /><text x={x(item.candleIndex)} y={y(item.price) + 3}>{item.decision === 'buy' ? 'B' : 'S'}</text></g>)}
        {[0, Math.floor((candles.length - 1) / 2), candles.length - 1].map(index => <text key={index} x={x(index)} y={height - 3} textAnchor={index === 0 ? 'start' : index === candles.length - 1 ? 'end' : 'middle'}>{candles[index].date.slice(5)}</text>)}
        {selectedIndex !== null && <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1={priceTop} y2={volumeBottom} className="crosshair" />}
      </svg>
    </div>
  )
}
