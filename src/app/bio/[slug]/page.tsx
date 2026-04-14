import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { BioPageView } from '@/components/bio/bio-page-view'

type Props = { params: Promise<{ slug: string }> }

export default async function PublicBioPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: page } = await supabase
    .from('bio_pages')
    .select('*, bio_links(id, label, url, sort_order, click_count)')
    .eq('slug', slug)
    .single()

  if (!page) notFound()

  const links = [...(page.bio_links ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  return <BioPageView page={page} links={links} />
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: page } = await supabase.from('bio_pages').select('title, bio').eq('slug', slug).single()
  return {
    title: page?.title ?? 'Link in Bio',
    description: page?.bio ?? '',
  }
}
