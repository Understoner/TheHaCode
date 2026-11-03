import { createElement } from 'react';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { PressableRing } from '@/components/PressableRing';
import { QueryBoundary } from '@/components/QueryBoundary';
import { StateMessage } from '@/components/StateMessage';
import { PageColumn } from '@/design/PageColumn';
import { displayFont } from '@/design/responsive';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { Markdown } from '@/features/news/Markdown';
import { openExternalUrl } from '@/lib/externalLink';
import { AudioPlayer } from './AudioPlayer';
import { KindIcon } from './KindIcon';
import { LaterPicker } from './LaterPicker';
import { QuizBlock } from './QuizBlock';
import { orderBlocks } from './courseLogic';
import { blockHref, courseHref } from './OnlineCourseView';
import {
  useBlockContent,
  useCanOpenCourse,
  useCourseProgress,
  useMarkBlock,
  useMediaUrl,
  type CourseWithBlocks,
  type OnlineBlock,
  type OnlineBlockContent,
} from './useOnlineCourses';

// Ein Block eines Onlinekurses (V1.2, SAD §11.2, Schritt 5).
//
// Der Inhalt kommt aus online_course_block_contents und damit nur, wenn
// can_open_course() ja sagt (RLS). Ohne Zugang zeigt die Seite den Weg zur
// Kursseite statt eines Fehlers.
//
// Erledigt wird ein Block am Ende eines Videos oder einer Aufnahme, beim
// Herunterladen einer PDF oder per Knopf. Ohne Konto wird nichts gespeichert
// (Entscheidung 03.11.2026) - das sagt die Seite auch.

export function OnlineBlockView({ data, blockId }: { data: CourseWithBlocks; blockId: string }) {
  const { t } = useTranslation();
  const { course } = data;
  const blocks = orderBlocks(data.blocks);
  const index = blocks.findIndex((b) => b.id === blockId);
  const block = blocks[index];
  const { session } = useAuth();
  const open = useCanOpenCourse(course.id);
  const content = useBlockContent(block?.id, open.data === true);
  const progress = useCourseProgress(course.id);
  const mark = useMarkBlock(course.id);

  if (!block) {
    return (
      <StateMessage title={t('onlineCourses.block.missingTitle')} body={t('onlineCourses.block.missingHint')} />
    );
  }

  const done = progress.data?.has(block.id) ?? false;
  const loggedIn = Boolean(session);
  const prev = blocks[index - 1];
  const next = blocks[index + 1];
  const markDone = () => {
    if (loggedIn && !done && block.kind !== 'quiz') mark.mutate({ blockId: block.id, done: true });
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <PageColumn gap={spacing.lg}>
        <View style={styles.column}>
          <Link href={courseHref(course.slug)} style={styles.back}>
            {t('onlineCourses.block.back', { title: course.title })}
          </Link>
          <View style={styles.head}>
            <KindIcon kind={block.kind} size={44} />
            <View style={styles.headText}>
              <Text style={styles.eyebrow}>
                {t('onlineCourses.block.position', { index: index + 1, total: blocks.length })} ·{' '}
                {t('onlineCourses.day', { day: block.day_offset + 1 })} · {t(`onlineCourses.kind.${block.kind}`)}
              </Text>
              <Text style={styles.title} role="heading" aria-level={1} {...displayFont}>
                {block.title}
              </Text>
            </View>
          </View>
          {block.summary ? <Text style={styles.summary}>{block.summary}</Text> : null}

          {open.isPending ? null : open.data !== true ? (
            <StateMessage
              title={t(`onlineCourses.block.locked.${course.access}`)}
              body={t('onlineCourses.block.lockedHint')}
            />
          ) : block.kind === 'quiz' ? (
            loggedIn ? (
              <QuizBlock courseId={course.id} blockId={block.id} passPercent={course.pass_percent} passedBefore={done} />
            ) : (
              <StateMessage title={t('onlineCourses.quiz.loginTitle')} body={t('onlineCourses.quiz.loginHint')} />
            )
          ) : (
            <QueryBoundary query={content}>
              {(c) =>
                c ? (
                  <BlockBody block={block} content={c} onFinished={markDone} />
                ) : (
                  <StateMessage title={t('onlineCourses.block.emptyTitle')} body={t('onlineCourses.block.emptyHint')} />
                )
              }
            </QueryBoundary>
          )}

          {open.data === true && !loggedIn ? (
            <View style={styles.guest}>
              <Text style={styles.guestText}>{t('onlineCourses.block.guestHint')}</Text>
              <Link href="/konto?modus=registrieren" style={styles.link}>
                {t('onlineCourses.panel.register')}
              </Link>
            </View>
          ) : null}

          {open.data === true && loggedIn && !done ? <LaterPicker courseId={course.id} blockId={block.id} /> : null}

          <View style={styles.foot}>
            {open.data === true && loggedIn && block.kind !== 'quiz' ? (
              done ? (
                <PressableRing
                  style={styles.doneChip}
                  onPress={() => mark.mutate({ blockId: block.id, done: false })}
                  aria-label={t('onlineCourses.block.undo')}
                >
                  <Text style={styles.doneText}>{t('onlineCourses.block.isDone')}</Text>
                </PressableRing>
              ) : (
                <Button
                  label={mark.isPending ? t('onlineCourses.block.saving') : t('onlineCourses.block.markDone')}
                  disabled={mark.isPending}
                  onPress={markDone}
                />
              )
            ) : (
              <View />
            )}
            <View style={styles.nav}>
              {prev ? (
                <Link href={blockHref(course.slug, prev.id)} style={styles.link}>
                  {t('onlineCourses.block.prev')}
                </Link>
              ) : null}
              {next ? (
                <Link href={blockHref(course.slug, next.id)} style={styles.link}>
                  {t('onlineCourses.block.next')}
                </Link>
              ) : null}
            </View>
          </View>
          {mark.isError ? <Text style={styles.error}>{t('onlineCourses.block.saveFailed')}</Text> : null}
        </View>
      </PageColumn>
    </ScrollView>
  );
}

