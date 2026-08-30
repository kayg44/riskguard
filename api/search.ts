/// <reference types="node" />

import { env } from 'node:process'

type AlpacaAsset = {
  id?: string
  symbol?: string
  name?: string
  exchange?: string
  asset_class?: string
  status?: string
  tradable?: boolean
  fractionable?: boolean
  marginable?: boolean
  shortable?: boolean
}

const normalizeAsset = (asset: AlpacaAsset) => ({
  id: asset.id ?? '',
  symbol: asset.symbol ?? '',
  name:
    asset.name ??
    asset.symbol ??
    'Unknown security',
  exchange: asset.exchange ?? 'US market',
  assetClass:
    asset.asset_class ?? 'us_equity',
  tradable: Boolean(asset.tradable),
  fractionable: Boolean(asset.fractionable),
  marginable: Boolean(asset.marginable),
  shortable: Boolean(asset.shortable),
})

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') {
      return Response.json(
        {
          error: 'Method not allowed.',
        },
        {
          status: 405,
        },
      )
    }

    const requestUrl = new URL(request.url)

    const query = (
      requestUrl.searchParams.get('q') ?? ''
    ).trim()

    if (
      query.length < 1 ||
      query.length > 40
    ) {
      return Response.json({
        assets: [],
      })
    }

    const apiKey = env.ALPACA_API_KEY_ID
    const apiSecret =
      env.ALPACA_API_SECRET_KEY

    if (!apiKey || !apiSecret) {
      return Response.json(
        {
          error:
            'Market-data credentials are not configured.',
        },
        {
          status: 500,
        },
      )
    }

    try {
      const alpacaResponse = await fetch(
        'https://paper-api.alpaca.markets/v2/assets?status=active&asset_class=us_equity',
        {
          headers: {
            'APCA-API-KEY-ID': apiKey,
            'APCA-API-SECRET-KEY':
              apiSecret,
          },
        },
      )

      const data =
        (await alpacaResponse.json()) as
          | AlpacaAsset[]
          | {
              message?: string
            }

      if (
        !alpacaResponse.ok ||
        !Array.isArray(data)
      ) {
        const message = Array.isArray(data)
          ? undefined
          : data.message

        return Response.json(
          {
            error:
              message ??
              'Unable to search securities.',
          },
          {
            status: alpacaResponse.status,
          },
        )
      }

      const normalizedQuery =
        query.toUpperCase()

      const assets = data
        .filter(
          (asset) =>
            asset.symbol && asset.name,
        )
        .map((asset) => ({
          asset,
          symbol:
            asset.symbol?.toUpperCase() ?? '',
          name:
            asset.name?.toUpperCase() ?? '',
        }))
        .filter(
          ({ symbol, name }) =>
            symbol.startsWith(
              normalizedQuery,
            ) ||
            name.includes(normalizedQuery),
        )
        .sort((left, right) => {
          const leftRank =
            left.symbol === normalizedQuery
              ? 0
              : left.symbol.startsWith(
                    normalizedQuery,
                  )
                ? 1
                : left.name.startsWith(
                      normalizedQuery,
                    )
                  ? 2
                  : 3

          const rightRank =
            right.symbol === normalizedQuery
              ? 0
              : right.symbol.startsWith(
                    normalizedQuery,
                  )
                ? 1
                : right.name.startsWith(
                      normalizedQuery,
                    )
                  ? 2
                  : 3

          return (
            leftRank -
              rightRank ||
            left.symbol.localeCompare(
              right.symbol,
            )
          )
        })
        .slice(0, 8)
        .map(({ asset }) =>
          normalizeAsset(asset),
        )

      return Response.json(
        {
          assets,
        },
        {
          headers: {
            'Cache-Control':
              'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        },
      )
    } catch {
      return Response.json(
        {
          error:
            'The security-search service is temporarily unavailable.',
        },
        {
          status: 502,
        },
      )
    }
  },
}
