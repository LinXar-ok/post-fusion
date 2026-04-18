'use client'

import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, LogOut } from 'lucide-react'
import { signout } from '@/app/actions/auth'
import { useRouter } from 'next/navigation'

interface Props {
  name: string
  avatarUrl: string
}

export function AvatarMenu({ name, avatarUrl }: Props) {
  const router = useRouter()
  const initials = name?.charAt(0)?.toUpperCase() ?? 'U'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-xl transition-colors duration-200 focus-visible:outline-none bg-[var(--nm-bg)] p-0.5 cursor-pointer"
        style={{ boxShadow: 'var(--nm-raised-sm)' }}
        aria-label="Account menu"
      >
        <Avatar className="w-8 h-8">
          <AvatarImage src={avatarUrl} alt={name} />
          <AvatarFallback className="bg-[#2E5E99]/15 text-[#2E5E99] font-semibold text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44 bg-[var(--nm-bg)]" style={{ boxShadow: 'var(--nm-raised)' }}>
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => router.push('/profile')}
        >
          <User className="w-3.5 h-3.5" />
          View Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer text-destructive"
          onClick={() => signout()}
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
