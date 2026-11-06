import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { NewsValues } from '@/features/news/newsForm';
import type { NewsPost } from '@/features/news/useNewsList';

// Ein einzelner Beitrag ueber seinen slug - die Adresse in der Leiste ist
// damit lesbar und bleibt gleich, auch wenn die Zeile im Studio neu angelegt
// wird. Ueber die ID waere sie beides nicht.
//
// maybeSingle statt single: einen Beitrag, den es nicht (mehr) gibt, meldet
// die Datenbank sonst als Fehler - und der Bildschirm zeigte "Laden
// fehlgeschlagen", wo "gibt es nicht" die Wahrheit ist. Welche Zeilen
// ueberhaupt sichtbar sind, entscheidet RLS: ohne published_at kommt hier
// nichts zurueck.
export function useNewsPost(slug: string | undefined) {
  return useQuery({
    queryKey: ['news_post', slug],
    enabled: Boolean(slug),
    queryFn: async (): Promise<NewsPost | null> => {
      const { data, error } = await supabase
        .from('news_posts')
        .select('*')
        .eq('slug', slug!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Titel, Anriss und Text speichern. Ohne Admin-Rolle aendert RLS still keine
 * Zeile. Darum wird die Zeile zurueckgelesen: "nichts geaendert" ist ein Fehler.
 */
export function useUpdateNewsPost(post: Pick<NewsPost, 'id' | 'slug'>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: NewsValues) => {
      const { data, error } = await supabase
        .from('news_posts')
        .update({ title: values.title, excerpt: values.excerpt || null, body_md: values.body })
        .eq('id', post.id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('news_post_not_updated');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['news_post', post.slug] });
      void queryClient.invalidateQueries({ queryKey: ['news_posts'] });
    },
  });
}
