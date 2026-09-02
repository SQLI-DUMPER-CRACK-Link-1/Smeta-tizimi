import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SystemControlCenter } from './SystemControlCenter';
import { SYSTEM_CONTROL_DEMO_DATA } from './SystemControlDemo';

function setup() {
  const actions = { onToggle: vi.fn(), onScopeChange: vi.fn(), onKill: vi.fn(), onRetry: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onCancel: vi.fn(), onIntegrationAction: vi.fn(), onIncidentAction: vi.fn() };
  render(<SystemControlCenter data={SYSTEM_CONTROL_DEMO_DATA} demo {...actions} />);
  return actions;
}
afterEach(cleanup);

describe('System Control Center visible product shell', () => {
  it('renders health status and marks demo data explicitly', () => {
    setup();
    expect(screen.getByText('Tizim boshqaruv markazi')).toBeTruthy();
    expect(screen.getByText('DEMO DATA')).toBeTruthy();
    expect(screen.getByTestId('health-database').textContent).toContain('SOG‘LOM');
    expect(screen.getByTestId('health-jobs').textContent).toContain('XATO');
  });

  it('changes capability ON/OFF state and scope through callbacks', () => {
    const actions = setup();
    fireEvent.click(screen.getByRole('button', { name: 'MODULLAR' }));
    const states = screen.getAllByLabelText('Capability state');
    fireEvent.change(states[0], { target: { value: 'off' } });
    expect(actions.onToggle).toHaveBeenCalledWith(expect.objectContaining({ capabilityId: 'storage-company-bind', state: 'off', scope: 'company' }));
    const scopes = screen.getAllByLabelText('Capability scope');
    fireEvent.change(scopes[0], { target: { value: 'global' } });
    expect(actions.onScopeChange).toHaveBeenCalledWith('storage-company-bind', 'global');
  });

  it('requires explicit confirmation before kill switch callback', () => {
    const actions = setup();
    fireEvent.click(screen.getByRole('button', { name: 'MODULLAR' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Kill' })[0]);
    expect(actions.onKill).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Tasdiqlash' })[0]);
    expect(actions.onKill).toHaveBeenCalledWith(expect.objectContaining({ id: 'storage-company-bind' }));
  });

  it('renders job states and retries a failed job', () => {
    const actions = setup();
    fireEvent.click(screen.getByRole('button', { name: 'ISHLAR / JOBS' }));
    expect(screen.getByText('Drive Reconciliation')).toBeTruthy();
    expect(screen.getByText('62%')).toBeTruthy();
    expect(screen.getByText('Report Generation')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }));
    expect(actions.onRetry).toHaveBeenCalledWith({ type: 'job', id: 'job-2039' });
  });

  it('renders a failed integration without pretending it is connected', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'INTEGRATSIYALAR' }));
    const didox = screen.getByTestId('integration-didox');
    expect(didox.textContent).toContain('Didox');
    expect(didox.textContent).toContain('XATO');
    expect(didox.textContent).toContain('Autentifikatsiya yangilanishi talab qilinadi');
  });

  it('renders and filters critical incidents', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'XATOLAR' }));
    expect(screen.getByText('DIDOX_AUTH_EXPIRED')).toBeTruthy();
    expect(screen.getByText('KRITIK')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Incident severity filter'), { target: { value: 'critical' } });
    expect(screen.getByText('DIDOX_AUTH_EXPIRED')).toBeTruthy();
    expect(screen.queryByText('OBJECT_STORAGE_NOT_PROVISIONED')).toBeNull();
  });

  it('expands audit old and new values', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'AUDIT' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Ko‘rish' })[0]);
    expect(screen.getByText(/Old:/)).toBeTruthy();
    expect(screen.getByText(/Yangi:/)).toBeTruthy();
  });
});
