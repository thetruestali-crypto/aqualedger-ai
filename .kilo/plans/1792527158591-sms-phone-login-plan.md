# افزودن ورود/ثبت‌نام با پیامک (SMS.ir) در کنار ورود با گوگل — AquaLedger AI

## 0. وضعیت اجرا (۱۴۰۴-۰۷-۲۹) — T1…T11 اجرا شده

همهٔ فایل‌های زیر در working tree موجود و با `npm run verify` (lint ✅ · 169 تست واحد در ۲۳ فایل ✅ ·
build ✅) و Playwright (spec صفحهٔ ورود ✅) اعتبارسنجی شده‌اند:

| بخش | فایل‌ها |
|---|---|
| داده | `supabase/migrations/0002_sms_auth.sql` |
| سرور | `server/smsAuth.ts`، `server/sms.ts`، `server/supabaseAdmin.ts`، `server/auth.ts`، `server/rateLimit.ts` |
| HTTP | `server.ts`، `netlify/functions/sms-request.ts`، `netlify/functions/sms-verify.ts` |
| کلاینت | `src/lib/phone.ts`، `src/lib/supabase.ts`، `src/state/auth.tsx`، `src/components/LoginView.tsx`، `src/components/SmsLoginForm.tsx`، `src/components/AuthArea.tsx`، `src/components/Navbar.tsx` |
| تست | `tests/unit/{phone,sms-client,sms-auth,sms-login-form,login-card,auth-area,supabase-client}.test.ts`، `tests/e2e-login/login-screen.spec.ts`، `playwright.login.config.ts` |
| مستندات | `README.md`، `docs/DECISIONS.md` (D27–D32)، `docs/PLAN.md` (Phase 9)، `docs/ARD.md`، `.env.example` |

### دو گام باقی‌مانده که باید توسط اپراتور انجام شود

**۱) ساخت فایل `.env` محلی (gitignore است و هرگز commit نشود)** — محتوای پیشنهادی:

```dotenv
# Supabase (برای اینکه ورود پیامکی سشن واقعی صادر کند لازم است)
SUPABASE_URL=""
SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
VITE_SUPABASE_URL=""
VITE_SUPABASE_ANON_KEY=""

# SMS.ir (فقط سرور)
SMSIR_API_KEY="<کلید پنل SMS.ir؛ این فایل ترکِ‌شده است، مقدار واقعی فقط در .env محلی و Netlify>"
SMSIR_TEMPLATE_ID=""      # قالب پنل (پیشنهادی)؛ خالی => bulk
SMSIR_SENDER=""           # خط ارسال bulk؛ خالی => کشف خودکار از /v1/line
SMSIR_CODE_PARAM="Code"
SMSIR_BASE_URL="https://api.sms.ir/v1"

SMS_OTP_SECRET="<یک رشتهٔ تصادفی طولانی، یکسان در همهٔ محیط‌ها>"
SMS_OTP_TTL_SECONDS="300"
SMS_OTP_LENGTH="5"
SMS_OTP_MAX_ATTEMPTS="3"
SMS_OTP_RESEND_SECONDS="60"
SMS_OTP_MAX_PER_HOUR_PER_PHONE="5"
SMS_OTP_MAX_PER_HOUR_PER_IP="20"
```

> ⚠️ **کلید پنل در گفتگو به‌صورت متن آشکار منتشر شده است**: پیش از production آن را در پنل SMS.ir
> **چرخش (rotate)** دهید و مقدار جدید را در Netlify (Site environment variables) و `.env` بگذارید.
> مقدار هرگز نباید در فایل ترک‌شدهٔ مخزن (مثل همین سند) نوشته شود.
> `IP Whitelist` پنل باید برای کلید Netlify **خاموش** باشد (IPهای Netlify پویا هستند).

**۲) سخت‌گیری اختیاری یک assertion در `tests/unit/sms-auth.test.ts`** (برای حذف flake ناچیز ~۰.۰۶٪):
به‌جای `expect(insert.code_hash).not.toContain(plainCode)` از بررسی قطعی HMAC استفاده شود:

```ts
expect(insert.code_hash).toBe(
  createHmac('sha256', 'test-otp-secret').update(plainCode).digest('hex'),
);
expect(insert.code_hash).not.toBe(plainCode);
```
(به ابتدای فایل `import { createHmac } from 'node:crypto';` اضافه شود.)

### گام‌های بعدی پس از تحویل

