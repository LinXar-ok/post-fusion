CREATE OR REPLACE FUNCTION public.increment_bio_link_click(link_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.bio_links SET click_count = click_count + 1 WHERE id = link_id;
$$;
