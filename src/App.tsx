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

type ChartRange = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD'

const chartRangeDetails: Record<
  ChartRange,
  { description: string; accessibleLabel: string }
> = {
  '1D': {
    description: '5-minute prices from the latest trading session',
    accessibleLabel: 'one day',
  },
  '1W': {
    description: 'Hourly prices across the latest five trading days',
    accessibleLabel: 'one week',
  },
  '1M': {
    description: 'Daily closing prices across the latest month',
    accessibleLabel: 'one month',
  },
  '3M': {
    description: 'Daily closing prices across the latest three months',
    accessibleLabel: 'three months',
  },
  '6M': {
    description: 'Daily closing prices across the latest six months',
    accessibleLabel: 'six months',
  },
  YTD: {
    description: 'Daily closing prices since the start of the year',
    accessibleLabel: 'year to date',
  },
}

type SecurityAsset = {
  id: string
  symbol: string
  name: string
  exchange: string
  assetClass: string
  tradable: boolean
  fractionable: boolean
  marginable: boolean
  shortable: boolean
}

type SearchResponse = {
  assets?: SecurityAsset[]
  error?: string
}

type MarketClockResponse = {
  timestamp?: string
  isOpen?: boolean
  nextOpen?: string
  nextClose?: string
  error?: string
}

type Theme = 'dark' | 'light'
type ThemePreference = Theme | 'system'

const cleanNumberInput = (value: string) => {
  const cleaned = value.replace(/,/g, '').replace(/[^\d.]/g, '')

  if (cleaned === '') return ''

  const [whole, ...decimalParts] = cleaned.split('.')
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '')

  return decimalParts.length > 0
    ? `${normalizedWhole}.${decimalParts.join('')}`
    : normalizedWhole
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

const formatMarketTime = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  }).format(new Date(value))

