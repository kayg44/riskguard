/// <reference types="node" />

import { env } from 'node:process'

const validSymbol = /^[A-Z]{1,5}$/

type AlpacaBar = {
  c?: number
  t?: string
}

type AlpacaBarsResponse = {
  bars?: AlpacaBar[]
  message?: string
}

type HistoryRange = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD'

const rangeSettings: Record<
  HistoryRange,
  { timeframe: string; lookbackDays: number }
> = {
  '1D': { timeframe: '5Min', lookbackDays: 7 },
  '1W': { timeframe: '1Hour', lookbackDays: 12 },
  '1M': { timeframe: '1Day', lookbackDays: 45 },
  '3M': { timeframe: '1Day', lookbackDays: 105 },
  '6M': { timeframe: '1Day', lookbackDays: 200 },
  YTD: { timeframe: '1Day', lookbackDays: 370 },
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') {
      return Response.json(
        { error: 'Method not allowed.' },
        { status: 405 },
      )
    }

    const requestUrl = new URL(request.url)

    const symbol = (requestUrl.searchParams.get('symbol') ?? '')
      .trim()
      .toUpperCase()

    const range = (
      requestUrl.searchParams.get('range') ?? '1M'
    ).toUpperCase() as HistoryRange

    if (!validSymbol.test(symbol)) {
      return Response.json(
        { error: 'Enter a valid stock symbol.' },
        { status: 400 },
      )
    }

    if (!(range in rangeSettings)) {
      return Response.json(
        { error: 'Choose a valid chart range.' },
        { status: 400 },
      )
    }

    const apiKey = env.ALPACA_API_KEY_ID
    const apiSecret = env.ALPACA_API_SECRET_KEY

    if (!apiKey || !apiSecret) {
      return Response.json(
        { error: 'Market-data credentials are not configured.' },
        { status: 500 },
      )
    }

    const startDate = new Date()

    if (range === 'YTD') {
      startDate.setUTCMonth(0, 1)
      startDate.setUTCHours(0, 0, 0, 0)
    } else {
      startDate.setUTCDate(
        startDate.getUTCDate() - rangeSettings[range].lookbackDays,
      )
    }

    const params = new URLSearchParams({
      timeframe: rangeSettings[range].timeframe,
      start: startDate.toISOString(),
      limit: '1000',
      adjustment: 'raw',
      feed: 'iex',
      sort: 'asc',
    })

    try {
      const alpacaResponse = await fetch(
        `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars?${params}`,
        {
          headers: {
            'APCA-API-KEY-ID': apiKey,
            'APCA-API-SECRET-KEY': apiSecret,
          },
        },
      )

      const data = (await alpacaResponse.json()) as AlpacaBarsResponse

      if (!alpacaResponse.ok) {
        return Response.json(
          {
            error: data.message ?? 'Unable to retrieve price history.',
          },
          {
            status: alpacaResponse.status,
          },
        )
      }

      const normalizedBars = (data.bars ?? [])
        .filter(
          (bar): bar is Required<Pick<AlpacaBar, 'c' | 't'>> =>
            typeof bar.c === 'number' && typeof bar.t === 'string',
        )
        .map((bar) => ({
          date: bar.t,
          close: bar.c,
        }))

      let bars = normalizedBars

      if (range === '1D' && normalizedBars.length > 0) {
        const latestTradingDate = normalizedBars.at(-1)?.date.slice(0, 10)
        bars = normalizedBars.filter(
          (bar) => bar.date.slice(0, 10) === latestTradingDate,
        )
      }

      if (range === '1W') {
        const latestTradingDates = new Set(
          normalizedBars
            .map((bar) => bar.date.slice(0, 10))
            .filter((date, index, dates) => dates.indexOf(date) === index)
            .slice(-5),
        )

        bars = normalizedBars.filter((bar) =>
          latestTradingDates.has(bar.date.slice(0, 10)),
        )
      }

      if (range === '1M') {
        bars = normalizedBars.slice(-22)
      }

      if (range === '3M') {
        bars = normalizedBars.slice(-66)
      }

      if (range === '6M') {
        bars = normalizedBars.slice(-132)
      }

      if (bars.length < 2) {
        return Response.json(
          {
            error: `Not enough price history was found for ${symbol}.`,
          },
          {
            status: 404,
          },
        )
      }

      return Response.json({
        symbol,
        range,
        bars,
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      })
    } catch {
      return Response.json(
        {
          error: 'The historical-data service is temporarily unavailable.',
        },
        {
          status: 502,
        },
      )
    }
  },
}
