import { useEffect, useState, type PointerEvent } from 'react'
import './App.css'
import { assessTrade } from './riskEngine'

type QuoteResponse = {
  symbol?: string
  price?: number
  timestamp?: string | null
  error?: string
}

type PriceBar = {
  date: string
  close: number
}

type HistoryResponse = {
  symbol?: string
  bars?: PriceBar[]
  error?: string
}

const cleanNumberInput = (value: string) => {
  if (value === '') return '0'

  return value.replace(/^0+(?=\d)/, '')
}

const getRiskClass = (usage: number) => {
  if (usage >= 100) return 'danger'
  if (usage >= 75) return 'warning'

  return 'safe'
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

function PriceChart({
  symbol,
  bars,
}: {
  symbol: string
  bars: PriceBar[]
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const width = 900
  const height = 260
  const paddingX = 22
  const paddingY = 20

  const prices = bars.map((bar) => bar.close)
  const minimumPrice = Math.min(...prices)
  const maximumPrice = Math.max(...prices)
  const range = maximumPrice - minimumPrice || 1

  const points = bars.map((bar, index) => ({
    ...bar,
    x:
      paddingX +
      (index / Math.max(bars.length - 1, 1)) *
        (width - paddingX * 2),
    y:
      paddingY +
      ((maximumPrice - bar.close) / range) *
        (height - paddingY * 2),
  }))

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
    )
    .join(' ')

  const areaPath =
    `${linePath} ` +
    `L ${points.at(-1)?.x ?? paddingX} ${height} ` +
    `L ${paddingX} ${height} Z`

  const firstPrice = bars[0].close
  const latestPrice = bars.at(-1)?.close ?? firstPrice
  const percentageChange =
    ((latestPrice - firstPrice) / firstPrice) * 100

  const isPositive = percentageChange >= 0

  const activePoint =
    activeIndex === null ? null : points[activeIndex]

  const updateActivePoint = (
    event: PointerEvent<SVGSVGElement>,
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect()

    const relativeX = Math.max(
      0,
      Math.min(event.clientX - bounds.left, bounds.width),
    )

    const index = Math.round(
      (relativeX / bounds.width) * (bars.length - 1),
    )

    setActiveIndex(index)
  }

  return (
    <div
      className={`chart-card ${
        isPositive ? 'chart-positive' : 'chart-negative'
      }`}
    >
      <div className="chart-heading">
        <div>
          <p className="section-number">04</p>
          <h2>{symbol} Market History</h2>
          <p>Latest 30 daily closing prices</p>
        </div>

        <div className="chart-summary">
          <strong>
            {formatCurrency(activePoint?.close ?? latestPrice)}
          </strong>

          <span
            className={isPositive ? 'safe-text' : 'danger-text'}
          >
            {percentageChange >= 0 ? '+' : ''}
            {percentageChange.toFixed(2)}% this period
          </span>
        </div>
      </div>

      <div className="chart-wrap">
        <svg
          className="price-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${symbol} 30-day closing-price chart`}
          onPointerMove={updateActivePoint}
          onPointerLeave={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient
              id="chartArea"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="currentColor"
                stopOpacity="0.24"
              />

              <stop
                offset="100%"
                stopColor="currentColor"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((position) => (
            <line
              key={position}
              className="chart-grid-line"
              x1="0"
              x2={width}
              y1={height * position}
              y2={height * position}
            />
          ))}

          <path className="chart-area" d={areaPath} />

          <path className="chart-line" d={linePath} />

          {activePoint && (
            <>
              <line
                className="chart-cursor"
                x1={activePoint.x}
                x2={activePoint.x}
                y1="0"
                y2={height}
              />

              <circle
                className="chart-point"
                cx={activePoint.x}
                cy={activePoint.y}
                r="6"
              />
            </>
          )}
        </svg>

        {activePoint && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(activePoint.x / width) * 100}%`,
            }}
          >
            <strong>
              {formatCurrency(activePoint.close)}
            </strong>

            <span>
              {new Date(
                activePoint.date,
              ).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        )}
      </div>

      <div className="chart-axis">
        <span>
          {new Date(bars[0].date).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
          })}
        </span>

        <span>
          {new Date(
            bars.at(-1)?.date ?? bars[0].date,
          ).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </div>
  )
}

function App() {
  const [symbol, setSymbol] = useState('AAPL')
  const [shares, setShares] = useState('100')
  const [stockPrice, setStockPrice] = useState('230')
  const [stopPrice, setStopPrice] = useState('215')
  const [portfolioValue, setPortfolioValue] =
    useState('100000')

  const [isLoadingPrice, setIsLoadingPrice] =
    useState(false)

  const [priceError, setPriceError] = useState('')

  const [lastUpdated, setLastUpdated] = useState<
    string | null
  >(null)

  const [history, setHistory] = useState<PriceBar[]>([])

  const [isLoadingHistory, setIsLoadingHistory] =
    useState(false)

  const [historyError, setHistoryError] = useState('')

  const sharesNumber = Number(shares) || 0
  const stockPriceNumber = Number(stockPrice) || 0
  const stopPriceNumber = Number(stopPrice) || 0
  const portfolioValueNumber =
    Number(portfolioValue) || 0

  const {
    positionValue,
    concentration,
    maximumLoss,
    concentrationLimit,
    lossLimit,
    isApproved,
    warnings,
  } = assessTrade({
    shares: sharesNumber,
    stockPrice: stockPriceNumber,
    stopPrice: stopPriceNumber,
    portfolioValue: portfolioValueNumber,
  })

  const concentrationUsage =
    concentrationLimit > 0
      ? Math.min(
          (concentration / concentrationLimit) * 100,
          100,
        )
      : 0

  const lossUsage =
    lossLimit > 0
      ? Math.min((maximumLoss / lossLimit) * 100, 100)
      : 0

  const formattedUpdateTime = lastUpdated
    ? new Date(lastUpdated).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null

  useEffect(() => {
    const normalizedSymbol = symbol
      .trim()
      .toUpperCase()

    if (!/^[A-Z]{1,5}$/.test(normalizedSymbol)) {
      setIsLoadingPrice(false)
      return
    }

    const controller = new AbortController()

    const timer = window.setTimeout(async () => {
      setIsLoadingPrice(true)
      setPriceError('')

      try {
        const response = await fetch(
          `/api/quote?symbol=${encodeURIComponent(
            normalizedSymbol,
          )}`,
          {
            signal: controller.signal,
          },
        )

        const data =
          (await response.json()) as QuoteResponse

        if (
          !response.ok ||
          typeof data.price !== 'number'
        ) {
          throw new Error(
            data.error ??
              'Unable to load the market price.',
          )
        }

        setStockPrice(String(data.price))

        setLastUpdated(
          data.timestamp ?? new Date().toISOString(),
        )
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Unable to load the market price.'

        setPriceError(message)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPrice(false)
        }
      }
    }, 600)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [symbol])

  useEffect(() => {
    const normalizedSymbol = symbol
      .trim()
      .toUpperCase()

    if (!/^[A-Z]{1,5}$/.test(normalizedSymbol)) {
      setHistory([])
      setHistoryError('')
      setIsLoadingHistory(false)
      return
    }

    const controller = new AbortController()

    const timer = window.setTimeout(async () => {
      setIsLoadingHistory(true)
      setHistoryError('')

      try {
        const response = await fetch(
          `/api/history?symbol=${encodeURIComponent(
            normalizedSymbol,
          )}`,
          {
            signal: controller.signal,
          },
        )

        const data =
          (await response.json()) as HistoryResponse

        if (
          !response.ok ||
          !data.bars ||
          data.bars.length < 2
        ) {
          throw new Error(
            data.error ??
              'Unable to load price history.',
          )
        }

        setHistory(data.bars)
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        setHistory([])

        setHistoryError(
          error instanceof Error
            ? error.message
            : 'Unable to load price history.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingHistory(false)
        }
      }
    }, 700)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [symbol])

  return (
    <main>
      <header>
        <div className="brand">
          <div className="brand-mark">RG</div>

          <div>
            <p className="eyebrow">
              PRE-TRADE RISK ANALYSIS
            </p>

            <h1>RiskGuard</h1>

            <p>
              Evaluate a stock trade before adding it to
              your portfolio.
            </p>
          </div>
        </div>

        <span className="simulation-badge">
          <span className="status-dot" />
          Simulation only
        </span>
      </header>

      <section
        className="project-note"
        aria-labelledby="about-riskguard"
      >
        <span>About this project</span>

        <p id="about-riskguard">
          RiskGuard combines Alpaca IEX market data with
          portfolio concentration and loss-limit rules to
          evaluate a proposed US equity trade before it is
          placed. Enter a ticker name, quantity, stop-loss
          price, and portfolio value to see whether the
          position remains within defined risk limits.
        </p>

      </section>

      <section className="dashboard">
        <form className="trade-form">
          <div className="section-heading">
            <div>
              <p className="section-number">01</p>
              <h2>Proposed trade</h2>
            </div>

            <span>US equities</span>
          </div>

          <label>
            Ticker Name

            <input
              value={symbol}
              onChange={(event) => {
                setSymbol(
                  event.target.value.toUpperCase(),
                )

                setPriceError('')
                setLastUpdated(null)
              }}
              maxLength={5}
            />
          </label>

          <p className="price-helper">
            {isLoadingPrice
              ? 'Loading latest market price...'
              : 'Price loads automatically after you enter a ticker name.'}
          </p>

          {priceError && (
            <p className="price-error">
              {priceError}
            </p>
          )}

          {formattedUpdateTime && (
            <div className="market-status">
              <span className="status-dot" />

              <div>
                <strong>
                  IEX market data loaded
                </strong>

                <small>{formattedUpdateTime}</small>
              </div>
            </div>
          )}

          <label>
            Number of shares

            <input
              type="number"
              min="0"
              value={shares}
              onChange={(event) =>
                setShares(
                  cleanNumberInput(
                    event.target.value,
                  ),
                )
              }
            />
          </label>

          <label className="money-field">
            Current stock price

            <input
              type="text"
              inputMode="decimal"
              value={stockPrice}
              readOnly
              aria-readonly="true"
            />
          </label>

          <label className="money-field">
            Stop-loss price

            <input
              type="text"
              inputMode="decimal"
              value={stopPrice}
              onChange={(event) =>
                setStopPrice(
                  cleanNumberInput(
                    event.target.value,
                  ),
                )
              }
            />
          </label>

          <label className="money-field">
            Current portfolio value

            <input
              type="text"
              inputMode="decimal"
              value={portfolioValue}
              onChange={(event) =>
                setPortfolioValue(
                  cleanNumberInput(
                    event.target.value,
                  ),
                )
              }
            />
          </label>
        </form>

        <section className="results">
          <div className="decision-header">
            <div>
              <p className="section-number">02</p>
              <span>Risk Decision</span>
            </div>

            <strong
              className={
                isApproved
                  ? 'approved'
                  : 'rejected'
              }
            >
              {isApproved
                ? 'APPROVED'
                : 'REJECTED'}
            </strong>
          </div>

          {warnings.length > 0 && (
            <div className="warnings">
              <h2>Risk warnings</h2>

              <ul>
                {warnings.map((warning) => (
                  <li key={warning}>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="metric-grid">
            <article>
              <span>Position value</span>

              <strong>
                ${positionValue.toLocaleString()}
              </strong>

              <small>
                {sharesNumber.toLocaleString()} shares
              </small>
            </article>

            <article>
              <span>
                Portfolio concentration
              </span>

              <strong>
                {concentration.toFixed(1)}%
              </strong>

              <small>
                Limit: {concentrationLimit}%
              </small>

              <div className="risk-track">
                <span
                  className={getRiskClass(
                    concentrationUsage,
                  )}
                  style={{
                    width: `${concentrationUsage}%`,
                  }}
                />
              </div>
            </article>

            <article>
              <span>
                Maximum estimated loss
              </span>

              <strong>
                ${maximumLoss.toLocaleString()}
              </strong>

              <small>
                Limit: ${lossLimit.toLocaleString()}
              </small>

              <div className="risk-track">
                <span
                  className={getRiskClass(
                    lossUsage,
                  )}
                  style={{
                    width: `${lossUsage}%`,
                  }}
                />
              </div>
            </article>
          </div>

          <div className="explanation">
            <div>
              <p className="section-number">
                03
              </p>

              <h2>
                {symbol || 'Trade'} analysis
              </h2>
            </div>

            <p>
              This trade would use{' '}
              {concentration.toFixed(1)}% of the
              portfolio and risk approximately $
              {maximumLoss.toLocaleString()} at the
              selected stop price.
            </p>
          </div>

          <div className="rule-summary">
            <div>
              <span>Concentration rule</span>

              <strong
                className={
                  concentration <=
                  concentrationLimit
                    ? 'safe-text'
                    : 'danger-text'
                }
              >
                {concentration <=
                concentrationLimit
                  ? 'Within limit'
                  : 'Limit exceeded'}
              </strong>
            </div>

            <div>
              <span>Maximum-loss rule</span>

              <strong
                className={
                  maximumLoss <= lossLimit
                    ? 'safe-text'
                    : 'danger-text'
                }
              >
                {maximumLoss <= lossLimit
                  ? 'Within limit'
                  : 'Limit exceeded'}
              </strong>
            </div>
          </div>
        </section>
      </section>

      <section
        className="history-section"
        aria-live="polite"
      >
        {isLoadingHistory && (
          <div className="chart-state">
            <span className="chart-loader" />
            Loading {symbol} Market History...
          </div>
        )}

        {!isLoadingHistory &&
          historyError && (
            <div className="chart-state chart-state-error">
              {historyError}
            </div>
          )}

        {!isLoadingHistory &&
          !historyError &&
          history.length >= 2 && (
            <PriceChart
              symbol={symbol
                .trim()
                .toUpperCase()}
              bars={history}
            />
          )}
      </section>

      <footer>
        <span>
          Market data provided by Alpaca IEX
        </span>

        <a
          href="https://github.com/kayg44/riskguard"
          target="_blank"
          rel="noreferrer"
        >
          View source on GitHub
        </a>
      </footer>
    </main>
  )
}

export default App
