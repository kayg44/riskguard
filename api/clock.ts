/// <reference types="node" />

import { env } from 'node:process'

type AlpacaClock = {
  timestamp?: string
  is_open?: boolean
  next_open?: string
  next_close?: string
  message?: string
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') {
      return Response.json({ error: 'Method not allowed.' }, { status: 405 })
    }

    const apiKey = env.ALPACA_API_KEY_ID
    const apiSecret = env.ALPACA_API_SECRET_KEY

    if (!apiKey || !apiSecret) {
      return Response.json(
        { error: 'Market-clock credentials are not configured.' },
        { status: 500 },
      )
    }

    try {
      const alpacaResponse = await fetch(
        'https://paper-api.alpaca.markets/v2/clock',
        {
          headers: {
            'APCA-API-KEY-ID': apiKey,
            'APCA-API-SECRET-KEY': apiSecret,
          },
        },
      )

      const data = (await alpacaResponse.json()) as AlpacaClock

      if (
        !alpacaResponse.ok ||
        typeof data.is_open !== 'boolean' ||
        !data.next_open ||
        !data.next_close
      ) {
        return Response.json(
          { error: data.message ?? 'Unable to retrieve market status.' },
          { status: alpacaResponse.status || 502 },
        )
      }

      return Response.json(
        {
          timestamp: data.timestamp ?? new Date().toISOString(),
          isOpen: data.is_open,
          nextOpen: data.next_open,
          nextClose: data.next_close,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30',
          },
        },
      )
    } catch {
      return Response.json(
        { error: 'The market-clock service is temporarily unavailable.' },
        { status: 502 },
      )
    }
  },
}
