import { describe, expect, it } from 'vitest'
import { assessTrade } from './riskEngine'

describe('assessTrade', () => {
  it('approves a trade within the concentration and loss limits', () => {
    const result = assessTrade({
      shares: 100,
      stockPrice: 230,
      stopPrice: 215,
      portfolioValue: 100000,
    })

    expect(result.positionValue).toBe(23000)
    expect(result.concentration).toBeCloseTo(23)
    expect(result.maximumLoss).toBe(1500)
    expect(result.isApproved).toBe(true)
    expect(result.warnings).toHaveLength(0)
  })

  it('rejects a trade that exceeds the concentration limit', () => {
    const result = assessTrade({
      shares: 120,
      stockPrice: 230,
      stopPrice: 215,
      portfolioValue: 100000,
    })

    expect(result.concentration).toBeCloseTo(27.6)
    expect(result.isApproved).toBe(false)
    expect(result.warnings).toContain(
      'Portfolio concentration exceeds the 25% limit.',
    )
  })

  it('rejects a trade that exceeds the maximum loss limit', () => {
    const result = assessTrade({
      shares: 50,
      stockPrice: 230,
      stopPrice: 180,
      portfolioValue: 100000,
    })

    expect(result.maximumLoss).toBe(2500)
    expect(result.lossLimit).toBe(2000)
    expect(result.isApproved).toBe(false)
    expect(result.warnings).toContain(
      'Estimated loss exceeds the 2% portfolio risk limit.',
    )
  })

  it('rejects a stop price above the stock price', () => {
    const result = assessTrade({
      shares: 10,
      stockPrice: 200,
      stopPrice: 210,
      portfolioValue: 100000,
    })

    expect(result.isApproved).toBe(false)
    expect(result.warnings).toContain(
      'Stop price cannot exceed the stock price.',
    )
  })
})
