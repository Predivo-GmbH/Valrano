import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Workspace, WorkspaceMember, WorkspaceRole } from '@/types/database'

// Re-export for convenience
export type { WorkspaceRole } from '@/types/database'

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at')
      if (error) throw error
      return data as Workspace[]
    },
  })
}

export function useCurrentWorkspace() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workspace-current', user?.id],
    queryFn: async () => {
      if (!user) return null
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as Workspace | null
    },
    enabled: !!user,
  })
}

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      const { data, error } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at')
      if (error) throw error
      return data as WorkspaceMember[]
    },
    enabled: !!workspaceId,
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { memberId: string; role: WorkspaceRole; workspaceId: string }) => {
      const { error } = await supabase
        .from('workspace_members')
        .update({ role: params.role })
        .eq('id', params.memberId)
      if (error) throw error
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', params.workspaceId] })
    },
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { memberId: string; workspaceId: string }) => {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', params.memberId)
      if (error) throw error
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', params.workspaceId] })
    },
  })
}

export function useMyWorkspaceRole(workspaceId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workspace-role', workspaceId, user?.id],
    queryFn: async () => {
      if (!workspaceId || !user) return null
      const { data, error } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      return (data?.role as WorkspaceRole) ?? null
    },
    enabled: !!workspaceId && !!user,
  })
}