function PriceChart({
  symbol,
  securityName,
  bars,
  range,
  onRangeChange,
}: {
  symbol: string
  securityName: string
  bars: PriceBar[]
  range: ChartRange
  onRangeChange: (range: ChartRange) => void
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const width = 900
  const height = 260
  const paddingX = 38
  const paddingY = 24

  const prices = bars.map((bar) => bar.close)
  const minimumPrice = Math.min(...prices)
  const maximumPrice = Math.max(...prices)
  const priceRange = maximumPrice - minimumPrice || 1

  const points = bars.map((bar, index) => ({
    ...bar,
    x:
      paddingX +
      (index / Math.max(bars.length - 1, 1)) *
        (width - paddingX * 2),
    y:
      paddingY +
      ((maximumPrice - bar.close) / priceRange) *
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

  const formatPointDate = (value: string) =>
    new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      ...(range === '1D' || range === '1W'
        ? { hour: 'numeric', minute: '2-digit' }
        : { year: 'numeric' }),
    })

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
          <h2>{securityName} ({symbol}) market history</h2>
          <p>{chartRangeDetails[range].description}</p>
        </div>

        <div className="chart-controls">
          <div
            className="chart-range"
            role="group"
            aria-label="Chart time range"
          >
            {(['1D', '1W', '1M', '3M', '6M', 'YTD'] as ChartRange[]).map(
              (option) => (
                <button
                  key={option}
                  type="button"
                  className={range === option ? 'active' : ''}
                  aria-pressed={range === option}
                  onClick={() => onRangeChange(option)}
                >
                  {option}
                </button>
              ),
            )}
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
      </div>

      <div className="chart-wrap">
        <svg
          className="price-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${symbol} ${chartRangeDetails[range].accessibleLabel} price chart`}
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
            className={`chart-tooltip ${
              activeIndex === 0
                ? 'chart-tooltip-start'
                : activeIndex === points.length - 1
                  ? 'chart-tooltip-end'
                  : ''
            }`}
            style={{
              left: `${(activePoint.x / width) * 100}%`,
            }}
          >
            <strong>
              {formatCurrency(activePoint.close)}
            </strong>

            <span>{formatPointDate(activePoint.date)}</span>
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
  const [symbol, setSymbol] = useState('')
  const [shares, setShares] = useState('')
  const [stockPrice, setStockPrice] = useState('')
  const [stopPrice, setStopPrice] = useState('')
  const [portfolioValue, setPortfolioValue] = useState('')

  const [isLoadingPrice, setIsLoadingPrice] =
    useState(false)

  const [priceError, setPriceError] = useState('')

  const [lastUpdated, setLastUpdated] = useState<
    string | null
  >(null)

  const [history, setHistory] = useState<PriceBar[]>([])
  const [historyRange, setHistoryRange] =
    useState<ChartRange>('1M')

  const [isLoadingHistory, setIsLoadingHistory] =
    useState(false)

  const [historyError, setHistoryError] = useState('')
  const [suggestions, setSuggestions] = useState<SecurityAsset[]>([])
  const [selectedAsset, setSelectedAsset] = useState<SecurityAsset | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [themePreference, setThemePreference] =
    useState<ThemePreference>(() => {
      const savedTheme = window.localStorage.getItem('riskguard-theme')

      if (
        savedTheme === 'light' ||
        savedTheme === 'dark' ||
        savedTheme === 'system'
      ) {
        return savedTheme
      }

      return 'system'
    })

  const [systemTheme, setSystemTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark',
  )

  const resolvedTheme =
    themePreference === 'system' ? systemTheme : themePreference
  const [marketClock, setMarketClock] = useState<MarketClockResponse | null>(null)
  const [marketClockError, setMarketClockError] = useState('')

  const sharesNumber = Number(shares) || 0
  const stockPriceNumber = Number(stockPrice) || 0
  const stopPriceNumber = Number(stopPrice) || 0
  const portfolioValueNumber =
    Number(portfolioValue) || 0

  const isTradeReady = Boolean(
    selectedAsset &&
      sharesNumber > 0 &&
      stockPriceNumber > 0 &&
      stopPriceNumber > 0 &&
      portfolioValueNumber > 0,
  )

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

  const marketStatusText = marketClock?.isOpen
    ? `Open · Closes ${formatMarketTime(marketClock.nextClose ?? '')}`
    : marketClock?.nextOpen
      ? `Closed · Opens ${formatMarketTime(marketClock.nextOpen)}`
      : 'Checking market...'

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      '(prefers-color-scheme: light)',
    )

    const updateSystemTheme = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'light' : 'dark')
    }

    mediaQuery.addEventListener('change', updateSystemTheme)

    return () => {
      mediaQuery.removeEventListener('change', updateSystemTheme)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
    window.localStorage.setItem('riskguard-theme', themePreference)
  }, [resolvedTheme, themePreference])

  useEffect(() => {
    let isActive = true

    const loadMarketClock = async () => {
      try {
        const response = await fetch('/api/clock')
        const data = (await response.json()) as MarketClockResponse

        if (!response.ok || typeof data.isOpen !== 'boolean') {
          throw new Error(data.error ?? 'Unable to load market status.')
        }

        if (isActive) {
          setMarketClock(data)
          setMarketClockError('')
        }
      } catch (error) {
        if (isActive) {
          setMarketClockError(
            error instanceof Error
              ? error.message
              : 'Unable to load market status.',
          )
        }
      }
    }

    void loadMarketClock()
    const timer = window.setInterval(loadMarketClock, 60_000)

    return () => {
      isActive = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const normalizedSymbol = selectedAsset?.symbol ?? ''

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
  }, [selectedAsset])

  useEffect(() => {
    const query = symbol.trim()

    if (!query) {
      setSuggestions([])
      setSelectedAsset(null)
      setSearchError('')
      setIsSearching(false)
      return
    }

    const controller = new AbortController()

    const timer = window.setTimeout(async () => {
      setIsSearching(true)
      setSearchError('')

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        )
        const data = (await response.json()) as SearchResponse

        if (!response.ok || !data.assets) {
          throw new Error(data.error ?? 'Unable to search securities.')
        }

        setSuggestions(data.assets)

        const exactMatch = data.assets.find(
          (asset) => asset.symbol === query.toUpperCase(),
        )
        setSelectedAsset(exactMatch ?? null)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return

        setSuggestions([])
        setSelectedAsset(null)
        setSearchError(
          error instanceof Error ? error.message : 'Unable to search securities.',
        )
      } finally {
        if (!controller.signal.aborted) setIsSearching(false)
      }
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [symbol])

  const selectAsset = (asset: SecurityAsset) => {
    setSymbol(asset.symbol)
    setSelectedAsset(asset)
    setSuggestions([])
    setShowSuggestions(false)
    setSearchError('')
  }

  useEffect(() => {
    const normalizedSymbol = selectedAsset?.symbol ?? ''

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
          )}&range=${historyRange}`,
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
  }, [selectedAsset, historyRange])

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

            <p className="brand-statement">Know the downside before you buy.</p>

            <p className="brand-description">
              A clearer way to evaluate position risk before a trade enters your portfolio.
            </p>
          </div>
        </div>

        <div className="header-actions">
          <div
            className={`market-clock ${marketClock?.isOpen ? 'market-open' : 'market-closed'}`}
            title={marketClockError || 'Official US equity market status from Alpaca'}
            aria-live="polite"
          >
            <span className="status-dot" />

            <div>
              <strong>US market</strong>
              <span>{marketClockError ? 'Status unavailable' : marketStatusText}</span>
            </div>
          </div>

          <div className="theme-select-wrap">
            <select
              className="theme-select"
              value={themePreference}
              onChange={(event) =>
                setThemePreference(event.target.value as ThemePreference)
              }
              aria-label="Color theme"
              title="Choose color theme"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
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

      <section className="workflow-guide" aria-labelledby="workflow-title">
        <div className="workflow-intro">
          <span>Start here</span>

          <div>
            <h2 id="workflow-title">Check a trade in three steps</h2>
            <p>Enter your idea below. RiskGuard will load the market price and evaluate the risk for you.</p>
          </div>
        </div>

        <ol className="workflow-steps">
          <li>
            <strong>Find the security</strong>
            <span>Type a ticker or company name and select it.</span>
          </li>

          <li>
            <strong>Enter your trade</strong>
            <span>Add shares and the price where you would exit.</span>
          </li>

          <li>
            <strong>Review the decision</strong>
            <span>See concentration, estimated loss, and warnings.</span>
          </li>
        </ol>
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

          <div className="security-search">
            <span className="start-label">Begin here</span>

            <label>
              Search security

              <input
                value={symbol}
                placeholder="Ticker or company name"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showSuggestions && suggestions.length > 0}
                aria-controls="security-suggestions"
                autoComplete="off"
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  window.setTimeout(() => setShowSuggestions(false), 150)
                }}
                onChange={(event) => {
                  setSymbol(event.target.value.toUpperCase())
                  setSelectedAsset(null)
                  setShowSuggestions(true)
                  setPriceError('')
                  setLastUpdated(null)
                  setStockPrice('')
                  setHistory([])
                }}
                maxLength={40}
              />
            </label>

            {showSuggestions && suggestions.length > 0 && (
              <div
                id="security-suggestions"
                className="suggestion-list"
                role="listbox"
              >
                {suggestions.map((asset) => (
                  <button
                    key={asset.id || asset.symbol}
                    type="button"
                    role="option"
                    aria-selected={selectedAsset?.symbol === asset.symbol}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectAsset(asset)}
                  >
                    <strong>{asset.symbol}</strong>
                    <span>{asset.name}</span>
                    <small>{asset.exchange}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="price-helper">
            {isSearching
              ? 'Searching available US securities...'
              : isLoadingPrice
              ? 'Loading latest market price...'
              : 'Search by ticker or company name, then select a security.'}
          </p>

          {searchError && <p className="price-error">{searchError}</p>}

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

          {selectedAsset && (
            <div className="security-profile">
              <div className="security-monogram">
                {selectedAsset.symbol.slice(0, 2)}
              </div>

              <div className="security-identity">
                <strong>{selectedAsset.name}</strong>
                <span>
                  {selectedAsset.symbol} · {selectedAsset.exchange}
                </span>
              </div>

              <div className="security-tags">
                <span>{selectedAsset.tradable ? 'Tradable' : 'View only'}</span>
                <span>
                  {selectedAsset.fractionable
                    ? 'Fractional shares'
                    : 'Whole shares'}
                </span>
              </div>
            </div>
          )}

          <label>
            Number of shares

            <input
              type="number"
              min="0"
              value={shares}
              placeholder="Enter number of shares"
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
              placeholder="Loads automatically"
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
              placeholder="Enter your stop-loss price"
              onChange={(event) =>
                setStopPrice(
                  cleanNumberInput(
                    event.target.value,
                  ),
                )
              }
            />

            <small className="field-helper">
              The price where you plan to exit the trade to limit a potential loss.
            </small>
          </label>

          <label className="money-field">
            Current portfolio value

            <input
              type="text"
              inputMode="decimal"
              value={portfolioValue}
              placeholder="Enter your total portfolio value"
              onChange={(event) =>
                setPortfolioValue(
                  cleanNumberInput(
                    event.target.value,
                  ),
                )
              }
            />

            <small className="field-helper">
              The current total value of all investments in your portfolio.
            </small>
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
                !isTradeReady
                  ? 'pending'
                  : isApproved
                  ? 'approved'
                  : 'rejected'
              }
            >
              {!isTradeReady
                ? 'WAITING'
                : isApproved
                ? 'APPROVED'
                : 'REJECTED'}
            </strong>
          </div>

          {!isTradeReady ? (
            <div className="results-empty">
              <span className="results-empty-mark">RG</span>

              <div>
                <h2>Enter a proposed trade</h2>

                <p>
                  Complete the trade form on the left. Your risk decision,
                  position size, and estimated loss will appear here.
                </p>
              </div>
            </div>
          ) : (
            <>
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
                {selectedAsset
                  ? `${selectedAsset.name} (${selectedAsset.symbol}) analysis`
                  : 'Select a security to begin'}
              </h2>
            </div>

            <p>
              {selectedAsset
                ? `Based on the latest available IEX price for ${selectedAsset.name}, this trade would use ${concentration.toFixed(1)}% of the portfolio and risk approximately $${maximumLoss.toLocaleString()} at the selected stop price.`
                : 'Search for a ticker or company name and select a security to view its risk analysis.'}
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
            </>
          )}
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
              securityName={selectedAsset?.name ?? symbol.trim().toUpperCase()}
              bars={history}
              range={historyRange}
              onRangeChange={setHistoryRange}
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