function BlockBody({
  block,
  content,
  onFinished,
}: {
  block: OnlineBlock;
  content: OnlineBlockContent;
  onFinished: () => void;
}) {
  switch (block.kind) {
    case 'text':
      return (
        <View style={styles.body}>
          <BlockImage path={content.image_path} label={block.title} />
          {content.body_md ? <Markdown source={content.body_md} /> : null}
        </View>
      );
    case 'audio':
      return (
        <View style={styles.body}>
          <AudioBlock key={block.id} block={block} content={content} onFinished={onFinished} />
          {content.body_md ? <Markdown source={content.body_md} /> : null}
        </View>
      );
    case 'pdf':
      return <PdfBlock block={block} content={content} onFinished={onFinished} />;
    case 'video':
      return (
        <View style={styles.body}>
          <VideoBlock content={content} title={block.title} />
          {content.body_md ? <Markdown source={content.body_md} /> : null}
        </View>
      );
    case 'quiz':
      // Das Quiz rendert OnlineBlockView selbst (QuizBlock), ohne Inhaltszeile.
      return null;
  }
}

function AudioBlock({ block, content, onFinished }: { block: OnlineBlock; content: OnlineBlockContent; onFinished: () => void }) {
  const url = useMediaUrl(content.audio_path);
  return (
    <AudioPlayer
      src={url.data ?? null}
      title={block.title}
      durationSec={block.duration_sec}
      onEnded={onFinished}
      onRetry={() => void url.refetch()}
    />
  );
}

