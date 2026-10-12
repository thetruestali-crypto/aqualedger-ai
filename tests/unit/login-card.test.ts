import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { LoginCard } from '@/src/components/LoginView';

// Persian Google-OAuth login card: standard button + loading/error states +
// an offline escape hatch so the offline-first ledger never gets locked out.
describe('LoginCard', () => {
  it('shows the Google button and the offline fallback', () => {
    const html = renderToString(
      createElement(LoginCard, {
        loading: false,
        error: null,
        onGoogleSignIn: () => undefined,
        onContinueOffline: () => undefined,
      }),
    );
    expect(html).toContain('ورود با حساب گوگل');
    expect(html).toContain('ادامه بدون ورود');
  });

  it('shows a loading state while redirecting to Google', () => {
    const html = renderToString(
      createElement(LoginCard, {
        loading: true,
        error: null,
        onGoogleSignIn: () => undefined,
        onContinueOffline: () => undefined,
      }),
    );
    expect(html).toContain('در حال ورود');
    expect(html).toContain('disabled');
  });

  it('surfaces sign-in errors in Persian', () => {
    const html = renderToString(
      createElement(LoginCard, {
        loading: false,
        error: 'ورود ناموفق بود',
        onGoogleSignIn: () => undefined,
        onContinueOffline: () => undefined,
      }),
    );
    expect(html).toContain('ورود ناموفق بود');
    expect(html).toContain('role="alert"');
  });

  it('wires both actions without firing on render', () => {
    const onGoogleSignIn = vi.fn();
    const onContinueOffline = vi.fn();
    const html = renderToString(
      createElement(LoginCard, { loading: false, error: null, onGoogleSignIn, onContinueOffline }),
    );
    expect((html.match(/<button/g) ?? []).length).toBe(2);
    expect(onGoogleSignIn).not.toHaveBeenCalled();
    expect(onContinueOffline).not.toHaveBeenCalled();
  });
});
