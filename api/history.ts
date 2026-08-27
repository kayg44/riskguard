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

    if (!validSymbol.test(symbol)) {
      return Response.json(
        { error: 'Enter a valid stock symbol.' },
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
    startDate.setUTCDate(startDate.getUTCDate() - 60)

    const params = new URLSearchParams({
      timeframe: '1Day',
      start: startDate.toISOString(),
      limit: '60',
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

      const bars = (data.bars ?? [])
        .filter(
          (bar): bar is Required<Pick<AlpacaBar, 'c' | 't'>> =>
            typeof bar.c === 'number' && typeof bar.t === 'string',
        )
        .slice(-30)
        .map((bar) => ({
          date: bar.t,
          close: bar.c,
        }))

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
        bars,
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
