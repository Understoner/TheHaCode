import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('zeigt das Label', () => {
    render(<Button label="Anmelden" onPress={() => {}} />);

    expect(screen.getByText('Anmelden')).toBeTruthy();
  });

  it('ruft onPress beim Klick auf', () => {
    const onPress = vi.fn();
    render(<Button label="Anmelden" onPress={onPress} />);

    fireEvent.click(screen.getByText('Anmelden'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
