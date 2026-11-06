import { describe, expect, it } from 'vitest';

import { newsSchema } from './newsForm';

const basis = { title: 'Titel', excerpt: '', body: 'Text' };

describe('newsSchema', () => {
  it('nimmt einen Beitrag ohne Anriss an', () => {
    expect(newsSchema.safeParse(basis).success).toBe(true);
  });
  it('verlangt Titel und Text', () => {
    expect(newsSchema.safeParse({ ...basis, title: '  ' }).success).toBe(false);
    expect(newsSchema.safeParse({ ...basis, body: '  ' }).success).toBe(false);
  });
  it('begrenzt die Laengen', () => {
    expect(newsSchema.safeParse({ ...basis, title: 'x'.repeat(201) }).success).toBe(false);
    expect(newsSchema.safeParse({ ...basis, excerpt: 'x'.repeat(601) }).success).toBe(false);
  });
});
