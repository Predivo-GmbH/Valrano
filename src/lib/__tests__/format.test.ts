import { formatKpiValue, formatCurrency } from '@/lib/format'

describe('formatKpiValue', () => {
  it('formats currency values in millions', () => {
    expect(formatKpiValue(500, 'currency')).toBe('500M')
  })

  it('formats currency values in billions', () => {
    expect(formatKpiValue(27000, 'currency')).toBe('27.0B')
  })

  it('formats percentages', () => {
    expect(formatKpiValue(25.5, 'percentage')).toBe('25.5%')
  })

  it('formats ratios', () => {
    expect(formatKpiValue(2.3, 'ratio')).toBe('2.3x')
  })

  it('handles null values', () => {
    expect(formatKpiValue(null, 'currency')).toBe('—')
  })

  it('formats tons in megatonnes', () => {
    expect(formatKpiValue(1500000, 'tons')).toBe('1.5Mt')
  })

  it('formats tons in kilotonnes', () => {
    expect(formatKpiValue(45000, 'tons')).toBe('45kt')
  })

  it('handles undefined as null-like', () => {
    expect(formatKpiValue(undefined as unknown as null, 'currency')).toBe('—')
  })

  it('formats zero currency value', () => {
    expect(formatKpiValue(0, 'currency')).toBe('0M')
  })

  it('formats small ratios with one decimal', () => {
    expect(formatKpiValue(1.0, 'ratio')).toBe('1.0x')
  })

  it('formats percentage with one decimal place', () => {
    expect(formatKpiValue(100, 'percentage')).toBe('100.0%')
  })

  it('formats number type', () => {
    expect(formatKpiValue(42.7, 'number')).toBe('42.7')
  })
})

describe('formatCurrency', () => {
  it('formats CHF in billions', () => {
    expect(formatCurrency(27000, 'CHF')).toBe('CHF 27.0B')
  })

  it('formats EUR in millions', () => {
    expect(formatCurrency(500, 'EUR')).toBe('EUR 500M')
  })

  it('formats USD at the 1000M boundary as billions', () => {
    expect(formatCurrency(1000, 'USD')).toBe('USD 1.0B')
  })

  it('uses CHF as default currency', () => {
    expect(formatCurrency(500)).toBe('CHF 500M')
  })
})
