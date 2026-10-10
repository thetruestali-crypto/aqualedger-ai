import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { UpdateBanner } from '@/src/pwa/UpdateBanner';

// Phase-C: prompt-mode PWA update flow shows a Persian banner only when a new
// version is waiting; first paint stays clean for offline shell startup.
describe('UpdateBanner', () => {
  it('renders nothing before any update is waiting', () => {
    const html = renderToString(
      createElement(UpdateBanner, { visible: false, onUpdate: () => undefined }),
    );
    expect(html).toBe('');
  });

  it('shows the Persian update message and action when visible', () => {
    const html = renderToString(
      createElement(UpdateBanner, { visible: true, onUpdate: () => undefined }),
    );
    expect(html).toContain('نسخه جدید آماده است');
    expect(html).toContain('به‌روزرسانی');
    expect(html).toContain('role="alert"');
  });

  it('exposes exactly one update button without firing on render', () => {
    const onUpdate = vi.fn();
    const html = renderToString(createElement(UpdateBanner, { visible: true, onUpdate }));
    expect((html.match(/<button/g) ?? []).length).toBe(1);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
