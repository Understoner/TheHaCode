import { render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { ErrorBoundary } from './ErrorBoundary';

function Kaputt({ wirft }: { wirft: boolean }) {
  if (wirft) throw new Error('boom');
  return <Text>Inhalt</Text>;
}

describe('ErrorBoundary', () => {
  // React meldet den gefangenen Fehler zusaetzlich selbst in der Konsole.
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('zeigt die Kinder, solange nichts wirft', () => {
    render(
      <ErrorBoundary>
        <Kaputt wirft={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Inhalt')).toBeTruthy();
  });

  // Der Fall, um den es geht: ohne Grenze waere die Seite weiss.
  it('zeigt statt einer weissen Seite eine Meldung mit Handlungsoption', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <Kaputt wirft />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Hier ist etwas schiefgegangen')).toBeTruthy();
    expect(screen.getByText('Seite neu laden')).toBeTruthy();
    expect(screen.getByText('office@thehacode.com', { exact: false })).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  // Wer ueber die Navigation woanders hingeht, soll nicht auf der Meldung
  // der alten Seite sitzen bleiben.
  it('versucht es nach einem Seitenwechsel neu', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/kaputt">
        <Kaputt wirft />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();

    rerender(
      <ErrorBoundary resetKey="/heil">
        <Kaputt wirft={false} />
      </ErrorBoundary>,
    );

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Inhalt')).toBeTruthy();
  });

  it('bleibt bei der Meldung, solange die Seite dieselbe ist', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/kaputt">
        <Kaputt wirft />
      </ErrorBoundary>,
    );

    rerender(
      <ErrorBoundary resetKey="/kaputt">
        <Kaputt wirft />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
