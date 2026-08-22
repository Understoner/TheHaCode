import { describe, expect, it } from 'vitest';

import { parseInline, parseMarkdown } from '@/features/news/markdown';

describe('parseMarkdown', () => {
  it('fasst aufeinanderfolgende Zeilen zu einem Absatz zusammen', () => {
    const blocks = parseMarkdown('Erste Zeile\nzweite Zeile\n\nNeuer Absatz');

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      kind: 'paragraph',
      spans: [{ kind: 'text', text: 'Erste Zeile zweite Zeile' }],
    });
  });

  it('erkennt Zwischentitel auf zwei Ebenen', () => {
    const blocks = parseMarkdown('## Gross\n\n### Klein');

    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'heading']);
    expect(blocks[0]).toMatchObject({ level: 2 });
    expect(blocks[1]).toMatchObject({ level: 3 });
  });

  it('sammelt Aufzaehlungen in einem Block', () => {
    const blocks = parseMarkdown('- eins\n- zwei\n- drei');

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: 'list' });
    expect(blocks[0]).toHaveProperty('items.length', 3);
  });

  it('beendet einen Absatz, wenn direkt danach eine Aufzaehlung beginnt', () => {
    // Ohne Leerzeile dazwischen - im Studio tippt das niemand sauber.
    const blocks = parseMarkdown('Dazu gehoert:\n- eins\n- zwei');

    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'list']);
  });

  it('liest Bilder samt Form aus dem Titel-Attribut', () => {
    const blocks = parseMarkdown('![Michael](team/foto.jpg "portrait")');

    expect(blocks[0]).toEqual({
      kind: 'image',
      alt: 'Michael',
      path: 'team/foto.jpg',
      shape: 'portrait',
    });
  });

  it('nimmt fuer Bilder ohne Angabe das Cover-Format', () => {
    const blocks = parseMarkdown('![Lunge](news/lunge.jpg)');

    expect(blocks[0]).toMatchObject({ shape: 'wide' });
  });

  it('faellt bei einer unbekannten Form auf das Cover-Format zurueck statt zu brechen', () => {
    const blocks = parseMarkdown('![Lunge](news/lunge.jpg "riesig")');

    expect(blocks[0]).toMatchObject({ shape: 'wide' });
  });

  it('erkennt Zitate und Trennlinien', () => {
    const blocks = parseMarkdown('> Ein Satz\n> geht weiter\n\n---');

    expect(blocks[0]).toMatchObject({ kind: 'quote' });
    expect(blocks[0]).toHaveProperty('spans.0.text', 'Ein Satz geht weiter');
    expect(blocks[1]).toEqual({ kind: 'rule' });
  });

  it('ignoriert Leerzeilen am Anfang und Ende', () => {
    expect(parseMarkdown('\n\nText\n\n\n')).toHaveLength(1);
  });
});

describe('parseInline', () => {
  it('trennt Fettes vom Fliesstext', () => {
    expect(parseInline('ganz **wichtig** hier')).toEqual([
      { kind: 'text', text: 'ganz ' },
      { kind: 'strong', text: 'wichtig' },
      { kind: 'text', text: ' hier' },
    ]);
  });

  it('liest Links mit Text und Ziel', () => {
    expect(parseInline('siehe [Kurse](/kurse)')).toEqual([
      { kind: 'text', text: 'siehe ' },
      { kind: 'link', text: 'Kurse', href: '/kurse' },
    ]);
  });

  it('laesst Sternchen in Fliesstext in Ruhe', () => {
    expect(parseInline('4 * 4 Sekunden')).toEqual([{ kind: 'text', text: '4 * 4 Sekunden' }]);
  });
});
