import { router } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { CoverImage } from '@/components/CoverImage';
import { colors, radius, spacing } from '@/design/tokens';
import { openExternalUrl } from '@/lib/externalLink';
import { parseMarkdown, type Block, type Inline } from '@/features/news/markdown';

// Stellt dar, was markdown.ts gelesen hat. Die Trennung ist Absicht: das Lesen
// ist reine Logik und laesst sich ohne DOM testen, das Zeichnen braucht React.

// mailto und tel gehen absichtlich NICHT durch safeExternalUrl - die Funktion
// laesst nur http(s) durch, und das zu Recht (dort landen Redaktionsfelder aus
// dem Studio). Hier ist die Pruefung stattdessen eng: eine Adresse ohne
// Leerzeichen und ohne Anfuehrungszeichen, sonst passiert nichts.
const MAIL_OR_PHONE = /^(mailto:[^\s"'<>]+|tel:\+?[\d\s-]+)$/;

function follow(href: string) {
  if (href.startsWith('/')) {
    router.push(href as Parameters<typeof router.push>[0]);
    return;
  }
  if (MAIL_OR_PHONE.test(href)) {
    void Linking.openURL(href);
    return;
  }
  openExternalUrl(href);
}

function Spans({ spans }: { spans: Inline[] }) {
  return (
    <>
      {spans.map((span, i) => {
        if (span.kind === 'strong') {
          return (
            <Text key={i} style={styles.strong}>
              {span.text}
            </Text>
          );
        }
        if (span.kind === 'link') {
          return (
            <Text key={i} style={styles.link} onPress={() => follow(span.href)} role="link">
              {span.text}
            </Text>
          );
        }
        return <Text key={i}>{span.text}</Text>;
      })}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'heading':
      return (
        <Text
          style={block.level === 2 ? styles.h2 : styles.h3}
          role="heading"
          aria-level={block.level}
        >
          <Spans spans={block.spans} />
        </Text>
      );

    case 'paragraph':
      return (
        <Text style={styles.paragraph}>
          <Spans spans={block.spans} />
        </Text>
      );

    case 'list':
      return (
        <View style={styles.list}>
          {block.items.map((item, i) => (
            <View key={i} style={styles.listItem}>
              {/* Der Punkt steht in einer eigenen Spalte, sonst rutscht die
                  zweite Zeile eines Eintrags unter das Zeichen. */}
              <Text style={styles.bullet}>·</Text>
              <Text style={styles.paragraph}>
                <Spans spans={item} />
              </Text>
            </View>
          ))}
        </View>
      );

    case 'quote':
      return (
        <View style={styles.quote}>
          <Text style={styles.quoteText}>
            <Spans spans={block.spans} />
          </Text>
        </View>
      );

    case 'image':
      return (
        <CoverImage
          path={block.path}
          label={block.alt}
          tone="sage"
          style={[styles.image, SHAPE_STYLE[block.shape]]}
        />
      );

    case 'rule':
      return <View style={styles.rule} />;
  }
}

export function Markdown({ source }: { source: string }) {
  return (
    <View style={styles.container}>
      {parseMarkdown(source).map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </View>
  );
}

// Hoch- und Quadratformate bekommen eine Obergrenze: ueber die volle
// Spaltenbreite gezogen waere ein Schaubild 730 Pixel hoch und schoebe den
// Text, der es erklaert, vom Bildschirm.
const SHAPE_STYLE = StyleSheet.create({
  wide: { aspectRatio: 16 / 9 },
  square: { aspectRatio: 1, maxWidth: 520, alignSelf: 'center' },
  portrait: { aspectRatio: 3 / 4, maxWidth: 420, alignSelf: 'center' },
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  h2: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '600',
    color: colors.ink900,
    marginTop: spacing.md,
  },
  h3: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '600',
    color: colors.ink900,
    marginTop: spacing.sm,
  },
  paragraph: {
    flex: 1,
    fontSize: 16,
    lineHeight: 27,
    color: colors.ink700,
  },
  strong: {
    fontWeight: '600',
    color: colors.ink900,
  },
  link: {
    fontWeight: '600',
    color: colors.ocean700,
  },
  list: {
    gap: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bullet: {
    fontSize: 16,
    lineHeight: 27,
    color: colors.sage700,
  },
  // Zitate stehen hinter einer 1-px-Linie statt in einem Kasten - dieselbe
  // Regel wie ueberall: Abgrenzung ueber Linien und Weissraum, kein Schatten.
  quote: {
    borderLeftWidth: 2,
    borderLeftColor: colors.sage500,
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
  },
  quoteText: {
    fontSize: 17,
    lineHeight: 28,
    color: colors.ink900,
  },
  image: {
    width: '100%',
    borderRadius: radius.md,
  },
  rule: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: spacing.sm,
  },
});
