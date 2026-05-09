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
      // First try owned workspace
      const { data: owned, error: ownedErr } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle()
      if (ownedErr) throw ownedErr
      if (owned) return owned as Workspace

      // Fall back to workspace where user is a member
      const { data: membership, error: memErr } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      if (memErr) throw memErr
      if (!membership) return null

      const { data: ws, error: wsErr } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', membership.workspace_id)
        .single()
      if (wsErr) throw wsErr
      return ws as Workspace
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
        .select('*, user_profiles:user_id(full_name)')
        .eq('workspace_id', workspaceId)
        .order('created_at')
      if (error) throw error
      return (data ?? []).map((m) => ({
        ...m,
        display_name: (m.user_profiles as { full_name: string | null } | null)?.full_name ?? null,
      })) as (WorkspaceMember & { display_name: string | null })[]
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
