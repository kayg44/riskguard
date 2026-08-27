/// <reference types="node" />

import { env } from 'node:process'

const validSymbol = /^[A-Z]{1,5}$/

type AlpacaTradeResponse = {
  symbol?: string
  trade?: {
    p?: number
    t?: string
  }
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

    try {
      const alpacaResponse = await fetch(
        `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/trades/latest?feed=iex`,
        {
          headers: {
            'APCA-API-KEY-ID': apiKey,
            'APCA-API-SECRET-KEY': apiSecret,
          },
        },
      )

      const data = (await alpacaResponse.json()) as AlpacaTradeResponse

      if (!alpacaResponse.ok) {
        return Response.json(
          {
            error: data.message ?? 'Unable to retrieve market data.',
          },
          {
            status: alpacaResponse.status,
          },
        )
      }

      const price = data.trade?.p

      if (typeof price !== 'number') {
        return Response.json(
          {
            error: `No recent trade was found for ${symbol}.`,
          },
          {
            status: 404,
          },
        )
      }

      return Response.json({
        symbol,
        price,
        timestamp: data.trade?.t ?? null,
      })
    } catch {
      return Response.json(
        {
          error: 'The market-data service is temporarily unavailable.',
        },
        {
          status: 502,
        },
      )
    }
  },
}
