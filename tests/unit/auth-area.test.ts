import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { AuthArea } from '@/src/components/AuthArea';

// Navbar auth corner: logged-out users get an offline badge plus a way back
// to login; logged-in users see their account (phone for SMS users, email for
// Google users) plus sign out.
describe('AuthArea', () => {
  it('logged-out shows offline badge and the login button', () => {
    const html = renderToString(
      createElement(AuthArea, {
        status: 'logged-out',
        onSignIn: () => undefined,
        onSignOut: () => undefined,
      }),
    );
    expect(html).toContain('حالت آفلاین');
    expect(html).toContain('ورود به حساب');
    expect(html).not.toContain('خروج از حساب');
  });

  it('logged-in shows the account email and sign out', () => {
    const html = renderToString(
      createElement(AuthArea, {
        status: 'logged-in',
        email: 'tech@example.com',
        onSignIn: () => undefined,
        onSignOut: () => undefined,
      }),
    );
    expect(html).toContain('tech@example.com');
    expect(html).toContain('خروج از حساب');
    expect(html).not.toContain('حالت آفلاین');
  });

  it('logged-in SMS user shows the phone number instead of an email', () => {
    const html = renderToString(
      createElement(AuthArea, {
        status: 'logged-in',
        email: 'sms+9121234567@phone.aqualedger.app',
        phone: '+989121234567',
        onSignIn: () => undefined,
        onSignOut: () => undefined,
      }),
    );
    expect(html).toContain('۰۹۱۲ ۱۲۳ ۴۵۶۷');
    expect(html).not.toContain('sms+9121234567@phone.aqualedger.app');
    expect(html).toContain('خروج از حساب');
  });

  it('logged-in without an email still shows sign out', () => {
    const html = renderToString(
      createElement(AuthArea, {
        status: 'logged-in',
        email: null,
        onSignIn: () => undefined,
        onSignOut: () => undefined,
      }),
    );
    expect(html).toContain('خروج از حساب');
  });

  it('wires actions without firing on render', () => {
    const onSignIn = vi.fn();
    const onSignOut = vi.fn();
    const outHtml = renderToString(
      createElement(AuthArea, { status: 'logged-out', onSignIn, onSignOut }),
    );
    expect((outHtml.match(/<button/g) ?? []).length).toBe(1);
    const inHtml = renderToString(
      createElement(AuthArea, { status: 'logged-in', email: 'a@b.c', onSignIn, onSignOut }),
    );
    expect((inHtml.match(/<button/g) ?? []).length).toBe(1);
    expect(onSignIn).not.toHaveBeenCalled();
    expect(onSignOut).not.toHaveBeenCalled();
  });
});
