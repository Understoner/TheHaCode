import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type NewsPost = Database['public']['Tables']['news_posts']['Row'];

export function useNewsList() {
  return useQuery({
    queryKey: ['news_posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_posts')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}
