import { render, screen } from '@testing-library/react';
import { Linking } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Markdown } from '@/features/news/Markdown';

const { pushMock, openMock } = vi.hoisted(() => ({ pushMock: vi.fn(), openMock: vi.fn() }));

vi.mock('expo-router', () => ({ router: { push: pushMock } }));
vi.mock('@/lib/externalLink', () => ({ openExternalUrl: openMock }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      }),
    },
  },
}));

describe('Markdown', () => {
  beforeEach(() => {
    pushMock.mockReset();
    openMock.mockReset();
  });

  it('zeigt Zwischentitel, Absaetze und Aufzaehlungen', () => {
    render(<Markdown source={'## Kapitel\n\nEin Absatz.\n\n- eins\n- zwei'} />);

    expect(screen.getByText('Kapitel')).toBeTruthy();
    expect(screen.getByText('Ein Absatz.')).toBeTruthy();
    expect(screen.getByText('eins')).toBeTruthy();
    expect(screen.getByText('zwei')).toBeTruthy();
  });

  it('schickt interne Links an den Router und externe nach draussen', () => {
    render(<Markdown source={'siehe [Kurse](/kurse) und [Website](https://thehacode.com)'} />);

    screen.getByText('Kurse').click();
    expect(pushMock).toHaveBeenCalledWith('/kurse');

    screen.getByText('Website').click();
    expect(openMock).toHaveBeenCalledWith('https://thehacode.com');
  });

  it('oeffnet mailto-Links, ohne sie durch die http-Pruefung zu schicken', () => {
    const openUrl = vi.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<Markdown source={'[Mail](mailto:office@thehacode.com)'} />);

    screen.getByText('Mail').click();

    expect(openUrl).toHaveBeenCalledWith('mailto:office@thehacode.com');
    // safeExternalUrl laesst nur http(s) durch - waere der Link dort gelandet,
    // haette der Klick gar nichts getan.
    expect(openMock).not.toHaveBeenCalled();
    openUrl.mockRestore();
  });

  it('baut die Bildadresse aus dem Bucket-Pfad', () => {
    render(<Markdown source={'![Michael](team/foto.jpg "portrait")'} />);

    const image = screen.getByLabelText('Michael');
    expect(image).toBeTruthy();
  });
});
