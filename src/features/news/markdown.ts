// Ein sehr kleiner Markdown-Leser - genug fuer redaktionelle Beitraege, und
// keine Zeile mehr.
//
// WARUM NICHT EINE BIBLIOTHEK
// ---------------------------
// CLAUDE.md verbietet neue Abhaengigkeiten ohne Ruecksprache, und die
// gaengigen Markdown-Pakete bringen einen HTML-Pfad mit, den React Native
// gar nicht rendern kann. Gebraucht wird hier ohnehin nur, was die Redaktion
// im Studio tippt: Zwischentitel, Absaetze, Aufzaehlungen, Zitate, Bilder.
//
// Was NICHT unterstuetzt wird, ist Absicht: Tabellen, verschachtelte Listen,
// Code, HTML. Wer das braucht, hat den falschen Ort gewaehlt.

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'link'; text: string; href: string };

export type Block =
  | { kind: 'heading'; level: 2 | 3; spans: Inline[] }
  | { kind: 'paragraph'; spans: Inline[] }
  | { kind: 'list'; items: Inline[][] }
  | { kind: 'quote'; spans: Inline[] }
  | { kind: 'image'; path: string; alt: string; shape: ImageShape }
  | { kind: 'rule' };

// Bilder tragen ihr Seitenverhaeltnis im Titel-Attribut: ![Alt](pfad "square").
// Ohne Angabe gilt 16:9 - das Format der Cover. Der Grund ist unangenehm
// praktisch: React Native braucht die Groesse VOR dem Laden, ein <img> im
// Browser nicht. Drei benannte Formen sind ehrlicher als eine geratene Hoehe.
export type ImageShape = 'wide' | 'square' | 'portrait';

const SHAPES: ImageShape[] = ['wide', 'square', 'portrait'];

// ![Alt](pfad) oder ![Alt](pfad "square") - allein auf einer Zeile.
const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)\s"]+)(?:\s+"([^"]*)")?\)$/;
const INLINE_TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

export function parseInline(text: string): Inline[] {
  const spans: Inline[] = [];

  for (const part of text.split(INLINE_TOKEN)) {
    if (!part) continue;

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      spans.push({ kind: 'strong', text: part.slice(2, -2) });
      continue;
    }

    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      spans.push({ kind: 'link', text: link[1], href: link[2] });
      continue;
    }

    spans.push({ kind: 'text', text: part });
  }

  return spans;
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');

  let paragraph: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];

  // Ein angefangener Absatz endet bei jeder Leerzeile und bei jedem Block
  // anderer Art - deshalb steht das Abschliessen an einer Stelle und nicht
  // an sechs.
  const flush = () => {
    if (paragraph.length) {
      blocks.push({ kind: 'paragraph', spans: parseInline(paragraph.join(' ')) });
      paragraph = [];
    }
    if (list.length) {
      blocks.push({ kind: 'list', items: list.map(parseInline) });
      list = [];
    }
    if (quote.length) {
      blocks.push({ kind: 'quote', spans: parseInline(quote.join(' ')) });
      quote = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flush();
      continue;
    }

    const image = IMAGE_LINE.exec(line);
    if (image) {
      flush();
      const shape = image[3] as ImageShape | undefined;
      blocks.push({
        kind: 'image',
        alt: image[1],
        path: image[2],
        shape: shape && SHAPES.includes(shape) ? shape : 'wide',
      });
      continue;
    }

    if (line === '---') {
      flush();
      blocks.push({ kind: 'rule' });
      continue;
    }

    if (line.startsWith('### ')) {
      flush();
      blocks.push({ kind: 'heading', level: 3, spans: parseInline(line.slice(4)) });
      continue;
    }

    if (line.startsWith('## ')) {
      flush();
      blocks.push({ kind: 'heading', level: 2, spans: parseInline(line.slice(3)) });
      continue;
    }

    if (line.startsWith('> ')) {
      if (paragraph.length || list.length) flush();
      quote.push(line.slice(2));
      continue;
    }

    if (line.startsWith('- ')) {
      if (paragraph.length || quote.length) flush();
      list.push(line.slice(2));
      continue;
    }

    if (list.length || quote.length) flush();
    paragraph.push(line);
  }

  flush();
  return blocks;
}
