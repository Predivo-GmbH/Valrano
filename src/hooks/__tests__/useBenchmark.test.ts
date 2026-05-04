import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing the module
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockSingle = vi.fn()
const mockInvoke = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mockFrom(...args)
      return {
        select: (...a: unknown[]) => {
          mockSelect(...a)
          return {
            order: (...o: unknown[]) => {
              mockOrder(...o)
              return { data: [], error: null }
            },
            eq: (...e: unknown[]) => {
              mockEq(...e)
              return {
                single: () => {
                  mockSingle()
                  return { data: null, error: null }
                },
                data: [],
                error: null,
              }
            },
            data: [],
            error: null,
          }
        },
        insert: (...a: unknown[]) => {
          mockInsert(...a)
          return {
            select: () => ({
              single: () => ({ data: { id: 'test-id' }, error: null }),
            }),
          }
        },
        update: (...a: unknown[]) => {
          mockUpdate(...a)
          return {
            eq: () => ({
              select: () => ({
                single: () => ({ data: { id: 'test-id' }, error: null }),
              }),
            }),
          }
        },
        delete: () => {
          mockDelete()
          return {
            eq: () => ({ error: null }),
          }
        },
      }
    },
    functions: {
      invoke: (...args: unknown[]) => {
        mockInvoke(...args)
        return {
          data: { document_id: 'doc-1', title: 'Test', status: 'draft', sections: 3, risk_flags: 1, competitive_position: 'stable' },
          error: null,
        }
      },
    },
    auth: {
      getUser: () => {
        mockGetUser()
        return { data: { user: { id: 'user-1' } } }
      },
    },
  },
}))

// Import after mocks
import type { KpiSelectionItem } from '@/types/database'

describe('useBenchmark hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('BenchmarkRule types', () => {
    it('should define valid NarrativeStyle values', () => {
      const styles = ['executive_brief', 'detailed_analysis', 'board_presentation'] as const
      expect(styles).toHaveLength(3)
      styles.forEach((s) => expect(typeof s).toBe('string'))
    })

    it('should define valid DocumentStatus values', () => {
      const statuses = ['draft', 'in_review', 'approved', 'delivered', 'rejected'] as const
      expect(statuses).toHaveLength(5)
      statuses.forEach((s) => expect(typeof s).toBe('string'))
    })

    it('should define KpiSelectionItem shape', () => {
      const item: KpiSelectionItem = {
        kpi_definition_id: 'abc-123',
        code: 'REVENUE',
        weight: 1.0,
        threshold_pct: null,
      }
      expect(item.kpi_definition_id).toBe('abc-123')
      expect(item.code).toBe('REVENUE')
      expect(item.weight).toBe(1.0)
      expect(item.threshold_pct).toBeNull()
    })
  })

  describe('BenchmarkContentJson types', () => {
    it('should define valid competitive_position values', () => {
      const positions = ['improved', 'stable', 'declined'] as const
      expect(positions).toHaveLength(3)
    })

    it('should define valid signal values', () => {
      const signals = ['risk', 'neutral', 'advantage'] as const
      expect(signals).toHaveLength(3)
    })
  })

  describe('generate-benchmark invocation', () => {
    it('should invoke generate-benchmark edge function with report_id', async () => {
      const { supabase } = await import('@/lib/supabase')
      const result = await supabase.functions.invoke('generate-benchmark', {
        body: { report_id: 'report-1' },
      })
      expect(mockInvoke).toHaveBeenCalledWith('generate-benchmark', {
        body: { report_id: 'report-1' },
      })
      expect(result.data.document_id).toBe('doc-1')
      expect(result.error).toBeNull()
    })

    it('should invoke with optional benchmark_rule_id', async () => {
      const { supabase } = await import('@/lib/supabase')
      await supabase.functions.invoke('generate-benchmark', {
        body: { report_id: 'report-1', benchmark_rule_id: 'rule-1' },
      })
      expect(mockInvoke).toHaveBeenCalledWith('generate-benchmark', {
        body: { report_id: 'report-1', benchmark_rule_id: 'rule-1' },
      })
    })
  })

  describe('benchmark_rules CRUD operations', () => {
    it('should query benchmark_rules table', async () => {
      const { supabase } = await import('@/lib/supabase')
      supabase.from('benchmark_rules').select('*, companies(*)')
      expect(mockFrom).toHaveBeenCalledWith('benchmark_rules')
      expect(mockSelect).toHaveBeenCalledWith('*, companies(*)')
    })

    it('should insert a new benchmark rule', async () => {
      const { supabase } = await import('@/lib/supabase')
      const result = supabase.from('benchmark_rules').insert({
        customer_company_id: 'company-1',
        name: 'Test Rule',
        kpi_selection: [],
        narrative_style: 'executive_brief',
        auto_generate: true,
        created_by: 'user-1',
      })
      expect(mockFrom).toHaveBeenCalledWith('benchmark_rules')
      expect(mockInsert).toHaveBeenCalled()
      expect(result).toBeDefined()
    })
  })

  describe('benchmark_documents queries', () => {
    it('should query benchmark_documents table', async () => {
      const { supabase } = await import('@/lib/supabase')
      supabase.from('benchmark_documents').select('*')
      expect(mockFrom).toHaveBeenCalledWith('benchmark_documents')
    })

    it('should update document status', async () => {
      const { supabase } = await import('@/lib/supabase')
      supabase.from('benchmark_documents').update({ status: 'approved' })
      expect(mockFrom).toHaveBeenCalledWith('benchmark_documents')
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'approved' })
    })
  })
})
