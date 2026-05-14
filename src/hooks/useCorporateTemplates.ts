import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CorporateTemplate {
  id: string
  user_id: string
  name: string
  description: string | null
  file_format: 'pptx' | 'xlsx' | 'gslides' | 'gsheets'
  storage_path: string
  file_size_bytes: number | null
  placeholders: string[]
  placeholder_mapping: Record<string, string>
  status: 'uploaded' | 'parsing' | 'ready' | 'error'
  error_message: string | null
  slide_count: number | null
  thumbnail_path: string | null
  created_at: string
  updated_at: string
}

export interface GeneratedExport {
  id: string
  user_id: string
  template_id: string
  custom_report_id: string | null
  output_path: string | null
  output_format: 'pptx' | 'xlsx' | 'pdf'
  data_snapshot: Record<string, string>
  status: 'pending' | 'generating' | 'ready' | 'error'
  error_message: string | null
  created_at: string
  corporate_templates?: CorporateTemplate | null
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useCorporateTemplates() {
  return useQuery({
    queryKey: ['corporate-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corporate_templates')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as CorporateTemplate[]
    },
  })
}

export function useCorporateTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['corporate-templates', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corporate_templates')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as CorporateTemplate
    },
    enabled: !!id,
  })
}

export function useGeneratedExports() {
  return useQuery({
    queryKey: ['generated-exports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_exports')
        .select('*, corporate_templates(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as GeneratedExport[]
    },
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useUploadCorporateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      file: File
      name: string
      description?: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const ext = params.file.name.split('.').pop()?.toLowerCase()
      if (ext !== 'pptx' && ext !== 'xlsx') {
        throw new Error('Only .pptx and .xlsx files are supported')
      }

      const storagePath = `${user.id}/templates/${crypto.randomUUID()}.${ext}`

      // Upload file to storage
      const { error: uploadErr } = await supabase.storage
        .from('corporate-templates')
        .upload(storagePath, params.file)

      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)

      // Create DB record
      const { data, error } = await supabase
        .from('corporate_templates')
        .insert({
          user_id: user.id,
          name: params.name,
          description: params.description ?? null,
          file_format: ext,
          storage_path: storagePath,
          file_size_bytes: params.file.size,
          status: 'uploaded',
        })
        .select()
        .single()

      if (error) throw error
      return data as CorporateTemplate
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporate-templates'] })
    },
  })
}

export function useParseTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data, error } = await supabase.functions.invoke('parse-template', {
        body: { template_id: templateId },
      })
      if (error) throw error
      return data as {
        template_id: string
        placeholders: string[]
        slide_count: number
        status: string
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporate-templates'] })
    },
  })
}

export function useUpdatePlaceholderMapping() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      templateId: string
      mapping: Record<string, string>
    }) => {
      const { data, error } = await supabase
        .from('corporate_templates')
        .update({ placeholder_mapping: params.mapping })
        .eq('id', params.templateId)
        .select()
        .single()
      if (error) throw error
      return data as CorporateTemplate
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporate-templates'] })
    },
  })
}

export function useGenerateFromTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      template_id: string
      data?: Record<string, string>
      report_id?: string
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-from-template', {
        body: params,
      })
      if (error) throw error
      return data as {
        export_id: string
        output_path: string
        placeholders_replaced: number
        status: string
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generated-exports'] })
    },
  })
}

export function useDeleteCorporateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (template: CorporateTemplate) => {
      // Delete storage file
      await supabase.storage
        .from('corporate-templates')
        .remove([template.storage_path])

      // Delete DB record (cascades to generated_exports)
      const { error } = await supabase
        .from('corporate_templates')
        .delete()
        .eq('id', template.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporate-templates'] })
      queryClient.invalidateQueries({ queryKey: ['generated-exports'] })
    },
  })
}

export function useDownloadExport() {
  return useMutation({
    mutationFn: async (outputPath: string) => {
      const { data, error } = await supabase.storage
        .from('corporate-templates')
        .download(outputPath)
      if (error) throw error
      return data
    },
  })
}
