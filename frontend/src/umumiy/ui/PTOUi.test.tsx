import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PtoProgress, PtoStatusChip } from './PTOUi';

describe('PTO presentation primitives', () => {
  it('keeps unknown values explicit and text-readable', () => {
    render(<PtoStatusChip label="Narx nomaʼlum" tone="unknown" />);

    const chip = screen.getByRole('status', { name: 'Narx nomaʼlum' });
    expect(chip.textContent).toContain('Narx nomaʼlum');
    expect(chip.className).toContain('pto-status--unknown');
  });

  it('exposes progress to assistive technology without inventing a completed state', () => {
    render(<PtoProgress value={2} max={5} label="Import bosqichi" />);

    const progress = screen.getByRole('progressbar', { name: 'Import bosqichi' });
    expect(progress.getAttribute('aria-valuenow')).toBe('2');
    expect(progress.getAttribute('aria-valuemax')).toBe('5');
    expect(progress.textContent).toContain('40%');
  });
});
