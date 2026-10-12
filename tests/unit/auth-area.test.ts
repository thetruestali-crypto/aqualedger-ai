import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { AuthArea } from '@/src/components/AuthArea';

// Navbar auth corner: logged-out users get an offline badge plus a way back
// to login; logged-in users see their email plus sign out.
describe('AuthArea', () => {
  it('logged-out shows offline badge and Google login button', () => {
    const html = renderToString(
      createElement(AuthArea, {
        status: 'logged-out',
        onSignIn: () => undefined,
        onSignOut: () => undefined,
      }),
    );
    expect(html).toContain('حالت آفلاین');
    expect(html).toContain('ورود با حساب گوگل');
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