1. در پنل Supabase: `Authentication → Providers → Phone → Enable` (و اجرای `0002_sms_auth.sql`).
2. در Netlify: افزودن متغیرهای `SUPABASE_SERVICE_ROLE_KEY`، `SMSIR_API_KEY`، `SMS_OTP_SECRET`، `SMSIR_TEMPLATE_ID`.
3. چک‌لیست پذیرش README (§ 5) روی دامنهٔ واقعی: ارسال کد، ورود، نمایش شماره در نوار بالا، ۴۰۱ بدون توکن.

## 1. هدف

کاربر بتواند در صفحهٔ ورود انتخاب کند: **ورود با گوگل** (موجود) یا **ورود با شمارهٔ موبایل (پیامک)** (جدید).
کد تأیید توسط SMS.ir ارسال می‌شود، اعتبارسنجی سمت سرور انجام می‌گیرد و کاربر پیامکی یک **سشن واقعی Supabase**
می‌گیرد؛ بنابراین RLS، سهمیهٔ روزانهٔ AI (`ai_usage`)، دیتابیس محلی هر کاربر (`aqualedger_u_<id>`) و هدر
`Authorization` بدون هیچ تغییر معماری کار می‌کنند.

## 2. تصمیم‌های قطعی (با کاربر تأیید شده)

| # | تصمیم | چرا |
|---|--------|-----|
| D-1 | **هویت واقعی Supabase با شماره** — بک‌اند با `SUPABASE_SERVICE_ROLE_KEY` کاربر می‌سازد/پیدا می‌کند و سشن صادر می‌کند؛ کلاینت `setSession` می‌زند. | همهٔ زیرساخت موجود (RLS، سهمیهٔ AI، DB محلی هر کاربر) بدون تغییر کار می‌کند. |
| D-2 | **هر دو روش ارسال SMS.ir** پشتیبانی می‌شود: `/v1/send/verify` (اگر `SMSIR_TEMPLATE_ID` تنظیم باشد) و `/v1/send/bulk` (در غیر این صورت، با `SMSIR_SENDER`؛ اگر خالی باشد از `/v1/line` کشف می‌شود). | کار با هر پیکربندی پنل ممکن باشد. |
| D-3 | **ثبت‌نام خودکار + اتصال به حساب موجود**: اولین تأیید موفق برای شماره، حساب می‌سازد؛ اگر همان شماره روی حساب دیگری (مثلاً گوگل) ثبت شده باشد، به همان `user_id` وصل می‌شود. | یک کاربر = یک دیتابیس محلی، یک سهمیه، بدون دادهٔ تکراری. |

## 3. جریان کار (End-to-End)

```
کاربر → صفحهٔ ورود جدید → تب «ورود با شمارهٔ موبایل» → وارد کردن ۰۹۱۲…
   → POST /api/auth/sms/request  { phone }
        ├─ نرمال‌سازی به E.164 (+98912XXXXXXXX) + اعتبارسنجی موبایل ایرانی
        ├─ بررسی محدودیت‌ها: ۶۰ ثانیه کول‌داون، ۵ ارسال/ساعت/شماره، ۲۰ ارسال/ساعت/IP
        ├─ ساخت کد ۵ رقمی تصادفی (crypto.randomInt) → HMAC-SHA256 با SMS_OTP_SECRET
        ├─ ذخیره در public.sms_otp_challenges (TTL ۵ دقیقه، ۳ تلاش)
        └─ ارسال پیامک از طریق SMS.ir → پاسخ { ok:true, expiresIn:300, resendAfter:60 } (بدون افشای کد)
   → POST /api/auth/sms/verify  { phone, code }
        ├─ مصرف اتمیک کد (public.consume_sms_otp) → در صورت خطا attempts+1
        ├─ یافتن/ساخت کاربر Supabase برای شماره (phone identity؛ fallback به ایمیل ساینتتیک)
        ├─ چرخش رمز تصادفی (admin.updateUserById) → signInWithPassword → سشن واقعی
        └─ پاسخ { ok:true, accessToken, refreshToken, expiresAt, phone }
   → کلاینت: supabase.auth.setSession(...) → onAuthStateChange → session → باز شدن اپ
```

## 4. کارهای اجرایی (به ترتیب)

