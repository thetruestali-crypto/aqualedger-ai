import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SmsLoginForm } from '@/src/components/SmsLoginForm';

// Persian SMS login form: two stages (phone -> code), a masked phone in stage
// two, a resend countdown and accessible error/status regions.
const noop = () => undefined;

function render(props: Partial<React.ComponentProps<typeof SmsLoginForm>> = {}): string {
  return renderToString(
    createElement(SmsLoginForm, {
      stage: 'phone',
      phone: '',
      code: '',
      loading: false,
      error: null,
      info: null,
      cooldownSeconds: 0,
      onPhoneChange: noop,
      onCodeChange: noop,
      onRequest: noop,
      onVerify: noop,
      onResend: noop,
      onBack: noop,
      ...props,
    }),
  );
}

describe('SmsLoginForm', () => {
  it('stage one asks for the phone number', () => {
    const html = render();
    expect(html).toContain('شمارهٔ موبایل');
    expect(html).toContain('ارسال کد تأیید');
    expect(html).toContain('شماره را با ۰۹ شروع کنید.');
    expect(html).toContain('type="tel"');
    expect(html).not.toContain('تأیید و ورود');
  });

  it('stage two asks for the code and shows the masked phone', () => {
    const html = render({ stage: 'code', phone: '09121234567', code: '123' });
    expect(html).toContain('تأیید و ورود');
    expect(html).toContain('۰۹۱۲ *** ۴۵۶۷');
    expect(html).toContain('۱۲۳');
    expect(html).toContain('تغییر شماره');
  });

  it('shows the resend countdown and disables the button', () => {
    const html = render({ stage: 'code', phone: '09121234567', cooldownSeconds: 42 });
    expect(html).toContain('ارسال مجدد تا ۴۲ ثانیه دیگر');
    expect(html).toContain('disabled');
  });

  it('enables the resend button when the cooldown is over', () => {
    const html = render({ stage: 'code', phone: '09121234567', cooldownSeconds: 0 });
    expect(html).toContain('ارسال مجدد کد');
  });

  it('renders errors in an alert region and info in a status region', () => {
    const errorHtml = render({ error: 'شمارهٔ موبایل معتبر نیست.' });
    expect(errorHtml).toContain('role="alert"');
    expect(errorHtml).toContain('شمارهٔ موبایل معتبر نیست.');

    const infoHtml = render({ info: 'کد تأیید ارسال شد.' });
    expect(infoHtml).toContain('role="status"');
    expect(infoHtml).toContain('کد تأیید ارسال شد.');
  });

  it('never fires the handlers on render', () => {
    const onRequest = vi.fn();
    const onVerify = vi.fn();
    const onResend = vi.fn();
    const onBack = vi.fn();
    render({ onRequest, onVerify, onResend, onBack });
    expect(onRequest).not.toHaveBeenCalled();
    expect(onVerify).not.toHaveBeenCalled();
    expect(onResend).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });
});
