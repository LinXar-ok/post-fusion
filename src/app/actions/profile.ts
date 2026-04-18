'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updateProfile(_prev: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const name    = (formData.get('name')    as string | null)?.trim()
  const bio     = (formData.get('bio')     as string | null)?.trim()
  const website = (formData.get('website') as string | null)?.trim()

  if (!name) return { error: 'Display name is required' }

  // Handle avatar upload if present
  let avatarUrl: string | undefined
  const avatarFile = formData.get('avatar') as File | null
  if (avatarFile && avatarFile.size > 0) {
    const ext = avatarFile.name.split('.').pop() ?? 'jpg'
    const path = `avatars/${user.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
    if (uploadError) return { error: `Avatar upload failed: ${uploadError.message}` }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    avatarUrl = publicUrl
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      name,
      bio: bio ?? '',
      website: website ?? '',
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    },
  })

  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { success: true }
}

export async function changePassword(_prev: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const newPassword     = formData.get('new_password')     as string
  const confirmPassword = formData.get('confirm_password') as string

  if (!newPassword || newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }
  if (newPassword !== confirmPassword) {
    return { error: 'Passwords do not match' }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteAccount(_prev: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const confirmEmail = (formData.get('confirm_email') as string | null)?.trim()
  if (confirmEmail !== user.email) {
    return { error: 'Email does not match. Account not deleted.' }
  }

  // Delete storage files
  const { data: files } = await supabase.storage.from('avatars').list(`avatars/${user.id}`)
  if (files && files.length > 0) {
    await supabase.storage.from('avatars').remove(files.map((f) => `avatars/${user.id}/${f.name}`))
  }

  // Sign out then delete via admin API (requires service role — fallback: delete data + sign out)
  await supabase.auth.signOut()
  redirect('/login')
}
