import {render, screen, fireEvent, cleanup, within} from '@testing-library/react';
import {afterEach, it, expect, vi} from 'vitest';
const state = vi.hoisted(() => ({tier: 'free', fail: false, save: vi.fn()}));
vi.mock('../lib/firebase', () => ({auth: {currentUser: {uid: 'test'}}, db: {}, getUserTier: async () => {if (state.fail) throw Error('offline'); return state.tier;}}));
vi.mock('firebase/firestore', () => ({doc: (_db: any, _col: string, id: string) => id, collection: vi.fn(), query: vi.fn(), where: vi.fn(), getDocs: async () => ({docs: []}), setDoc: (...args: any[]) => state.save(...args), getDoc: async () => ({exists: () => false})}));
vi.mock('../contexts/LanguageContext', () => ({useLanguage: () => ({lang: 'en', dir: 'ltr', t: (key: string) => ({pricing_stealth: 'Stealth', pricing_pro: 'Pro Analyst', pricing_enterprise: 'SOC Enterprise'}[key] || key)})}));
import Pricing from './Pricing';
afterEach(() => {cleanup(); state.tier = 'free'; state.fail = false; vi.clearAllMocks(); window.history.replaceState({}, '', '/');});
it('passes the selected currency and plan into checkout without submitting', async () => {
  render(<Pricing/>); await screen.findByRole('button', {name: 'Current plan'});
  fireEvent.click(screen.getByRole('button', {name: 'EGP'}));
  fireEvent.click(screen.getByRole('button', {name: 'Choose Pro Analyst'}));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getAllByText('300 EGP').length).toBeGreaterThan(0);
  expect(dialog.getByText('Pro Analyst')).toBeTruthy(); expect(state.save).not.toHaveBeenCalled();
});
it('does not claim payment success from a URL or a dismissed checkout', async () => {
  window.history.replaceState({}, '', '/?payment=success');
  render(<Pricing/>); await screen.findByRole('button', {name: 'Current plan'});
  expect(screen.queryByText('Subscription request received')).toBeNull();
  fireEvent.click(screen.getByRole('button', {name: 'Choose SOC Enterprise'}));
  fireEvent.click(screen.getByRole('button', {name: 'Close checkout'}));
  expect(screen.queryByText('Subscription request received')).toBeNull();
  expect(state.save).not.toHaveBeenCalled();
});
it('keeps the current plan unchanged after a request and blocks selection when the plan cannot load', async () => {
  state.save.mockResolvedValue(undefined);const view=render(<Pricing/>);await screen.findByRole('button',{name:'Current plan'});
  fireEvent.click(screen.getByRole('button',{name:'Choose Pro Analyst'}));fireEvent.click(screen.getByRole('button',{name:'Request subscription'}));await screen.findByText('REQUEST SAVED');
  fireEvent.click(screen.getByRole('button',{name:'Close checkout'}));expect(screen.getByText('Subscription request received')).toBeTruthy();expect(within(screen.getAllByRole('article')[0]).getByRole('button',{name:'Current plan'})).toBeTruthy();
  view.unmount();state.fail=true;render(<Pricing/>);await screen.findByRole('alert');expect((screen.getByRole('button',{name:'Choose Pro Analyst'}) as HTMLButtonElement).disabled).toBe(true);
});