function PdfBlock({ block, content, onFinished }: { block: OnlineBlock; content: OnlineBlockContent; onFinished: () => void }) {
  const { t } = useTranslation();
  const fileName = content.pdf_path?.split('/').pop() ?? 'unterlage.pdf';
  const url = useMediaUrl(content.pdf_path, fileName);

  if (!content.pdf_path) {
    return <StateMessage title={t('onlineCourses.block.pdfMissingTitle')} body={t('onlineCourses.block.pdfMissingHint')} />;
  }

  return (
    <View style={styles.body}>
      {content.body_md ? <Markdown source={content.body_md} /> : null}
      <View style={styles.pdfCard}>
        <KindIcon kind="pdf" />
        <View style={styles.headText}>
          <Text style={styles.pdfName}>{block.title}</Text>
          <Text style={styles.summary}>{t('onlineCourses.block.pdfKeep')}</Text>
        </View>
      </View>
      {url.isError ? (
        <StateMessage
          title={t('onlineCourses.block.pdfFailedTitle')}
          body={t('onlineCourses.block.pdfFailedHint')}
          actionLabel={t('onlineCourses.audio.retry')}
          onAction={() => void url.refetch()}
        />
      ) : (
        <Button
          label={url.isPending ? t('onlineCourses.block.preparing') : t('onlineCourses.block.download')}
          disabled={!url.data}
          onPress={() => {
            if (!url.data) return;
            openExternalUrl(url.data);
            onFinished();
          }}
        />
      )}
    </View>
  );
}

function BlockImage({ path, label }: { path: string | null; label: string }) {
  const url = useMediaUrl(path);
  if (!path || !url.data) return null;
  return <Image source={{ uri: url.data }} accessibilityLabel={label} style={styles.image} resizeMode="cover" />;
}

/**
 * Vimeo-Player mit dnt=1 (keine Wiedererkennungs-Cookies, Datenschutz
 * Fassung 8). Nur im Web: der statische Export ist eine Web-App (SAD §0).
 * Das Ende eines eingebetteten Videos meldet Vimeo nur ueber seine
 * Player-API; ohne zusaetzliche Bibliothek wird ein Video deshalb per Knopf
 * erledigt.
 */
function VideoBlock({ content, title }: { content: OnlineBlockContent; title: string }) {
  const { t } = useTranslation();
  if (content.video_provider !== 'vimeo' || !content.video_external_id) {
    return <StateMessage title={t('onlineCourses.block.videoMissingTitle')} body={t('onlineCourses.block.videoMissingHint')} />;
  }
  if (Platform.OS !== 'web') return null;

  const params = new URLSearchParams({ dnt: '1', title: '0', byline: '0', portrait: '0' });
  if (content.video_hash) params.set('h', content.video_hash);
  const src = `https://player.vimeo.com/video/${encodeURIComponent(content.video_external_id)}?${params.toString()}`;

  return (
    <View style={styles.video}>
      {createElement('iframe', {
        src,
        title,
        allow: 'fullscreen; picture-in-picture',
        allowFullScreen: true,
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.xl, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  column: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.md },
  back: { fontSize: 15, fontWeight: '600', color: colors.ocean700 },
  head: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.sage700 },
  title: { fontSize: 28, lineHeight: 34, color: colors.ink900 },
  summary: { fontSize: 15, lineHeight: 22, color: colors.ink700 },
  body: { gap: spacing.md },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md },
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    position: 'relative',
  },
  pdfCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pdfName: { fontSize: 15, fontWeight: '600', color: colors.ink900 },
  guest: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  guestText: { fontSize: 14, lineHeight: 21, color: colors.ink700 },
  foot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  nav: { flexDirection: 'row', gap: spacing.lg },
  link: { fontSize: 15, fontWeight: '600', color: colors.ocean700 },
  doneChip: {
    borderWidth: 1,
    borderColor: colors.sage700,
    borderRadius: radius.full,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  doneText: { fontSize: 14, fontWeight: '700', color: colors.sage700 },
  error: { fontSize: 14, color: colors.danger },
});