### T1 — ابزار خالص شمارهٔ موبایل (مشترک کلاینت/سرور)
**فایل جدید:** `src/lib/phone.ts` (خالص، بدون DOM/شبکه — مثل `src/lib/persianNumbers.ts`)
- `normalizeIranianPhone(raw: string): string | null` → `+98912XXXXXXXX` یا `null`
  - ارقام فارسی/عربی → ASCII (reuse `normalizePersianText`)، حذف فاصله/خط تیره/پرانتز
  - پذیرش: `09xxxxxxxxx`، `+989xxxxxxxxx`، `00989xxxxxxxxx`، `9xxxxxxxxx`، `912xxxxxxxx`
  - اعتبار: قالب `^09\d{9}$` (۱۰ رقم پس از صفر) + در صورت تمایل، بررسی پیش‌شمارهٔ اپراتور در یک ثابت واحد
    `IRANIAN_MOBILE_PREFIXES` (پیش‌فرض: هر `09…` معتبر پذیرفته شود تا شمارهٔ معتبر رد نشود)
- `formatIranianPhone(e164: string): string` → `۰۹۱۲ ۱۲۳ ۴۵۶۷` (ارقام فارسی)
- `maskPhone(e164: string): string` → `۰۹۱۲ *** ۴۵۶۷` (برای لاگ/نمایش)

### T2 — مهاجرت دیتابیس
**فایل جدید:** `supabase/migrations/0002_sms_auth.sql` (idempotent، هم‌سبک `0001_ai_usage.sql`)

```sql
create table if not exists public.sms_accounts (
  phone_e164   text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  identity_kind text not null default 'phone' check (identity_kind in ('phone','email')),
  email        text,
  created_at   timestamptz not null default now(),
  last_login_at timestamptz
);
create index if not exists sms_accounts_user_idx on public.sms_accounts (user_id);

create table if not exists public.sms_otp_challenges (
  id          uuid primary key default gen_random_uuid(),
  phone_e164  text not null,
  code_hash   text not null,            -- HMAC-SHA256(code, SMS_OTP_SECRET)
  attempts    integer not null default 0,
  max_attempts integer not null default 3,
  ip          text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz
);
create index if not exists sms_otp_challenges_phone_idx on public.sms_otp_challenges (phone_e164, created_at desc);
create index if not exists sms_otp_challenges_ip_idx    on public.sms_otp_challenges (ip, created_at desc);
```

RLS: روی هر دو جدول `enable row level security` + **بدون هیچ policy** (فقط `service_role`).
`revoke all on ... from anon, authenticated;` و `grant select, insert, update, delete on ... to service_role;`

توابع `security definer` (برای اجرا از طریق `supabase.rpc` با کلید service_role؛ `auth` schema در PostgREST منتشر نیست، پس باید در SQL انجام شود):

1. `public.find_user_by_phone(p_phone text) returns uuid` — `select id from auth.users where phone = p_phone order by created_at limit 1`
2. `public.sms_otp_stats(p_phone text, p_ip text) returns jsonb` — در ۱ ساعت گذشته: `phone_sends`، `ip_sends`، `phone_fails` (مجموع `attempts`) و **`phone_last_at`** (زمان آخرین چالش این شماره — برای کول‌داون ۶۰ ثانیه‌ای)
3. `public.consume_sms_otp(p_phone text, p_code_hash text) returns uuid` — **اتمیک**:
   `select ... where phone_e164=p_phone and code_hash=p_code_hash and consumed_at is null and expires_at > now() and attempts < max_attempts order by created_at desc limit 1 for update`
   → در صورت موفقیت `consumed_at = now()` و بازگرداندن `id`؛ در غیر این صورت `attempts = attempts + 1` روی تازه‌ترین چالش زنده و بازگرداندن `null`
4. `public.sms_account_upsert(p_phone text, p_user_id uuid, p_identity_kind text, p_email text)` — upsert نگاشت شماره→کاربر + `last_login_at`

همه: `revoke execute ... from public, anon, authenticated; grant execute ... to service_role;`

### T3 — کلاینت‌های سمت سرور
**فایل جدید:** `server/supabaseAdmin.ts`
- `getSupabaseEnv()` از `server/auth.ts` بازاستفاده شود (فقط `getServiceRoleKey()` اضافه شود: `SUPABASE_SERVICE_ROLE_KEY`)
- `getServiceClient()` → `createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })`
- `getPublicClient()` → `createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })` (برای `signInWithPassword`)

