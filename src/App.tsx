import { useState } from 'react'
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

  async function loadMarketPrice() {
    if (!symbol.trim()) {
      setPriceError('Enter a stock symbol first.')
      return
    }

    setIsLoadingPrice(true)
    setPriceError('')

    try {
      const response = await fetch(
        `/api/quote?symbol=${encodeURIComponent(symbol)}`,
      )

      const data = (await response.json()) as QuoteResponse

      if (!response.ok || typeof data.price !== 'number') {
        throw new Error(data.error ?? 'Unable to load the market price.')
      }

      setStockPrice(String(data.price))
      setLastUpdated(data.timestamp ?? new Date().toISOString())
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load the market price.'

      setPriceError(message)
    } finally {
      setIsLoadingPrice(false)
    }
  }

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">PRE-TRADE RISK ANALYSIS</p>
          <h1>RiskGuard</h1>
          <p>Evaluate a stock trade before adding it to your portfolio.</p>
        </div>

        <span className="simulation-badge">Simulation only</span>
      </header>

      <section className="dashboard">
        <form className="trade-form">
          <h2>Proposed trade</h2>

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

          <button
            className="price-button"
            type="button"
            onClick={loadMarketPrice}
            disabled={isLoadingPrice}
          >
            {isLoadingPrice ? 'Loading price...' : 'Load market price'}
          </button>

          {priceError && <p className="price-error">{priceError}</p>}

          {lastUpdated && (
            <p className="price-success">
              Latest available IEX trade loaded successfully.
            </p>
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
          <div className={isApproved ? 'decision approved' : 'decision rejected'}>
            <span>Risk decision</span>
            <strong>{isApproved ? 'APPROVED' : 'REJECTED'}</strong>
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
            </article>

            <article>
              <span>Portfolio concentration</span>
              <strong>{concentration.toFixed(1)}%</strong>
              <small>Limit: {concentrationLimit}%</small>
            </article>

            <article>
              <span>Maximum estimated loss</span>
              <strong>${maximumLoss.toLocaleString()}</strong>
              <small>Limit: ${lossLimit.toLocaleString()}</small>
            </article>
          </div>

          <div className="explanation">
            <h2>{symbol || 'Trade'} analysis</h2>

            <p>
              This trade would use {concentration.toFixed(1)}% of the portfolio
              and risk approximately ${maximumLoss.toLocaleString()} at the
              selected stop price.
            </p>
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
