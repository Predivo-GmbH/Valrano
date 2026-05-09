import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  useCurrentWorkspace,
  useWorkspaceMembers,
  useUpdateMemberRole,
  useRemoveMember,
} from '@/hooks/useWorkspace'
import { useSubscription } from '@/hooks/useSubscription'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Crown, Mail, MoreHorizontal, Shield, Eye, Pencil, Trash2, UserPlus, Loader2 } from 'lucide-react'
import type { WorkspaceRole } from '@/types/database'

const ROLE_CONFIG: Record<WorkspaceRole, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: 'Admin', icon: Crown, color: 'text-amber-500' },
  editor: { label: 'Editor', icon: Pencil, color: 'text-blue-500' },
  viewer: { label: 'Viewer', icon: Eye, color: 'text-muted-foreground' },
}

const TIER_LIMITS: Record<string, number> = {
  starter: 1,
  professional: 5,
  enterprise: 50,
}

export function TeamPage() {
  const { user } = useAuth()
  const { data: workspace, isLoading: wsLoading } = useCurrentWorkspace()
  const { data: members = [], isLoading: membersLoading } = useWorkspaceMembers(workspace?.id)
  const { tier } = useSubscription()
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()
  const queryClient = useQueryClient()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('viewer')
  const [inviting, setInviting] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const maxMembers = TIER_LIMITS[tier] ?? 1
  const isOwner = workspace?.owner_id === user?.id
  const myMember = members.find(m => m.user_id === user?.id)
  const isAdmin = isOwner || myMember?.role === 'admin'

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspace || !inviteEmail.trim()) return

    if (members.length >= maxMembers) {
      toast.error(`Your ${tier} plan allows up to ${maxMembers} team member${maxMembers > 1 ? 's' : ''}. Upgrade to add more.`)
      return
    }

    setInviting(true)
    try {
      // Look up the user by email via a direct query
      const { data: targetUsers } = await supabase.rpc('lookup_user_by_email', { email_input: inviteEmail.trim() })

      if (!targetUsers || targetUsers.length === 0) {
        toast.error('No account found with that email. They need to sign up first.')
        setInviting(false)
        return
      }

      const targetUserId = targetUsers[0].id

      if (members.some(m => m.user_id === targetUserId)) {
        toast.error('This user is already a team member.')
        setInviting(false)
        return
      }

      const { error } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspace.id,
          user_id: targetUserId,
          role: inviteRole,
          invited_by: user?.id,
          accepted_at: new Date().toISOString(),
        })

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspace.id] })
      toast.success(`${inviteEmail} added as ${inviteRole}`)
      setInviteEmail('')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setInviting(false)
    }
  }

  if (wsLoading || membersLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Workspace info */}
      <div>
        <h2 className="text-[16px] font-semibold text-foreground">Team</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Manage who has access to your workspace. Team members share peer groups, reports, and benchmarks.
        </p>
      </div>

      {/* Plan limits */}
      <div className="rounded-lg border border-border bg-[var(--color-bg-secondary)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-foreground">
              {members.length} of {maxMembers} seats used
            </p>
            <p className="text-[12px] text-muted-foreground">
              {tier.charAt(0).toUpperCase() + tier.slice(1)} plan
            </p>
          </div>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all"
              style={{ width: `${Math.min(100, (members.length / maxMembers) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Invite form */}
      {isAdmin && (
        <form onSubmit={handleInvite} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground">
              Role
            </label>
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as WorkspaceRole)}
              className="h-10 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting || members.length >= maxMembers}
            className="flex h-10 items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Add
          </button>
        </form>
      )}

      {/* Members list */}
      <div className="space-y-1">
        {members.map(member => {
          const role = ROLE_CONFIG[member.role as WorkspaceRole] ?? ROLE_CONFIG.viewer
          const RoleIcon = role.icon
          const isSelf = member.user_id === user?.id
          const isOwnerMember = member.user_id === workspace?.owner_id

          return (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                  <RoleIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-foreground">
                    {('display_name' in member && member.display_name) || (member.user_id.slice(0, 8) + '...')}
                    {isSelf && <span className="ml-2 text-[11px] text-muted-foreground">(you)</span>}
                    {isOwnerMember && <span className="ml-2 text-[11px] text-amber-500">Owner</span>}
                  </p>
                  <p className={`text-[12px] ${role.color}`}>
                    {role.label}
                  </p>
                </div>
              </div>

              {isAdmin && !isOwnerMember && !isSelf && (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {menuOpen === member.id && (
                    <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-xl">
                      {(['admin', 'editor', 'viewer'] as WorkspaceRole[]).map(r => (
                        <button
                          key={r}
                          onClick={() => {
                            updateRole.mutate({ memberId: member.id, role: r, workspaceId: workspace!.id })
                            setMenuOpen(null)
                          }}
                          className={`block w-full px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-muted/50 ${
                            member.role === r ? 'font-medium text-[var(--color-accent)]' : 'text-foreground'
                          }`}
                        >
                          Set as {ROLE_CONFIG[r].label}
                        </button>
                      ))}
                      <hr className="my-1 border-border" />
                      <button
                        onClick={() => {
                          removeMember.mutate({ memberId: member.id, workspaceId: workspace!.id })
                          setMenuOpen(null)
                          toast.success('Member removed')
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-red-500 transition-colors hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Role explanation */}
      <div className="rounded-lg border border-border bg-[var(--color-bg-secondary)] p-4">
        <p className="mb-3 text-[13px] font-medium text-foreground">Role permissions</p>
        <div className="space-y-2 text-[12px] text-muted-foreground">
          <div className="flex items-start gap-2">
            <Crown className="mt-0.5 h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span><strong className="text-foreground">Admin</strong> — Full access. Manage team members, peer groups, rules, documents, and billing.</span>
          </div>
          <div className="flex items-start gap-2">
            <Pencil className="mt-0.5 h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span><strong className="text-foreground">Editor</strong> — Create and modify peer groups, upload reports, generate benchmarks. Cannot manage team.</span>
          </div>
          <div className="flex items-start gap-2">
            <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span><strong className="text-foreground">Viewer</strong> — Read-only access to all workspace data. Cannot modify anything.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