**فایل جدید:** `server/sms.ts` — کلاینت REST پنل SMS.ir (بدون SDK)
- `getSmsConfig()` → `{ apiKey, sender, templateId, codeParam, baseUrl }` از env
- `isSmsConfigured()` → `Boolean(apiKey)`
- `sendOtpSms(phoneE164, code)`:
  - اگر `templateId` → `POST {base}/send/verify` با `{ mobile, templateId, parameters: [{ name: codeParam, value: code }] }`
  - وگرنه → `POST {base}/send/bulk` با `{ lineNumber: Number(sender), messageText, mobiles: [national] }`
  - هدرها: `X-API-KEY`, `Content-Type: application/json`, `Accept: application/json`
  - شمارهٔ مقصد: فرمت ملی `09xxxxxxxxx`؛ در صورت خطای مربوط به فرمت شماره، **یک بار** با `+98...` تکرار شود
  - اگر `sender` خالی و `templateId` خالی → `GET {base}/line` و انتخاب اولین خط (cache در حافظهٔ همان اینستنس)
- نگاشت خطاها به فارسی: وضعیت‌های SMS.ir (`0` کلید نامعتبر، `10` کلید غیرفعال، `11` محدود به IP، `12` حساب غیرفعال، `13` …) + خطاهای HTTP (۴۰۱ کلید نامعتبر، ۴۲۹ محدودیت نرخ) → پیام فارسی روی کلاینت
- **هرگز** کلید API یا کد تأیید لاگ نشود.

### T4 — سرویس احراز هویت پیامکی (منطق مشترک سرور و Netlify)
**فایل جدید:** `server/smsAuth.ts` (بدون Express/Netlify — مثل `server/analyze.ts`)
- `requestSmsCode({ phone, ip }): Promise<{ ok: true; expiresIn: number; resendAfter: number } | { ok: false; status: number; error: string }>`
  1. `normalizeIranianPhone` → ورودی نامعتبر ⇒ 400 «شمارهٔ موبایل معتبر نیست.»
  2. `isSmsConfigured()` ⇒ نبود ⇒ 503 «سرویس پیامک فعال نیست. لطفاً با حساب گوگل وارد شوید.»
  3. `sms_otp_stats` ⇒ کول‌داون ۶۰ث (آخرین چالش < ۶۰ ثانیه پیش) ⇒ 429 «لطفاً ۶۰ ثانیه دیگر صبر کنید.»
     سقف ۵ ارسال/ساعت/شماره و ۲۰ ارسال/ساعت/IP ⇒ 429 «تعداد درخواست کد بیش از حد مجاز است.»
  4. کد: `crypto.randomInt(0, 100000)` → ۵ رقم با صفر ابتدایی؛ هش = `HMAC-SHA256(code, SMS_OTP_SECRET)` (hex)
  5. درج در `sms_otp_challenges` (expires_at = now + ۵ دقیقه)
  6. `sendOtpSms` ⇒ خطا ⇒ حذف رکورد و بازگرداندن پیام فارسی
  7. پاک‌سازی opportunist: حذف رکوردهای قدیمی‌تر از ۲ روز (best-effort)
- `verifySmsCode({ phone, code, ip })` ⇒ `{ ok: true; accessToken; refreshToken; expiresAt; phone }` یا خطا
  1. نرمال‌سازی + بررسی فرمت کد (۵ رقم؛ ارقام فارسی پذیرفته شود)
  2. `consume_sms_otp` ⇒ null ⇒ 400 «کد تأیید نامعتبر یا منقضی شده است.» (پیام یکسان برای «ناموجود/اشتباه/منقضی» — عدم افشای اطلاعات)
  3. `ensureSmsAccount(phoneE164)`:
     - ردیف موجود در `sms_accounts` ⇒ استفاده از `user_id` و `identity_kind` ثبت‌شده
     - وگرنه `find_user_by_phone` ⇒ اگر کاربری هست (مثلاً حساب گوگل) ⇒ اتصال به همان `user_id`
     - وگرنه ساخت کاربر جدید: `admin.createUser({ phone, phone_confirm: true, password, user_metadata: { phone, auth_method: 'sms' } })`
       ⇒ در صورت خطای «phone disabled»: fallback به ایمیل ساینتتیک `sms+<digits>@phone.aqualedger.app` با `email_confirm: true` و `identity_kind='email'`
     - `sms_account_upsert`
  4. `admin.updateUserById(userId, { password: randomSecret })` — رمز تصادفی ۳۲ کاراکتری، **هر بار چرخش** و هرگز ذخیره/ارسال به کلاینت
  5. `getPublicClient().auth.signInWithPassword(phone ? { phone, password } : { email, password })` ⇒ سشن واقعی Supabase
  6. `sms_account_upsert` با `last_login_at`

