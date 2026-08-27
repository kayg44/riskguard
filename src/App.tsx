import { useEffect, useState } from 'react'
import './App.css'
import { assessTrade } from './riskEngine'

type QuoteResponse = {
  symbol?: string
  price?: number
  timestamp?: string | null
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

function App() {
  const [symbol, setSymbol] = useState('AAPL')
  const [shares, setShares] = useState('100')
  const [stockPrice, setStockPrice] = useState('230')
  const [stopPrice, setStopPrice] = useState('215')
  const [portfolioValue, setPortfolioValue] = useState('100000')

  const [isLoadingPrice, setIsLoadingPrice] = useState(false)
  const [priceError, setPriceError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const sharesNumber = Number(shares) || 0
  const stockPriceNumber = Number(stockPrice) || 0
  const stopPriceNumber = Number(stopPrice) || 0
  const portfolioValueNumber = Number(portfolioValue) || 0

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
      ? Math.min((concentration / concentrationLimit) * 100, 100)
      : 0

  const lossUsage =
    lossLimit > 0 ? Math.min((maximumLoss / lossLimit) * 100, 100) : 0

  const formattedUpdateTime = lastUpdated
    ? new Date(lastUpdated).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null

  useEffect(() => {
    const normalizedSymbol = symbol.trim().toUpperCase()

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
          `/api/quote?symbol=${encodeURIComponent(normalizedSymbol)}`,
          {
            signal: controller.signal,
          },
        )

        const data = (await response.json()) as QuoteResponse

        if (!response.ok || typeof data.price !== 'number') {
          throw new Error(data.error ?? 'Unable to load the market price.')
        }

        setStockPrice(String(data.price))
        setLastUpdated(data.timestamp ?? new Date().toISOString())
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
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

  return (
    <main>
      <header>
        <div className="brand">
          <div className="brand-mark">RG</div>

          <div>
            <p className="eyebrow">PRE-TRADE RISK ANALYSIS</p>
            <h1>RiskGuard</h1>
            <p>Evaluate a stock trade before adding it to your portfolio.</p>
          </div>
        </div>

        <span className="simulation-badge">
          <span className="status-dot" />
          Simulation only
        </span>
      </header>

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
            Stock symbol
            <input
              value={symbol}
              onChange={(event) => {
                setSymbol(event.target.value.toUpperCase())
                setPriceError('')
                setLastUpdated(null)
              }}
              maxLength={5}
            />
          </label>

          <p className="price-helper">
            {isLoadingPrice
              ? 'Loading latest market price...'
              : 'Price loads automatically after you enter a symbol.'}
          </p>

          {priceError && <p className="price-error">{priceError}</p>}

          {formattedUpdateTime && (
            <div className="market-status">
              <span className="status-dot" />

              <div>
                <strong>IEX market data loaded</strong>
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
                setShares(cleanNumberInput(event.target.value))
              }
            />
          </label>

          <label>
            Current stock price
            <input
              type="number"
              min="0"
              step="0.01"
              value={stockPrice}
              onChange={(event) =>
                setStockPrice(cleanNumberInput(event.target.value))
              }
            />
          </label>

          <label>
            Stop-loss price
            <input
              type="number"
              min="0"
              step="0.01"
              value={stopPrice}
              onChange={(event) =>
                setStopPrice(cleanNumberInput(event.target.value))
              }
            />
          </label>

          <label>
            Current portfolio value
            <input
              type="number"
              min="0"
              step="0.01"
              value={portfolioValue}
              onChange={(event) =>
                setPortfolioValue(cleanNumberInput(event.target.value))
              }
            />
          </label>
        </form>

        <section className="results">
          <div className="decision-header">
            <div>
              <p className="section-number">02</p>
              <span>Risk decision</span>
            </div>

            <strong className={isApproved ? 'approved' : 'rejected'}>
              {isApproved ? 'APPROVED' : 'REJECTED'}
            </strong>
          </div>

          {warnings.length > 0 && (
            <div className="warnings">
              <h2>Risk warnings</h2>

              <ul>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="metric-grid">
            <article>
              <span>Position value</span>
              <strong>${positionValue.toLocaleString()}</strong>
              <small>{sharesNumber.toLocaleString()} shares</small>
            </article>

            <article>
              <span>Portfolio concentration</span>
              <strong>{concentration.toFixed(1)}%</strong>
              <small>Limit: {concentrationLimit}%</small>

              <div className="risk-track">
                <span
                  className={getRiskClass(concentrationUsage)}
                  style={{ width: `${concentrationUsage}%` }}
                />
              </div>
            </article>

            <article>
              <span>Maximum estimated loss</span>
              <strong>${maximumLoss.toLocaleString()}</strong>
              <small>Limit: ${lossLimit.toLocaleString()}</small>

              <div className="risk-track">
                <span
                  className={getRiskClass(lossUsage)}
                  style={{ width: `${lossUsage}%` }}
                />
              </div>
            </article>
          </div>

          <div className="explanation">
            <div>
              <p className="section-number">03</p>
              <h2>{symbol || 'Trade'} analysis</h2>
            </div>

            <p>
              This trade would use {concentration.toFixed(1)}% of the portfolio
              and risk approximately ${maximumLoss.toLocaleString()} at the
              selected stop price.
            </p>
          </div>

          <div className="rule-summary">
            <div>
              <span>Concentration rule</span>

              <strong
                className={
                  concentration <= concentrationLimit
                    ? 'safe-text'
                    : 'danger-text'
                }
              >
                {concentration <= concentrationLimit
                  ? 'Within limit'
                  : 'Limit exceeded'}
              </strong>
            </div>

            <div>
              <span>Maximum-loss rule</span>

              <strong
                className={
                  maximumLoss <= lossLimit ? 'safe-text' : 'danger-text'
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

      <footer>
        <span>Market data provided by Alpaca IEX</span>

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
