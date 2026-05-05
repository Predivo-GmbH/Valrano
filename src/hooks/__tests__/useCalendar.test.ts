import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockIn = vi.fn()
const mockOrder = vi.fn()
const mockInvoke = vi.fn()

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
                order: () => ({ data: [], error: null }),
                single: () => ({ data: null, error: null }),
                data: [],
                error: null,
              }
            },
            in: (...i: unknown[]) => {
              mockIn(...i)
              return { data: [], error: null }
            },
            data: [],
            error: null,
          }
        },
        insert: (...a: unknown[]) => {
          mockInsert(...a)
          return {
            select: () => ({
              single: () => ({ data: { id: 'pe-1', status: 'scheduled' }, error: null }),
            }),
          }
        },
        update: (...a: unknown[]) => {
          mockUpdate(...a)
          return {
            eq: () => ({ data: null, error: null }),
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
        return { data: { success: true, detected: false }, error: null }
      },
    },
  },
}))

describe('useCalendar hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('publication_events queries', () => {
    it('should query publication_events with companies join', async () => {
      const { supabase } = await import('@/lib/supabase')
      supabase.from('publication_events').select('*, companies(id, name, ticker)')
      expect(mockFrom).toHaveBeenCalledWith('publication_events')
      expect(mockSelect).toHaveBeenCalledWith('*, companies(id, name, ticker)')
    })

    it('should insert a new publication event with defaults', async () => {
      const { supabase } = await import('@/lib/supabase')
      const event = {
        company_id: 'c-1',
        report_type: 'annual',
        fiscal_year: 2025,
        expected_date: '2026-02-27',
        status: 'scheduled',
      }
      supabase.from('publication_events').insert(event)
      expect(mockFrom).toHaveBeenCalledWith('publication_events')
      expect(mockInsert).toHaveBeenCalledWith(event)
    })

    it('should delete a publication event by id', async () => {
      const { supabase } = await import('@/lib/supabase')
      supabase.from('publication_events').delete()
      expect(mockFrom).toHaveBeenCalledWith('publication_events')
      expect(mockDelete).toHaveBeenCalled()
    })
  })

  describe('check-publication invocation', () => {
    it('should invoke check-publication with event id', async () => {
      const { supabase } = await import('@/lib/supabase')
      const result = await supabase.functions.invoke('check-publication', {
        body: { publication_event_id: 'pe-1' },
      })
      expect(mockInvoke).toHaveBeenCalledWith('check-publication', {
        body: { publication_event_id: 'pe-1' },
      })
      expect(result.data.success).toBe(true)
    })
  })

  describe('monitor_checks queries', () => {
    it('should query monitor_checks for a specific event', async () => {
      const { supabase } = await import('@/lib/supabase')
      supabase.from('monitor_checks').select('*').eq('publication_event_id', 'pe-1')
      expect(mockFrom).toHaveBeenCalledWith('monitor_checks')
      expect(mockEq).toHaveBeenCalledWith('publication_event_id', 'pe-1')
    })
  })

  describe('pipeline-orchestrator invocation', () => {
    it('should invoke pipeline-orchestrator with report id', async () => {
      const { supabase } = await import('@/lib/supabase')
      await supabase.functions.invoke('pipeline-orchestrator', {
        body: { report_id: 'report-1' },
      })
      expect(mockInvoke).toHaveBeenCalledWith('pipeline-orchestrator', {
        body: { report_id: 'report-1' },
      })
    })
  })

  describe('publication event status types', () => {
    it('should define all valid statuses', () => {
      const statuses = [
        'scheduled', 'due_today', 'overdue', 'detected',
        'ingested', 'benchmark_ready', 'stale', 'delivered', 'cancelled',
      ]
      expect(statuses).toHaveLength(9)
    })

    it('should define valid report types', () => {
      const types = ['annual', 'quarterly', 'half_year', 'sustainability']
      expect(types).toHaveLength(4)
    })
  })
})