### T5 — سطح HTTP
**Express (`server.ts`)** — دو مسیر جدید + محدودیت نرخ:
```ts
app.post('/api/auth/sms/request', smsRateLimiter, handler)
app.post('/api/auth/sms/verify',  smsRateLimiter, handler)
```
- `server/rateLimit.ts`: افزودن `smsRateLimiter` (مثلاً ۱۰ درخواست / ۱۰ دقیقه بر IP — لایهٔ دوم روی محدودیت دیتابیس)
- بدنهٔ JSON حداکثر ۱۰ کیلوبایت؛ بدنهٔ نامعتبر ⇒ 400

**Netlify Functions (پروداکشن)** — دو فایل جدید، هم‌سبک `netlify/functions/analyze-transaction.ts`:
- `netlify/functions/sms-request.ts` → `export const config = { path: '/api/auth/sms/request' }`
- `netlify/functions/sms-verify.ts` → `export const config = { path: '/api/auth/sms/verify' }`
- هر دو فقط `server/smsAuth.ts` را صدا می‌زنند (بدون تکرار منطق) و خروجی JSON فارسی برمی‌گردانند
- `netlify.toml`: مسیرهای `/api/*` قبل از fallback SPA قرار می‌گیرند ⇒ تغییر لازم نیست (قانون `/* → /index.html` برای Functionها precedence دارد)

**قرارداد API** (پاسخ‌ها همیشه `{ error: string }` با پیام فارسی در خطا):
| مسیر | بدنهٔ ورودی | ۲۰۰ | خطاها |
|---|---|---|---|
| `POST /api/auth/sms/request` | `{ phone }` | `{ ok:true, expiresIn:300, resendAfter:60 }` | 400 شماره نامعتبر · 429 محدودیت نرخ · 503 سرویس پیامک تنظیم نشده · 502 خطای ارسال |
| `POST /api/auth/sms/verify` | `{ phone, code }` | `{ ok:true, accessToken, refreshToken, expiresAt, phone }` | 400 کد نامعتبر/منقضی · 429 تلاش‌های بیش از حد · 503 سرویس پیامک تنظیم نشده |

### T6 — لایهٔ state کلاینت
**`src/lib/supabase.ts`**: افزودن `adoptSession(accessToken, refreshToken)` → `getSupabaseClient()?.auth.setSession({ access_token, refresh_token })` (در صورت null بودن کلاینت → false)

**`src/state/auth.tsx`**: افزودن به `AuthContextValue`:
- state: `smsStage: 'phone' | 'code'`، `smsLoading`، `smsError`، `smsInfo`، `smsPhone: string` (E.164 یا '')، `smsCooldown: number` (ثانیه)
- `requestSmsCode(phoneInput: string): Promise<boolean>` — نرمال‌سازی سمت کلاینت (برای UX سریع) + فراخوانی `/api/auth/sms/request`؛ در موفقیت `smsStage='code'`، `smsInfo='کد تأیید ارسال شد.'` و شروع تایمر ۶۰ ثانیه‌ای برای ارسال مجدد
- `verifySmsCode(code: string): Promise<boolean>` — فراخوانی `/api/auth/sms/verify`؛ در موفقیت `adoptSession(...)` ⇒ `onAuthStateChange` سشن را ست می‌کند ⇒ `needsLogin` false ⇒ اپ باز می‌شود
- `resetSmsFlow()` — بازگشت به مرحلهٔ شماره
- پاک‌سازی تایمر در `useEffect` cleanup؛ شمارش معکوس با `setInterval` (۱ ثانیه)
- **نکتهٔ مهم:** `needsLogin` فقط با `session` صفر می‌شود؛ چون سشن از نوع معمولی Supabase است، `getToken()`، هدر Bearer و `switchOwner(user.id)` بدون تغییر کار می‌کنند

### T7 — رابط گرافیکی: صفحهٔ ورود جدید
> اپ روتر ندارد (تب‌ها با `useState` در `src/App.tsx`)؛ بنابراین «صفحهٔ جدید» همان گیت تمام‌صفحهٔ ورود است که بازطراحی می‌شود.

