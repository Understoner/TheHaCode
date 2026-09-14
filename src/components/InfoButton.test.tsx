import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import '@/i18n';
import de from '@/i18n/locales/de/common.json';
import { KONFIGURATOR_ABSCHNITTE } from '@/features/configurator/KonfiguratorHilfe';
import { PLAYER_ABSCHNITTE } from '@/features/sessions/PlayerHilfe';

import { InfoButton } from './InfoButton';

const texte = de as Record<string, string>;

function zeige() {
  render(
    <InfoButton
      label="Hilfe öffnen"
      titel="So geht es"
      abschnitte={[{ titel: 'Starten', text: 'Tippe auf Starten.' }]}
    />,
  );
}

function oeffnen() {
  fireEvent.click(screen.getByLabelText('Hilfe öffnen'));
}

describe('InfoButton', () => {
  it('zeigt die Hilfe erst nach dem Tippen auf das i', () => {
    zeige();
    expect(screen.queryByText('So geht es')).toBeNull();

    oeffnen();

    expect(screen.getByText('So geht es')).toBeTruthy();
    expect(screen.getByText('Tippe auf Starten.')).toBeTruthy();
  });

  it('verschwindet beim Tippen daneben', () => {
    zeige();
    oeffnen();

    fireEvent.click(screen.getByTestId('info-hintergrund'));

    expect(screen.queryByText('So geht es')).toBeNull();
  });

  // Scrollen und Lesen in der Karte darf sie nicht schliessen.
  it('bleibt offen beim Tippen in die Karte', () => {
    zeige();
    oeffnen();

    fireEvent.click(screen.getByText('Tippe auf Starten.'));

    expect(screen.getByText('So geht es')).toBeTruthy();
  });

  it('schliesst ueber den Knopf', () => {
    zeige();
    oeffnen();

    fireEvent.click(screen.getByText(texte['hilfe.schliessen']));

    expect(screen.queryByText('So geht es')).toBeNull();
  });
});

describe('Hilfetexte', () => {
  const vollstaendig = (bereich: string, anzahl: number) => {
    for (let n = 1; n <= anzahl; n += 1) {
      expect(texte[`hilfe.${bereich}.${n}.titel`], `hilfe.${bereich}.${n}.titel`).toBeTruthy();
      expect(texte[`hilfe.${bereich}.${n}.text`], `hilfe.${bereich}.${n}.text`).toBeTruthy();
    }
    // Ein Abschnitt mehr in der Uebersetzung als im Bauteil bliebe still
    // unsichtbar.
    expect(texte[`hilfe.${bereich}.${anzahl + 1}.titel`]).toBeUndefined();
  };

  it('hat jeden Abschnitt der Player-Hilfe vollstaendig', () => {
    vollstaendig('player', PLAYER_ABSCHNITTE);
  });

  it('hat jeden Abschnitt der Konfigurator-Hilfe vollstaendig', () => {
    vollstaendig('sequenz', KONFIGURATOR_ABSCHNITTE);
  });

  // Pflichtinhalt: ohne diesen Satz suchen Nutzer am stummgeschalteten iPhone
  // nach einem Fehler, den es nicht gibt.
  it('sagt in der Player-Hilfe, dass bei lautlos kein Ton kommt', () => {
    const alles = Object.entries(texte)
      .filter(([key]) => key.startsWith('hilfe.player.'))
      .map(([, text]) => text)
      .join(' ');

    expect(alles).toMatch(/lautlos/);
  });
});
