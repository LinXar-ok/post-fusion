'use client'

import { useActionState, useRef, useState, useEffect } from 'react'
import { updateProfile, changePassword, deleteAccount } from '@/app/actions/profile'
import { createClient } from '@/lib/supabase/client'

type UserMeta = {
  name: string; email: string; bio: string; website: string; avatar_url: string
}

type TabId = 'profile' | 'password' | 'danger'

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
      {children}
    </label>
  )
}

function InsetInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--nm-bg)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
      style={{ boxShadow: 'var(--nm-inset-sm)' }}
    />
  )
}

function InsetTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={3}
      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--nm-bg)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none"
      style={{ boxShadow: 'var(--nm-inset-sm)' }}
    />
  )
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-5 py-2.5 rounded-xl bg-[#2E5E99] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
      style={{ boxShadow: 'var(--nm-raised-sm)' }}
    >
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  )
}

export default function ProfilePage() {
  const supabase = createClient()
  const [meta, setMeta] = useState<UserMeta>({ name: '', email: '', bio: '', website: '', avatar_url: '' })
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [showDangerModal, setShowDangerModal] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setMeta({
        name:       (user.user_metadata?.name       as string) ?? '',
        email:      user.email ?? '',
        bio:        (user.user_metadata?.bio        as string) ?? '',
        website:    (user.user_metadata?.website    as string) ?? '',
        avatar_url: (user.user_metadata?.avatar_url as string) ?? '',
      })
      setAvatarPreview((user.user_metadata?.avatar_url as string) ?? '')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [profileState, profileAction, profilePending] = useActionState(updateProfile, null)
  const [pwState,      pwAction,      pwPending]      = useActionState(changePassword, null)
  const [deleteState,  deleteAction,  deletePending]  = useActionState(deleteAccount, null)

  const tabs: { id: TabId; label: string; danger?: boolean }[] = [
    { id: 'profile',  label: 'Edit Profile' },
    { id: 'password', label: 'Change Password' },
    { id: 'danger',   label: 'Danger Zone', danger: true },
  ]

  const initials = meta.name?.charAt(0)?.toUpperCase() ?? 'U'

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-2xl mx-auto w-full">
      {/* Page header with avatar */}
      <div className="flex items-center gap-5 mb-8">
        <div className="relative">
          <div
            className="w-16 h-16 rounded-full bg-[var(--nm-bg)] flex items-center justify-center overflow-hidden"
            style={{ boxShadow: 'var(--nm-raised)' }}
          >
            {avatarPreview
              ? <img src={avatarPreview} alt={meta.name} className="w-full h-full object-cover" />
              : <span className="text-2xl font-bold text-[#2E5E99]">{initials}</span>
            }
          </div>
          {activeTab === 'profile' && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#2E5E99] border-2 border-[var(--nm-bg)] flex items-center justify-center cursor-pointer"
            >
              <svg width="10" height="10" fill="none" stroke="white" strokeWidth={2.2} viewBox="0 0 24 24">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
          )}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{meta.name || 'Your Profile'}</h1>
          <p className="text-sm text-muted-foreground">{meta.email}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? tab.danger ? 'border-destructive text-destructive' : 'border-[#2E5E99] text-[#2E5E99]'
                : tab.danger ? 'border-transparent text-destructive/50 hover:text-destructive/80' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Edit Profile tab */}
      {activeTab === 'profile' && (
        <form action={profileAction} className="space-y-5">
          <input ref={fileRef} type="file" name="avatar" accept="image/*" className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setAvatarPreview(URL.createObjectURL(file))
            }}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Display Name</FieldLabel>
              <InsetInput name="name" defaultValue={meta.name} placeholder="Your name" required />
            </div>
            <div>
              <FieldLabel>Email <span className="text-muted-foreground/50 normal-case font-normal">(read-only)</span></FieldLabel>
              <InsetInput value={meta.email} disabled readOnly />
            </div>
          </div>
          <div>
            <FieldLabel>Bio</FieldLabel>
            <InsetTextarea name="bio" defaultValue={meta.bio} placeholder="A short bio…" />
          </div>
          <div>
            <FieldLabel>Website</FieldLabel>
            <InsetInput name="website" type="url" defaultValue={meta.website} placeholder="https://" />
          </div>
          {profileState && 'error' in profileState && profileState.error && (
            <p className="text-sm text-destructive">{profileState.error}</p>
          )}
          {profileState && 'success' in profileState && profileState.success && (
            <p className="text-sm text-[#128C7E] font-medium">Profile updated!</p>
          )}
          <div className="flex justify-end">
            <SaveButton pending={profilePending} />
          </div>
        </form>
      )}

      {/* Change Password tab */}
      {activeTab === 'password' && (
        <form action={pwAction} className="space-y-5 max-w-sm">
          <div>
            <FieldLabel>New Password</FieldLabel>
            <InsetInput name="new_password" type="password" placeholder="Min 8 characters" required minLength={8} />
          </div>
          <div>
            <FieldLabel>Confirm New Password</FieldLabel>
            <InsetInput name="confirm_password" type="password" placeholder="Repeat password" required />
          </div>
          {pwState && 'error' in pwState && pwState.error && (
            <p className="text-sm text-destructive">{pwState.error}</p>
          )}
          {pwState && 'success' in pwState && pwState.success && (
            <p className="text-sm text-[#128C7E] font-medium">Password updated!</p>
          )}
          <div className="flex justify-end">
            <SaveButton pending={pwPending} />
          </div>
        </form>
      )}

      {/* Danger Zone tab */}
      {activeTab === 'danger' && (
        <div>
          <div className="rounded-2xl border border-destructive/30 p-6 bg-destructive/5">
            <h3 className="text-sm font-semibold text-destructive mb-1">Delete Account</h3>
            <p className="text-xs text-muted-foreground mb-4">
              This will permanently delete your account, all posts, and connected profiles. This cannot be undone.
            </p>
            <button
              onClick={() => setShowDangerModal(true)}
              className="px-4 py-2 rounded-xl border border-destructive text-destructive text-sm font-semibold hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              Delete my account
            </button>
          </div>

          {/* Confirmation modal */}
          {showDangerModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60" onClick={() => setShowDangerModal(false)} />
              <div className="relative rounded-2xl p-6 bg-[var(--nm-bg)] w-full max-w-sm" style={{ boxShadow: 'var(--nm-raised-lg)' }}>
                <h3 className="font-display text-base font-bold text-destructive mb-2">Confirm deletion</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Type your email address <strong className="text-foreground">{meta.email}</strong> to confirm.
                </p>
                <form action={deleteAction} className="space-y-3">
                  <InsetInput
                    name="confirm_email"
                    type="email"
                    placeholder={meta.email}
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    required
                  />
                  {deleteState && 'error' in deleteState && deleteState.error && (
                    <p className="text-xs text-destructive">{deleteState.error}</p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setShowDangerModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={deletePending || confirmEmail !== meta.email}
                      className="px-4 py-2 rounded-xl bg-destructive text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      {deletePending ? 'Deleting…' : 'Delete forever'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
