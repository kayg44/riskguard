export type RiskInput = {
  shares: number
  stockPrice: number
  stopPrice: number
  portfolioValue: number
}

export type RiskResult = {
  positionValue: number
  concentration: number
  maximumLoss: number
  concentrationLimit: number
  lossLimit: number
  isApproved: boolean
  warnings: string[]
}

export function assessTrade(input: RiskInput): RiskResult {
  const concentrationLimit = 25
  const lossLimit = input.portfolioValue * 0.02

  const positionValue = input.shares * input.stockPrice

  const concentration =
    input.portfolioValue > 0
      ? (positionValue / input.portfolioValue) * 100
      : 0

  const maximumLoss = Math.max(
    0,
    (input.stockPrice - input.stopPrice) * input.shares,
  )

  const warnings: string[] = []

  if (input.shares <= 0) {
    warnings.push('Share quantity must be greater than zero.')
  }

  if (input.stockPrice <= 0) {
    warnings.push('Stock price must be greater than zero.')
  }

  if (input.portfolioValue <= 0) {
    warnings.push('Portfolio value must be greater than zero.')
  }

  if (input.stopPrice > input.stockPrice) {
    warnings.push('Stop price cannot exceed the stock price.')
  }

  if (concentration > concentrationLimit) {
    warnings.push('Portfolio concentration exceeds the 25% limit.')
  }

  if (maximumLoss > lossLimit) {
    warnings.push('Estimated loss exceeds the 2% portfolio risk limit.')
  }

  return {
    positionValue,
    concentration,
    maximumLoss,
    concentrationLimit,
    lossLimit,
    isApproved: warnings.length === 0,
    warnings,
  }
}