**فایل جدید:** `src/components/SmsLoginForm.tsx` — کامپوننت presentational (قابل تست با `renderToString`)، props:
`stage, phone, code, loading, error, info, cooldownSeconds, onPhoneChange, onCodeChange, onRequest, onVerify, onResend, onBack`
- حالت ۱ (شماره): ورودی `type="tel"` `inputMode="numeric"` `dir="rtl"`، دکمهٔ «ارسال کد تأیید»، راهنمای «شماره را با ۰۹ شروع کنید.»
- حالت ۲ (کد): نمایش شمارهٔ پوشیده (`۰۹۱۲ *** ۴۵۶۷`)، ورودی کد ۵ رقمی با `toPersianDigits`، دکمهٔ «تأیید و ورود»، «ارسال مجدد» با شمارش معکوس، «تغییر شماره»
- خطا با `role="alert"`، موفقیت با `role="status"`، تم تیره، RTL، لمسی بزرگ (حداقل ۴۸px)، آیکون `MessageSquare`/`Smartphone` از lucide-react

**بازطراحی:** `src/components/LoginView.tsx`
- هدر مشترک (لوگو + عنوان) مثل فعلی
- **سوییچ/تب دو حالته**: «ورود با گوگل» | «ورود با شمارهٔ موبایل» (state داخلی `method: 'google' | 'sms'`)
- تب گوگل: دکمهٔ فعلی + متن راهنما
- تب پیامک: `SmsLoginForm`
- پابند: «ادامه بدون ورود (آفلاین)» + یادداشت آفلاین (بدون تغییر)
- `LoginCard` همچنان export شود (با props جدید) تا تست‌های واحد آن قابل به‌روزرسانی بمانند

**`src/components/AuthArea.tsx`**: برای کاربر پیامکی، ایمیل ساینتتیک نمایش داده نشود؛ به‌جایش شمارهٔ موبایل (`user.user_metadata?.phone ?? user.phone`) با `formatIranianPhone` نمایش داده شود (prop جدید `phone`).

### T8 — هم‌ترازی امنیتی Express با Netlify (توصیه‌شده، در محدودهٔ «تغییرات لازم بک‌اند»)
`server.ts` در حال حاضر **هیچ احراز هویتی** روی `/api/analyze-transaction` و `/api/analyze-audio` ندارد (پروداکشن ۴۰۱ می‌دهد، دِو اصلاً ندارد). برای اینکه کاربر پیامکی و گوگلی در دِو رفتار یکسان داشته باشند:
- در هر دو مسیر: `getBearerToken` + `verifySupabaseToken` ⇒ ۴۰۱ با `UNAUTHORIZED_ERROR`، و `checkAiUsage` ⇒ ۴۲۹
- چون `verifySupabaseToken` بدون تنظیم Supabase fail-open است، دِو بدون env همچنان کار می‌کند (بدون شکستن تست‌های موجود)

### T9 — پیکربندی و محیط
**`.env.example`** — افزودن (هیچ‌کدام با پیشوند `VITE_`):
```
# SMS.ir (server only — never in the client bundle)
SMSIR_API_KEY="YOUR_SMSIR_API_KEY"
SMSIR_SENDER=""            # line number for bulk sends (e.g. 30004505000017); optional if a template is used
SMSIR_TEMPLATE_ID=""       # template id for /v1/send/verify; when set it takes priority
SMSIR_CODE_PARAM="Code"    # parameter name inside the template
SMSIR_BASE_URL="https://api.sms.ir/v1"
SMS_OTP_SECRET="..."       # HMAC key for hashing OTP codes (server only)
SMS_OTP_TTL_SECONDS="300"
SMS_OTP_LENGTH="5"
SMS_OTP_MAX_ATTEMPTS="3"
SMS_OTP_RESEND_SECONDS="60"
SMS_OTP_MAX_PER_HOUR_PER_PHONE="5"
SMS_OTP_MAX_PER_HOUR_PER_IP="20"

# Supabase service-role key (server only): find/create SMS users + mint sessions
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
```
- `SMSIR_API_KEY` مقدار ارائه‌شدهٔ کاربر است؛ **در `/.env` محلی (gitignore است) نوشته شود** و در Netlify به‌عنوان Site Environment Variable ثبت گردد — هرگز commit نشود.
- **`SECRETS_SCAN_OMIT_KEYS` دست‌نخورده بماند** (کلید پیامک اصلاً وارد باندل نمی‌شود).

