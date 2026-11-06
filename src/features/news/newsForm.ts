// Formularregeln fuer das Bearbeiten eines News-Beitrags.

import { z } from 'zod';

export const newsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: 'errors:news.titleRequired' })
    .max(200, { error: 'errors:news.titleLong' }),
  excerpt: z.string().trim().max(600, { error: 'errors:news.excerptLong' }),
  body: z
    .string()
    .trim()
    .min(1, { error: 'errors:news.bodyRequired' })
    .max(50000, { error: 'errors:news.bodyLong' }),
});

export type NewsValues = z.infer<typeof newsSchema>;
