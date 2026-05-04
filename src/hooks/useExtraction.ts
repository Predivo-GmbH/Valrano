import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useUploadReport() {
  return useMutation({
    mutationFn: async (params: {
      file: File
      companyId: string
      reportType: string
      fiscalYear: number
      fiscalQuarter?: number
    }) => {
      const formData = new FormData()
      formData.append('file', params.file)
      formData.append('company_id', params.companyId)
      formData.append('report_type', params.reportType)
      formData.append('fiscal_year', params.fiscalYear.toString())
      if (params.fiscalQuarter !== undefined) {
        formData.append('fiscal_quarter', params.fiscalQuarter.toString())
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-report`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: formData,
        },
      )

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(body.error ?? `Upload failed with status ${res.status}`)
      }

      return res.json() as Promise<{ report_id: string; storage_path: string }>
    },
  })
}

export function useExtractKpis() {
  return useMutation({
    mutationFn: async (reportId: string) => {
      const { data, error } = await supabase.functions.invoke('extract-kpis', {
        body: { report_id: reportId },
      })
      if (error) throw error
      return data as {
        extraction_id: string
        total_kpis_extracted: number
        avg_confidence: number | null
        needs_review_count: number
      }
    },
  })
}

export function useNormalizeKpis() {
  return useMutation({
    mutationFn: async (reportId: string) => {
      const { data, error } = await supabase.functions.invoke('normalize-kpis', {
        body: { report_id: reportId },
      })
      if (error) throw error
      return data as { report_id: string; updated: number; skipped: number }
    },
  })
}
