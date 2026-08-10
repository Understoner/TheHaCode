import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { NewsCategory } from '@/features/news/categories';
import type { Database } from '@/types/database';

export type NewsPost = Database['public']['Tables']['news_posts']['Row'];

export function useNewsList(category?: NewsCategory) {
  return useQuery({
    queryKey: ['news_posts', category ?? 'all'],
    queryFn: async () => {
      let query = supabase.from('news_posts').select('*');
      if (category) {
        query = query.eq('category', category);
      }
      const { data, error } = await query
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}