### T10 — تست‌ها
- `tests/unit/phone.test.ts` — نرمال‌سازی (ارقام فارسی، `+98`، `0098`، `9…`، فرمت‌های نامعتبر)، `formatIranianPhone`، `maskPhone`
- `tests/unit/sms-client.test.ts` — با mock برای `fetch`: ساخت درخواست verify و bulk، کشف خط با `/v1/line`، نگاشت کدهای خطا به پیام فارسی، عدم لاگ‌شدن کلید
- `tests/unit/sms-auth.test.ts` — mock برای `fetch` + mock کلاینت Supabase (الگوی `tests/unit/netlify-functions.test.ts`): درخواست موفق، کد اشتباه (attempts+1)، کد منقضی، محدودیت نرخ (۴۲۹)، سرویس تنظیم‌نشده (۵۰۳)، و مسیر «ساخت کاربر + صدور سشن»
- `tests/unit/sms-login-form.test.ts` — رندر هر دو مرحله، `role="alert"`، شمارش معکوس، دکمه‌ها
- `tests/unit/login-card.test.ts` — **به‌روزرسانی** (ساختار جدید: تب‌ها + فرم پیامک + دکمهٔ آفلاین)
- `tests/unit/netlify-functions.test.ts` — افزودن سناریوهای `sms-request` / `sms-verify`
- `tests/unit/auth-area.test.ts` — نمایش شماره برای کاربر پیامکی
- E2E (اختیاری): `tests/e2e/login-screen.spec.ts` — با ست‌کردن `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` ساختگی در `playwright.config.ts` (webServer) گیت ورود ظاهر می‌شود؛ فقط وجود دو گزینهٔ گوگل/پیامک assert شود (بدون ورود واقعی)

### T11 — مستندات
- `docs/DECISIONS.md` — افزودن D27…D31 (جدیدترین اول): هویت phone-first با fallback ایمیل، چرخش رمز تصادفی به‌جای ذخیرهٔ رمز، کد ۵ رقمی + HMAC + محدودیت نرخ، پشتیبانی هم‌زمان verify/bulk در SMS.ir، حفظ گیت آفلاین
- `docs/PLAN.md` — افزودن فاز «Auth-SMS»
- `docs/ARD.md` — اصلاح بندهای stale دربارهٔ «بدون احراز هویت» و افزودن معماری ورود پیامکی
- `README.md` — جدول env، ران‌بوک Supabase (فعال‌کردن Phone provider + ساخت کاربر)، ران‌بوک SMS.ir (قالب/خط + **غیرفعال‌کردن IP Whitelist برای کلید Netlify**)، متغیرهای Netlify، چک‌لیست پذیرش

## 5. امنیت و محدودیت نرخ (خلاصه)

| کنترل | مقدار | لایه |
|---|---|---|
| کول‌داون ارسال مجدد | ۶۰ ثانیه بر شماره | DB (`sms_otp_challenges`) |
| سقف ارسال | ۵/ساعت/شماره، ۲۰/ساعت/IP | DB (`sms_otp_stats`) |
| عمر کد | ۵ دقیقه | DB (`expires_at`) |
| تلاش نادرست | ۳ بار (سپس کد باطل) | DB (`attempts`) |
| نگهداری کد | HMAC-SHA256 با `SMS_OTP_SECRET` (کد هرگز به‌صورت خام ذخیره/لاگ نمی‌شود) | کد |
| پاسخ خطا | پیام یکسان برای کد اشتباه/منقضی/ناموجود | API |
| افشای وضعیت حساب | هیچ پیامی که وجود/عدم وجود شماره را افشا کند | API |
| کلید SMS.ir و service-role | فقط env سرور، بدون `VITE_`، بدون لاگ | Env |
| محدودیت HTTP | `smsRateLimiter` اکسپرس + محدودیت پلتفرم Netlify | HTTP |

## 6. ریسک‌ها و راهکارها

| ریسک | راهکار |
|---|---|
| **کلید API در گفتگو به‌صورت متن آشکار منتشر شده** | در `/.env` (gitignore) و Netlify env ذخیره شود؛ **کلید در پنل SMS.ir چرخش (rotate) شود** و مقدار جدید جایگزین شود. در README به‌عنوان اقدام امنیتی ذکر شود. |
| **IP Whitelist در پنل SMS.ir** | برای کلیدی که از Netlify Functions صدا زده می‌شود **نباید فعال باشد** (IPهای Netlify پویا هستند) ⇒ در README با تأکید بالا ذکر شود؛ در صورت فعال بودن، کد خطای ۱۱ به پیام فارسی «کلید وب‌سرویس محدود به IP است» ترجمه شود. |
| **Phone provider در Supabase خاموش باشد** | مسیر fallback روی ایمیل ساینتتیک + پیام فارسی روشن + ران‌بوک README («Authentication → Providers → Phone → Enable»)، و ذخیرهٔ `identity_kind` در `sms_accounts` تا تصمیم برای ورودهای بعدی ثابت بماند. |
| **هزینهٔ پیامک** | متن پیامک کوتاه نگه داشته شود؛ مسیر `verify` (قالب خط خدماتی) ارزان‌تر/پایدارتر است — در README توصیه شود. |
| **افزودن رمز به حساب گوگلیِ متصل** | رمز تصادفی ۴۸-کاراکتری، هر بار چرخش، هرگز ذخیره/نمایش — در DECISIONS.md ثبت شود. |
| **تغییر رفتار AI در دِو** (T8) | fail-open وقتی Supabase تنظیم نشده ⇒ تست‌های موجود و جریان آفلاین حفظ می‌شود. |

## 7. اعتبارسنجی (Validation)

**وضعیت:** گام‌های ۱–۳ و ۵ روی همین کد اجرا و سبز ثبت شده است (`docs/PLAN.md` § Phase 9 و `README.md`
§ Verification: lint ✅ · ۱۶۹ تست واحد در ۲۳ فایل ✅ · build ✅ · Playwright: spec صفحهٔ ورود ✅).
در آخرین نشست، اجرای مجدد `npm run lint/test/build` در سندباکس ممکن نبود (دسترسی bash فقط
خواندنی بود)؛ بنابراین پس از اعمال گام ۰.۲ (ویرایش assertion) این سه دستور را دوباره اجرا کنید.

1. `npm run lint` (tsc --noEmit) — بدون خطا
2. `npm test` (vitest) — همهٔ تست‌های جدید و قدیمی سبز
3. `npm run build` — بدون خطا
4. `npm run dev` → `POST /api/auth/sms/request` با شمارهٔ تستی ⇒ ۲۰۰؛ بررسی لاگ سرویس (بدون چاپ کد)؛ `POST .../verify` با کد اشتباه ⇒ ۴۰۰؛ با کد درست ⇒ ۲۰۰ + توکن
5. `npm run test:e2e` — سناریوهای موجود بدون regression؛ `npm run test:e2e:login` — صفحهٔ ورود
6. سناریوی دستی: ورود با گوگل (بدون تغییر) · ورود با پیامک ⇒ باز شدن اپ ⇒ نوار بالا شماره را نشان دهد ⇒ داده‌های محلی جدا (`:memory:`/IndexedDB) ⇒ سهمیهٔ AI برای کاربر پیامکی هم اعمال شود

## 8. خارج از محدوده (Follow-up — در این تسک انجام نمی‌شود)

- Netlify Function برای `/api/analyze-audio` (در پروداکشن به SPA می‌افتد) — باگ جداگانه
- اتصال شمارهٔ موبایل به حساب گوگل از صفحهٔ تنظیمات (لینک‌کردن دستی) — منطق `find_user_by_phone` برای آن آماده است
- هم‌ترازی کامل `localStore` با نام‌گذاری per-owner (کلیدهای localStorage مشترک‌اند)
- پاک‌سازی stale مستندات `PLAN.md`/`ARD.md` دربارهٔ «بدون Auth» (بخشی از T11 اصلاح می‌شود، بازبینی کامل خارج از محدوده)

## 9. نکات اجرایی برای پیاده‌ساز

- هیچ کامنتی در کد نوشته نشود مگر آن‌جا که قراردادهای امنیتی را توضیح دهد (قواعد `AGENTS.md`)
- commitهای کوچک و قابل بازبینی: `feat(auth): ...`، `feat(sms): ...`، `test: ...`، `docs: ...`
- `AGENTS.md` را به‌روز نکنید مگر لازم باشد؛ `metadata.json` دست‌نخورده
- کد و کامنت انگلیسی، متن‌های رابط کاربری فارسی و RTL
- ترتیب پیشنهادی commitها: T1+T2 (هستهٔ داده) → T3+T4 (سرور) → T5 (HTTP) → T6+T7 (کلاینت) → T8 → T9 → T10 → T11
