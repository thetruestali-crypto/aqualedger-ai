# ARD — اسناد مرور معماری (Architecture Review Document)
## AquaLedger AI — دستیار هوشمند مالی تکنسین‌های تصفیه آب ایران

---

## ۱. مقدمه و اهداف معماری

### ۱.۱ زمینه و پیش‌زمینه
**AquaLedger AI** یک سیستم نرم‌افزاری تحت وب است که مأموریتش پوشش نیازهای حسابداری مالی و مدیریتی تکنسین‌های تصفیه آب در ایران است. تکنسین‌های این حووز، افرادی هستند که در دو بستر شغلی فعالیت می‌کنند:

- **جریان شرکتی (صبح‌ها):** کارمند یا شریک ثابت در یک مغازه یا شرکت تصفیه آب؛ دریافت حقوق ثابت، خرید قطعات از جیب شخصی برای مغازه، دریافت مساعده و علی‌الحساب از رئیس، و واریز حقوق.
- **جریان میدانی (عصرها و تعطیلات):** سرویس‌کاری آزاد؛ نصب، تعویض فیلتر، تعمیر پمپ، فروش قطعه و دریافت پول نقدی یا نسیه از مشتریان.

این دو جریان درآمدی همزیست می‌شوند و نیازمند یک سامانه‌ای هستند که هر دو را از یک منبع واحد، بدون سردرگمی، اداره کند.

### ۱.۲ اهداف معماری
| هدف | توصیف |
|------|--------|
| **یک‌پارچگی دوگانه شغلی** | تفکیک و هم‌زمان مدیریت جریان شرکتی و میدانی در یک رابط کاربری |
| **ورودی هوشمند زبانی** | تبدیل گفتار/متن عامیانه فارسی به سند حسابداری منسجم با استفاده از هوش مصنوعی |
| **پایداری و عمومیت‌طلبی** | بدون وابستگی به دیتابیس سرور، با localStorage؛ قابل اجرا روی هر سرور Node |
| **قابلیت اطمین‌سناسی** | حذف نقطه شکست تک‌نقطه‌ای (Single Point of Failure) در دسترسی به Gemini با Fallback Parser |
| **قابلیت گسترش** | ساختار لایه‌ای که امکان افزودن ابزارهای جدید، APIهای جدید یا پیوند به سرویس‌های ابری را فراهم می‌سازد |

### ۱.۳ دامنه (Scope)
- **شامل:** ورودی صوتی و متنی، تجزیه و تحلیل مالی، مدیریت تراکنش، مدیریت مشتری، مدیریت انبار قطعات، صدور صورت‌وضعیت، محاسبه حقوق، تنظیمات و **احراز هویت کاربر (ورود با حساب گوگل و ورود با شمارهٔ موبایل از طریق کد پیامک)**.
- **غیر شامل:** سیستم حسابداهای بانکی، همگام‌سازی ابری داده‌ها بین دستگاه‌ها، ورود چندکاربره/اشتراکی، قوانین مالیاتی و بیمه پیشرفته، و گزارش‌گیری حسابداری استاندارد (حسابرسی/بشر).
- **نکته:** احراز هویت فقط «هویت» است، نه «همگام‌سازی»: داده‌های هر کاربر در IndexedDB همان دستگاه می‌ماند و جداسازی کاربران از طریق `aqualedger_u_<user-id>` و RLS در Supabase انجام می‌شود.

---

## ۲. نمودار معماری سیستم (ASCII)

```
                    ┌─────────────────────────────────────────────────────┐
                    │             کاربر نهایی — مرورگر وب                   │
                    │  (موبایل / تبلت / دسکتاپ — Chrome / Safari / Firefox) │
                    └────────────────────────┬────────────────────────────┘
                                             │ HTTP / HTTPS
                    ┌────────────────────────┴────────────────────────────┐
                    │                    Express.js Server                 │
                    │  (یکپارچه: API + سرور استاتیک / Vite Dev Middleware)   │
                    │                                                        │
                    │  ┌──────────────┐        ┌────────────────────────┐ │
                    │  │ GET /api/    │        │ POST /api/analyze-     │ │
                    │  │ health       │◄───────│ transaction            │ │
                    │  │ (Health)     │        │   ┌─────────────────┐  │ │
                    │  └──────────────┘        │   │  GoogleGenAI   │  │ │
                    │                          │   │  (Gemini        │  │ │
                    │                          │   │   3.8-flash)    │  │ │
                    │                          │   └──────┬────────┘  │ │
                    │                          │         │            │ │
                    │                          │   ┌─────▼──────────┐ │ │
                    │                          │   │  Rule-based    │ │ │
                    │                          │   │  Fallback      │ │ │
                    │                          │   │  Parser        │ │ │
                    │                          │   └────────────────┘ │ │
                    │                          └────────────────────┘ │
                    │                                                   │
                    │  [Dev] ── import('vite') ──► HMR + Middleware     │
                    │  [Prod] ── static('dist') ──► index.html + assets │
                    └────────────────────────┬──────────────────────────┘
                                             │
             ┌───────────────────────────────┼────────────────────────────────┐
             │                                 │                                │
    ┌────────▼────────┐             ┌────────▼────────┐             ┌─────────▼────────┐
    │  React 19 DOM   │             │ localStorage     │             │ .env — GEMINI   │
    │  (SPA / CSR)    │             │  (state persistence)│          │  API KEY         │
    │                 │             │                   │             │                 │
    │ ┌─────────────┐ │             │  ┌────────────┐ │             │  [Dotenv]        │
    │ │  Navbar     │ │             │  │aqualedger_ │ │             │  (در سرور)      │
    │ │  (Tabs,     │ │             │  │transactions│ │             │                 │
    │ │   Boss LED) │ │             │  │_v1         │ │             │                 │
    │ └─────────────┘ │             │  │aqualedger_ │ │             │                 │
    │ ┌─────────────┐ │             │  │settings    │ │             │                 │
    │ │DashboardView│ │             │  │_v1         │ │             │                 │
    │ │ (KPIs,      │ │             │  │aqualedger_ │ │             │                 │
    │ │  Summary)   │ │             │  │clients     │ │             │                 │
    │ └─────────────┘ │             │  │_v1         │ │             │                 │
    │ ┌─────────────┐ │             │  │aqualedger_ │ │             │                 │
    │ │SmartQuick-  │◄────────────┤  │parts_      │ │             │                 │
    │ │Entry        │ │   فراخوان  │  │v1          │ │             │                 │
    │ │(Mic + AI)   │ │   از API    │  └────────────┘ │             │                 │
    │ └─────────────┘ │             │                   │             │                 │
    │ ┌─────────────┐ │             │                   │             │                 │
    │ │CompanyLedger│ │             │                   │             │                 │
    │ │  View       │ │             │                   │             │                 │
    │ └─────────────┘ │             │                   │             │                 │
    │ ┌─────────────┐ │             │                   │             │                 │
    │ │ClientsLedger│ │             │                   │             │                 │
    │ │  View       │ │             │                   │             │                 │
    │ └─────────────┘ │             │                   │             │                 │
    │ ┌─────────────┐ │             │                   │             │                 │
    │ │Inventory    │ │             │                   │             │                 │
    │ │  View       │ │             │                   │             │                 │
    │ └─────────────┘ │             │                   │             │                 │
    │ ┌─────────────┐ │             │                   │             │                 │
    │ │SettingsView │ │             │                   │             │                 │
    │ └─────────────┘ │             │                   │             │                 │
    │ ┌─────────────┐ │             │                   │             │                 │
    │ │InvoiceExport│ │             │                   │             │                 │
    │ │  Modal      │ │             │                   │             │                 │
    │ └─────────────┘ │             │                   │             │                 │
    │ ┌─────────────┐ │             │                   │             │                 │
    │ │UserGuide    │ │             │                   │             │                 │
    │ │  Modal      │ │             │                   │             │                 │
    │ └─────────────┘ │             │                   │             │                 │
    │                 │             │                   │             │                 │
    │ ┌─────────────┐ │             │                   │             │                 │
    │ │financial    │ │             │                   │             │                 │
    │ │ Engine      │ │             │                   │             │                 │
    │ │ (pure TS)   │ │             │                   │             │                 │
    │ └─────────────┘ │             │                   │             │                 │
    │ ┌─────────────┐ │             │                   │             │                 │
    │ │formatters   │ │             │                   │             │                 │
    │ │ (pure TS)   │ │             │                   │             │                 │
    │ └─────────────┘ │             │                   │             │                 │
    └─────────────────┘             └───────────────────┘             └─────────────────┘

    الگوهای طراحی:              داده‌ها به صورت                   همه‌چیز
    - Composition (App        معلق (Reactive)                    واکنشی به وضعیت
      > Views)                 در App.tsx                          (State-driven)
    - Context-less State      Compute-on-render                  یکپارچه
      (Props drilling)        (computeFinancialSummary هر رندر)   (SPA monolith)
```

### معنی نمودار
- سرور Express نقطهٔ ورود واحد است؛ در توسعه Vite را به عنوان میان‌افتاده (middleware) می‌بیند، در تولید فایل‌های استاتیک `dist` را سرو می‌کند.
- تنها endpoint پردازشی `/api/analyze-transaction` است که به ترتیب ابتدا سعی می‌کند به Gemini 3.8 Flash متن را تجزیه و تحلیل کند؛ در صورت شکست، به Fallback Parser قانون‌باز می‌پردازد.
- تمام منطق نمایشی در کلاینت، وضعیت را از `localStorage` بارگذاری و پس از هر تغییر مجدد ذخیره می‌کند؛ هیچ کانال لرزشی (WebSocket) وجود ندارد.

---

## ۳. لایه‌بندی معماری

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: رابط کاربری (Presentation Layer)                      │
│  src/components/*.tsx  +  src/main.tsx                          │
│  ── React 19 + Tailwind CSS v4 + lucide-react + motion ──       │
│  نقش: ارائهٔ نما، واکنش به وضعیت، ورودی کاربر، صدا/متن          │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: منطق تجاری و محاسباتی (Business / Engine Layer)       │
│  src/utils/financialEngine.ts  +  src/utils/formatters.ts       │
│  ── Pure functions (بدون وابستگی به DOM یا شبکه) ──             │
│  نقش: محاسبهٔ تراز رئیس، سود میدانی، حقوق، قالب‌بندی فارسی    │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: لایهٔ داده و وضعیت (Data / State Layer)               │
│  src/utils/storage.ts  +  src/App.tsx  (useState / props)       │
│  ── localStorage + React state management ──                      │
│  نقش: بارگذاری، ذخیره، به‌روزرسانی Transaction/Client/Part     │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4: لایهٔ داده‌ای و نوعی (Type / Schema Layer)            │
│  src/types/index.ts                                               │
│  ── انتخابات یکپارچهٔ اسکیمای دامنه (Domain Schema) ──           │
│  نقش: تعریف اسکیمای Transaction، Client، PartItem، Settings    │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 5: لایهٔ سرور و هوش مصنوعی (Server / AI Gateway Layer)   │
│  server.ts                                                        │
│  ── Express + GoogleGenAI + dotenv ──                              │
│  نقش: دریافت درخواست، فراخوانی Gemini، fallback، مدیریت Vite    │
└─────────────────────────────────────────────────────────────────┘
```

### ویژگی‌های لایه‌بندی
- **جداپذیری واضح:** لایهٔ محاسباتی (`financialEngine`) به کاملاً خالص (pure) است و می‌تواند تست واحد شود بدون نیاز به مرورگر یا شبکه.
- **بدون لایهٔ سرویس میانی:** هیچ لایهٔ `service` یا `repository` جداگانه‌ای وجود ندارد؛ منطق ذخیره‌سازی مستقیماً در `App.tsx` و `storage.ts` گنجانده شده است (اختیاری، برای سادگی عمدی).
- **استفاده مجدد اسکیمای دامنه:** `types/index.ts` توسط هر پنج لایهٔ بالا مصرف می‌شود؛ یک منبع حقیقت برای ساختار داده‌ها.

---

## ۴. تکنولوژی‌های اصلی و تحلیل انتخاب‌ها

| حووزه | تکنولوژی | نسخه | دلیل انتخاب | ارزیابی |
|---------|-----------|-------|--------------|---------|
| **UI کتابخانه** | React | 19.0.1 | React 19 با پشتیبانی native از SSR/Streaming، Concurrent Features و `use` hook؛ برای SPAهای تعاملی مناسب | ✅ مناسب؛ اما فقط از ویژگی‌های CSR استفاده می‌شود |
| **زبان** | TypeScript | 7.0.2 | تایپ استاتیک، کشف خطا در زمان کامپایل، IDE خوب | ✅ بسیار مناسب؛ `noEmit` روی سرور نیز بکار رفته |
| **باندلر / سرور توسعه** | Vite | 8.3.0 | سرعت بالا، HMR، ESBuild؛ ترکیب با Express در `middlewareMode` | ✅ انتخاب عالی برای یکپارچه‌سازی dev server |
| **استایل** | Tailwind CSS v4 | 4.3.3 | utility-first، تماماً کلاس‌های داخلی؛ بدون CSS شخصی | ✅ مناسب؛ از `@tailwindcss/vite` پلاگین استفاده شده |
| **سرور** | Express | 4.21.2 | وزن سبک، middlewareهای سازگار با Vite، پر استفاده در Node | ✅ کافی؛ اما برای مقیاس‌پذیری بیشتر به Fastify یا NestJS می‌توان ارتقا داد |
| **هوش مصنوعی** | @google/genai | 2.4.0 | SDK رسمی Google؛ سازگاری با Structured Output و Schema | ✅ صحیح؛ از Structured Schema برای JSON استاندارد استفاده شده |
| **مدل هوش مصنوعی** | Gemini 3.8 Flash | — | سریع، مناسب فارسی، گواهی شده برای هزینهٔ پایین | ✅ انتخاب مناسب برای تحلیل متن عامیانه |
| **ذخیره‌سازی** | localStorage | — | بدون نیاز به دیتابیس؛ روی مرورگر کاربر | ⚠️ محدود به حجم مرورگر (~5–10MB)؛ قابلیت از دسترفتن در حذف کوکی |
| **آیکون** | lucide-react | 0.546.0 | آیکون‌های برداری، وزن سبک، شخصی‌پذیری رنگ | ✅ انتخاب استاندارد |
| **انیمیشن** | motion | 12.23.24 | انیمیشن‌های گرافیکی نرم و روان در React | ✅ استفادهٔ محدود؛ بیشتر در مودال‌ها |
| **زمان‌بندی** | dotenv + tsx | — | مدیریت env و اجرای TS در Node بدون کامپایل | ✅ مناسب برای dev و deploy ساده |
| **فرمت‌کننده تاریخ** | Intl.DateTimeFormat('fa-IR') | — | تبدیل تاریخ میلادی به شمسی بدون کتابخانهٔ جانبی | ✅ سبک و استاندارد |

### نکتهٔ فنی: ترکیب Vite + Express
سرور در `server.ts` در حالت توسعه از `createViteServer({ middlewareMode: true })` استفاده می‌کند تا تمام درخواست‌های استاتیک و HMR از طریق Express عبور کنند. در حالت تولید، از `express.static('dist')` استفاده می‌شود. این الگو ( **"Universal Server"** یا **"Isomorphic Server"**) باعث می‌شود یک فرمان (`npm run dev` / `npm start`) تمام فرآیند را اداره کند.

---

## ۵. نقش‌ها و مسئولیت‌های ماژول‌ها

| ماژول (فایل) | نقش اصلی | مسئولیت‌ها |
|---------------|----------|-------------|
| **`server.ts`** | سرور API و دروازهٔ هوش مصنوعی | درخواست‌های `/api/analyze-transaction` و `/api/health`؛ فراخوانی Gemini با Schema یک‌سری؛ مدیریت دوباره‌گذاری (2 retry)؛ Fallback Parser؛ ترکیب Vite/Express |
| **`App.tsx`** | هماهنگ‌کننده اصلی و مدیر وضعیت | نگهداری `transactions`, `settings`, `clients`, `parts`؛ محاسبهٔ لحظه‌ای خلاصهٔ مالی؛ هدایت CRUD بین کامپوننت‌ها؛ بازوی مودال صادرات |
| **Navbar.tsx** | ناوبری و وضعیت سریع | نوار تب‌ها، نمایش ماندهٔ رئیس در هدر، دکمهٔ ورودی سریع، دکمهٔ راهنما |
| **DashboardView.tsx** | داشبورد KPI | ۳ کارت KPI (طلب/بده رئیس، درآمد شخصی، طلب مشتریان)؛ نمودار لیست تراکنش‌ها با فیلتر |
| **SmartQuickEntry.tsx** | ورودی هوشمند | ورودی صوتی (SpeechRecognition `fa-IR`)؛ ورودی متنی؛ ارسال به API؛ پیش‌نمایش و ویرایش قبل از ثبت؛ نمونه‌های آماده |
| **CompanyLedgerView.tsx** | دفتر شرکت و رئیس | نمایش تراکنش‌های شرکتی؛ معادلهٔ مانده؛ دکمه‌های سریع افزودن (خرید از جیب / مساعده / واریز حقوق) |
| **ClientsLedgerView.tsx** | دفتر مشتریان | لیست مشتریان، جستجو و فیلتر (طلبکار / موعد سرویس)، تسویه بدهی، افزودن مشتری |
| **InventoryView.tsx** | انبار قطعات | جدول قطعات با موجودی، قیمت خرید/فروش، محاسبهٔ حاشیه سود؛ افزودن/ویرایش/حذف |
| **SettingsView.tsx** | پیکربندی | فرم تنظیمات شرکت، قرارداد حقوق، صادرات JSON، بازنشانی داده‌های نمونه |
| **InvoiceExportModal.tsx** | خروجی گزارش | صورت‌وضعیت رئیس و فاکتور مشتری به قالب WhatsApp-ready؛ کپی کردن |
| **UserGuideModal.tsx** | راهنمای کاربری | نمایش قوانین محاسباتی و اصطلاحات تخصصی به کاربر |
| **financialEngine.ts** | موتور مالی | `computeFinancialSummary()`؛ خروجی `FinancialSummary` |
| **storage.ts** | دسترسی به localStorage | load/save برای Transactions، Settings، Clients، Parts؛ داده‌های پیش‌فرض |
| **formatters.ts** | ابزارهای فرمت | `formatToman`, `formatTomanCompact`, `toJalaliDate`, `toPersianDigits`, `getRelativeTimeString` |
| **types/index.ts** | اسکیمای دامنه | تمام انواع داده‌ای (Transaction، Client، PartItem، AIAnalysisResult و …) |

### جریان کنترل ثبت تراکنش جدید (مثال)
1. کاربر در `SmartQuickEntry` متن یا صدا وارد می‌کند.
2. کامپوننت `fetch('/api/analyze-transaction')` را به سرور می‌فرستد.
3. سرور ابتدا Gemini را امتحان می‌کند؛ در صورت شکست، Fallback Parser را اجرا می‌کند.
4. خروجی `AIAnalysisResult` به کلاینت برمی‌گردد.
5. `SmartQuickEntry` مقادیر را نشان می‌دهد؛ کاربر می‌تواند اصلاح کند.
6. کاربر روی «تایید و ثبت» کلیک می‌کند؛ `onSaveTransaction(newTx)` فراخوانی می‌شود.
7. `App.tsx` لیست تراکنش‌ها را به‌روزرسانی و در `localStorage` ذخیره می‌کند؛ در صورت مشتری، رکورد مشتری هم به‌روزرسانی می‌شود.
8. `DashboardView` و `CompanyLedgerView` به‌روزرسانی می‌شوند؛ KPIها مجدداً محاسبه می‌شوند.

---

## ۶. جریان داده و کنترل

### ۶.۱ جریان داده (Data Flow)
```
کاربر → (SpeechRecognition / textarea) → SmartQuickEntry →
  fetch POST /api/analyze-transaction → server.ts →
  Gemini OR Fallback Parser → AIAnalysisResult (JSON) →
  SmartQuickEntry (نمایش + ویرایش) → onSaveTransaction →
  App.tsx state (setTransactions) + localStorage.setItem →
  computeFinancialSummary (رندر مجدد) → DashboardView / LedgerView
```

### ۶.۲ الگوی جریان کنترل (Control Flow)
- **یک‌طرفه (Unidirectional):** App → Props → View → Callback → App. وضعیت هرگز از زیر به بالا نمی‌رود؛ فقط از طریق توابع callback صعودی می‌شود.
- **Compute-on-render:** `computeFinancialSummary` در هر رندر App فراخوانی می‌شود؛ نه در زمان واقعه. این رویکرد ساده است اما برای تراکنش‌های بزرگ (هزارها) می‌تواند هزینهٔ محاسبه داشته باشد.
- **بدون Event Bus:** ارتباطات بین کامپوننت‌ها صرفاً از طریق props و callback انجام می‌شود؛ هیچ Context یا Redux یا Zustand استفاده نشده.

### ۶.۳ جریان داده‌های محلی (Local State)
- وضعیت `transactions`, `settings`, `clients`, `parts` در `useState` اولیه‌سازی اولیه در `App.tsx` با فراخوانی `loadTransactions()` و ...
- هر بار تغییر، `saveTransactions(...)` والدیگر فراخوانی می‌شود؛ یک الگوی **synchronous persistence** است (بدون batching یا debounce).

### ۶.۴ نمودار جریان داده‌ای (DFD) سطح ۰
```
[کاربر] ──(متن/صدا)──► [SmartQuickEntry]
[SmartQuickEntry] ──(HTTP POST)──► [server.ts]
[server.ts] ──(Gemini / Fallback)──► [AIAnalysisResult]
[SmartQuickEntry] ──(onSaveTransaction)──► [App.tsx]
[App.tsx] ──(saveTransactions + computeFinancialSummary)──► [localStorage]
[DashboardView / CompanyLedgerView / ClientsLedgerView] ◄──(read summary)── [App.tsx]
```

---

## ۷. Endpointهای API

### `GET /api/health`
- **هدف:** بررسی سلامت سرور
- **ورودی:** —
- **خروجی:** `200 OK` — `{" status": "ok", "time": "<ISO 8601>" }`
- **استفاده:** مناسب برای health-check در Docker / سرورهای ابری

### `POST /api/analyze-transaction`
- **هدف:** تجزیه و تحلیل متن فارسی عامیانه به یک سند مالی منسجم
- **هدر:** `Content-Type: application/json`
- **بدنهٔ ورودی (Request Body):**
  ```json
  {
    "text": "از جیب ۵۸۰ تومن دادم پک فیلتر ۱۲۳ و اتصالات خریدم برای شرکت مهندس جلالی",
    "context": {
      "bossName": "مهندس جلالی",
      "companyName": "تصفیه آب زلال گستر"
    }
  }
  ```
- **استراتژی پاسخ:**
  1. درخواست به `ai.models.generateContent` با مدل `gemini-3.8-flash` و Schema ساختاری.
  2. اگر شکست بزند (حداکثر ۲ بار با تأخیر ۶۰۰ms)، به Fallback Parser قانون‌باز می‌پردازد.
  3. در نهایت خروجی `AIAnalysisResult` به صورت JSON برمی‌گردد.
- **خروجی موفقیت‌آمیز:**
  ```json
  {
    "success": true,
    "streamType": "company",
    "transactionType": "company_expense_out_of_pocket",
    "party": { "role": "boss", "name": "مهندس جلالی", "phone": "..." },
    "totalAmount": 580000,
    "paidAmount": 580000,
    "remainingDebt": 0,
    "financialImpact": {
      "targetBalance": "boss_balance",
      "userBalanceChange": 580000,
      "profitAmount": 0
    },
    "paymentMethod": "card_to_card",
    "category": "خرید تنخواه",
    "items": [ { "itemName": "پک فیلتر ۱۲۳ تصفیه آب", "quantity": 1, "sellPrice": 580000 } ],
    "suggestNextServiceMonths": 6,
    "description": "...",
    "conversationalSummary": "..."
  }
  ```
- **ورودی خطا:**
  ```json
  { "error": "متن ورودی الزامی است." }
  // یا در حالت 500:
  { "error": "خطا در تحلیل متن ورودی. لطفاً اطلاعات را مجدداً ارسال کنید." }
  ```

### مدیریت خطا و Circuit Breaker
- سرور از دو مکانیزم دفاعی بهره می‌گیرد:
  - **Retry با تاخیر:** حداکثر ۲ بار تلاش مجدد با `setTimeout(r, 600ms)`.
  - **Fallback Parser:** در صورت شکست کامل Gemini، یک Parser قانون‌باز فارسی‌زبان اجرا می‌شود که با regex و منطق کلیدواژه‌ای خروجی می‌دهد.
- این الگو یک **Circuit Breaker سبک** است؛ اما به دلیل عدم وجود یک الگوی واقعی circuit-breaker (circuit open/half-open/full open)، فقط یک fallback استاتیک است.

### `POST /api/auth/sms/request` و `POST /api/auth/sms/verify` (ورود پیامکی)
- **هدف:** ارسال کد تأیید ۵ رقمی به شمارهٔ موبایل و صدور یک **سشن واقعی Supabase** پس از تأیید کد. مرورگر هرگز مستقیم با SMS.ir حرف نمی‌زند؛ کلید API فقط در سرور است.
- **ورودی:**
  ```json
  // request
  { "phone": "09121234567" }
  // verify
  { "phone": "09121234567", "code": "12345" }
  ```
- **خروجی موفق:**
  ```json
  // request
  { "ok": true, "expiresIn": 300, "resendAfter": 60 }
  // verify
  { "ok": true, "accessToken": "...", "refreshToken": "...", "expiresAt": 1700000000, "phone": "+989121234567" }
  ```
- **خطاها (همیشه `{ "error": "<پیام فارسی>" }`):**
  | وضعیت | معنی |
  |--------|-------|
  | 400 | شمارهٔ موبایل معتبر نیست / کد تأیید نامعتبر یا منقضی شده است |
  | 429 | کول‌داون ۶۰ ثانیه‌ای یا سقف ارسال (۵/ساعت/شماره، ۲۰/ساعت/IP) |
  | 502 | خطای ارسال پیامک (کلید نامعتبر/غیرفعال/محدود به IP) |
  | 503 | سرویس پیامک یا کلید service-role تنظیم نشده است |
- **معماری جریان (Express و Netlify Functions یکسان):**
  ```
  مرورگر → POST /api/auth/sms/request
             ├─ normalizeIranianPhone  → E.164 (+98912XXXXXXXX)
             ├─ محدودیت‌ها: کول‌داون ۶۰ث · ۵/ساعت/شماره · ۲۰/ساعت/IP  (public.sms_otp_stats)
             ├─ کد ۵ رقمی تصادفی (crypto.randomInt) → HMAC-SHA256 با SMS_OTP_SECRET
             ├─ ذخیره در public.sms_otp_challenges (TTL ۵ دقیقه، ۳ تلاش)
             └─ ارسال از طریق SMS.ir  →  { ok, expiresIn, resendAfter }   (کد هرگز برنمی‌گردد)
  مرورگر → POST /api/auth/sms/verify
             ├─ مصرف اتمیک کد (public.consume_sms_otp با FOR UPDATE) → تلاش نادرست = attempts+1
             ├─ یافتن/ساخت کاربر Supabase برای شماره (public.sms_accounts + find_user_by_phone)
             ├─ چرخش رمز تصادفی (admin.updateUserById) → signInWithPassword → سشن واقعی
             └─ { ok, accessToken, refreshToken, expiresAt, phone }
  مرورگر → supabase.auth.setSession(...) → onAuthStateChange → باز شدن اپ
  ```
- **امنیت:** کد خام هرگز ذخیره/لاگ نمی‌شود؛ خطای «کد اشتباه/منقضی/ناموجود» یکسان است؛ وجود یا نبود ثبت‌شده بودن شماره افشا نمی‌شود؛ `auth` schema در PostgREST منتشر نیست، بنابراین یافتن کاربر و مصرف کد در SQL (`SECURITY DEFINER`) انجام می‌شود.
- **سازگاری:** Express (توسعه) و Netlify Function (تولید) هر دو فقط `server/smsAuth.ts` را صدا می‌زنند؛ منطق تکراری وجود ندارد.

---

## ۸. مدیریت state

### ۸.۱ الگوی State
- **منبع واحد (Single Source of Truth):** تمام وضعیت‌های برنامه (`transactions`, `settings`, `clients`, `parts`) در کامپوننت `App` (根节点) نگهداری می‌شود.
- **Props Drilling:** این وضعیت از طریق props به کامپوننت‌های فرزند منتقل می‌شود؛ هیچ Context یا کتابخانهٔ جانبی مثل Redux/Zustand/Jotai استفاده نشده است.

### ۸.۲ لایه‌های State

| لایه | مکان | توضیح |
|------|------|--------|
| **UI State** | در هر کامپوننت (`useState` محلی) | باز/بسته بودن مودال، متن ورودی، حالت گوش دادن، مقادیر ویرایش |
| **Application State** | `App.tsx` (`useState`) | لیست تراکنش‌ها، تنظیمات، مشتریان، قطعات |
| **Persistent State** | `localStorage` | بازگرداندن مقادیر `App.tsx` هر بار بارگذاری صفحه |
| **Derived State** | `computeFinancialSummary()` | محاسبهٔ لحظه‌ای خلاصهٔ مالی از روی لیست تراکنش‌ها |

### ۸.۳ الگوهای به‌روزرسانی
- **Immutable Update:** تمام به‌روزرسانی‌ها از طریق spread (`[newTx, ...transactions]`) یا `map`/`filter` انجام می‌شود؛ درجا تغییر نمی‌شود.
- **Synchronous Persistence:** بلافاصله پس از هر تغییر `set*()`، تابع `saveTransactions()` فراخوانی می‌شود؛ ریسکی ندارد اما می‌تواند منجر به I/O مکرر شود.
- **Compute-on-change:** محاسبهٔ مالی در هر رندر انجام می‌شود؛ برای حجم کمتر از چندصد تراکنش کافی است، اما برای مقیاس بزرگ `useMemo` یا worker پس‌زمینه‌ای بهتر است.

### ۸.۴ مزایا و معایب
- **مزایا:** سادگی، شفافیت، بدون وابستگی به کتابخانهٔ جانبی، دیباگ آسان.
- **معایب:** هر تغییر در هر فاقد‌الهامی (leaf component) کل درخت را رندر مجدد می‌کند؛ در آینده می‌توان `useReducer` یا Context + `useMemo` را اعمال کرد.

---

## ۹. پیکربندی

### ۹.۱ متغیرهای محیطی (Environment)
| متغیر | مقدار پیش‌فرض | توصیف |
|--------|---------------|--------|
| `GEMINI_API_KEY` | — (اجباری) | کلید API هوش مصنوعی جوجل |
| `PORT` | `3000` | پورت گوش دهی سرور Express |
| `NODE_ENV` | — | `'production'` فعال‌ساز حالت استاتیک |
| `DISABLE_HMR` | — | اگر `'true'` باشد؛ HMR و فایل‌نوبینگ Vite غیرفعال می‌شود |

### ۹.۲ اسکریپت‌های npm (`package.json`)
| اسکریپت | دستور | توصیف |
|----------|--------|--------|
| `dev` | `tsx server.ts` | اجرای سرور توسعه با HMR فعال |
| `build` | `vite build` | باندل‌سازی استاتیک در `dist/` |
| `start` | `tsx server.ts` | اجرای سرور تولید (Static یا Dev بسته به NODE_ENV) |
| `preview` | `vite preview` | پیش‌نمایش باندل تولیدی |
| `clean` | `rm -rf dist server.js` | پاک‌سازی خروجی‌ها |
| `lint` | `tsc --noEmit` | بررسی خطای تایپ بدون تولید خروجی |

### ۹.۳ پیکربندی TypeScript (`tsconfig.json`)
- `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`
- `jsx: react-jsx` (automatic runtime در React 19)
- `paths: { "@/*": ["./*"] }` — همگام با Vite alias
- `strict` فعال است (implied)
- `allowJs: true`, `isolatedModules: true`, `noEmit: true`

### ۹.۴ پیکربندی Vite (`vite.config.ts`)
- پلاگین‌ها: `@vitejs/plugin-react` (SWC) و `@tailwindcss/vite`
- HMR به صورت پویا بسته یا روشن بسته به `DISABLE_HMR`
- `resolve.alias: { "@": path.resolve(__dirname, ".") }`

### ۹.۵ داده‌های پیش‌فرض
- `storage.ts` شامل `defaultSettings`, `defaultClients`, `defaultParts`, `defaultTransactions` است.
- پس از بارگذاری اولیه یا در صورت خطا، این داده‌ها در `localStorage` نوشته می‌شوند.
- تابع `resetToDemoData()` تمام کلیدها را به مقدار پیش‌فرض بازمی‌گرداند.

---

## ۱۰. نکات معماری خوب و بد

### ✅ نکات مثبت (Good Practices)
| # | شرح | مثال |
|---|------|------|
| G1 | جدایی منطق محاسباتی از UI | `financialEngine.ts` صرفاً توابع خالص دارد |
| G2 | یکپارچه‌سازی اسکیمای دامنه | `types/index.ts` در تمام لایه‌ها مصرف می‌شود |
| G3 | استراتژی fallback هوشمند | Gemini → Rule-based Parser → 500 خطا |
| G4 | فرمت‌بندی بومی فارسی | `formatToman`, `toJalaliDate`, `toPersianDigits` در `formatters.ts` |
| G5 | ورودی چندحالته (Multi-modal) | هم صوتی (SpeechRecognition) و هم متنی |
| G6 | ویرایش قبل از ثبت | `SmartQuickEntry` پیش‌نمایش و ویرایش مقادیر را امکان‌پذیر می‌کند |
| G7 | خروجی قابل استفاده | گزارش‌گیری آمادهٔ WhatsApp/ایتا/تلگرام |
| G8 | نصب‌های سریع صریح | `CompanyLedgerView` دکمه‌های سریع برای افزودن خرید/مساعده/واریز |
| G9 | مستندات داخل‌خطی | `UserGuideModal` و README شامل قوانین محاسبه |
| G10 | اسکیمای ساختاری Gemini | استفاده از `responseSchema` برای خروجی JSON یک‌دست |
| G11 | خط مشی نسخه‌گذاری localStorage | کلیدها شامل نسخه (`_v1`)؛ امکان migration آینده |
| G12 | بهینه‌سازی Bundle | Vite + esbuild؛ بدون وابستگی‌های سنگین |

### ❌ نکات منفی (Bad Practices / Ris‌های معماری)
| # | شرح | محل | پیشنهاد رفع |
|---|------|------|-------------|
| B1 | State جهانی بزرگ در App ریشه | `App.tsx` | استخراج به `useFinancialStore` (Context + useReducer) یا Zustand |
| B2 | محاسبه در هر رندر | `App.tsx` | استفاده از `useMemo` برای `summary` |
| B3 | persistence همزمان هر بار | `App.tsx` save calls | Batching یا debounce |
| B4 | وابستگی به localStorage بدون migration | `storage.ts` | افزودن migration یا نسخه Schema |
| B5 | استفاده از `any` در برخی مکان‌ها | `CompanyLedgerView.tsx` `transactionType: any` | جایگزینی با `TransactionType` |
| B6 | شکستن اصل immutability با مرجع | `ClientsLedgerView.tsx` `formset` | از الگوی immutable state استفاده کردن |
| B7 | عدم تست واحد | — | افزودن Vitest/Jest برای `financialEngine` |
| B8 | وابستگی به Web Speech API (browser-only) | `SmartQuickEntry` | Feature detection بهتر و پیام‌رسانی واضح |
| B9 | API Key در فرآیند سرور | `server.ts` | رمزنگاری env یا استفاده از Secret Manager در سرویس‌های ابری |
| B10 | عدم rate-limiting برای API | `server.ts` | افزودن express-rate-limit یا throttling |
| B11 | خطایابی کم در fallback parser | `server.ts` fallback | لاگ‌گیری دقیق‌تر یا متریک |
| B12 | استفاده از دامنه `Type` از `@google/genai` مستقیم | `server.ts` | انتزاع اسکیمای خروجی در لایهٔ types |

---

## ۱۱. پیشنهادات بهبود

### ۱۱.۱ معماری و ساختار
1. **ماژولار شدن App با Context + useReducer:** به‌جای props-drilling، یک `FinancialContext` یا `FinancialProvider` ایجاد کنید تا transactions، settings، clients و parts را مدیریت کند؛ `FinancialSummary` را با `useMemo` محاسبه کنید.
2. **استخلاء یک لایهٔ Service:** عملیات ذخیره‌سازی و محاسبه را از کامپوننت‌ها خارج کنید؛ مثال: `useTransactions()`, `useClients()` — هوک‌های سفارشی.
3. **پیشنهاد migration localStorage:** نسخه Schema (`aqualedger_transactions_v2`) را اضافه کنید و در زمان بارگذاری، migration از v1 انجام دهید.

### ۱۱.۲ تست و کیفیت
1. **تست واحد برای `financialEngine.ts`:** با Vitest یا Jest؛ تمام ترکیبی از transactionTypeها را تست کنید.
2. **تکنیک Snapshot در `formatters.ts`:** خروجی `formatToman` و `toJalaliDate` را تست کنید.
3. **E2E با Playwright:** جریان ثبت تراکنش صوتی → دریافت AI → ویرایش → ذخیره را شبیه‌سازی کنید.

### ۱۱.۳ سرور و امنیت
1. **Rate Limiting:** `express-rate-limit` برای `/api/analyze-transaction` و `/api/auth/sms/*`؛ مصرف API کاربران غیرمجاز را محدود کند.
2. **Circuit Breaker واقعی:** کتابخانه مانند `opossum` برای مدیریت وضعیت خرابی Gemini.
3. **احراز هویت (انجام شده):** ورود با حساب گوگل (Supabase OAuth) و ورود با شمارهٔ موبایل (کد پیامکی) پیاده‌سازی شده است؛ توکن با `Authorization: Bearer` به API ارسال و با JWT اعتبارسنجی می‌شود. کاربر باقی‌مانده: **همگام‌سازی ابری داده‌ها** بین دستگاه‌ها (همچنان خارج از محدوده).
4. **HTTPS اجباری:** در تولید، هدایت HTTP → HTTPS؛ Web Speech API فقط در HTTPS کار می‌کند.

### ۱۱.۴ مقیاس‌پذیری داده
1. **انتقال به IndexedDB:** برای حجم بالای تراکنش‌ها؛ `idb` یا `localforage` جایگزین `localStorage` شوند.
2. **Sync ابری:** افزودن گزینه همگام‌سازی با Backend (REST/GraphQL) یا Firebase؛ برای کاربرانی که می‌خواهند از دستگاه به دستگاه دیتاشر منقل شود.

### ۱۱.۵ تجربهٔ کاربری
1. **آفلاین‌پذیری کامل (PWA):** افزودن Service Worker برای کارکرد کامل بدون اینترنت؛ در حال حاضر تنها localStorage وابعاد دارد.
2. **Dark Mode سفارشی:** امکانات سفارشی‌سازی رنگ یا حالت نورانی برای خواناتر شدن در نور خورشید.
3. **صادرات PDF:** علاوه بر متن، امکان تولید PDF حرفه‌ای هم داشته باشید.
4. **گزارش‌گیری آماری:** نمودارهای خطی/ستونی برای رشد سود میدانی، میزان خریدهای جیبی و ...

### ۱۱.۶ بهینه‌سازی عملکرد
1. **Lazy Loading کامپوننت‌ها:** `React.lazy` برای صفحاتی که همه بارگذاری نمی‌شوند.
2. **کش درخواست API:** مقدار `AIAnalysisResult` را در localStorage کش کنید تا درخواست‌های تکراری را کاهش دهید.

---

## ۱۲. ارزیابی ریسک

### ۱۲.۱ ریسک‌های فنی
| ریسک | شانس | شدت | توضیح | اقدام پیشنهادی |
|--------|-------|-------|--------|----------------|
| **قطعی سرویس Gemini** | متوسط | بالا | کل خط ورودی هوشمند غیرفعال می‌شود | ✅ Fallback Parser موجود؛ اما دقت پایین‌تر |
| **حذف localStorage توسط کاربر** | بالا | بالا | تمام داده‌ها از دست می‌رود | ❗ افزودن Export/Import منظم؛ یا IndexedDB با backup |
| **حجم محدود localStorage** (~5-10 MB) | متواسط | متوسط | برای تراکنش‌های چندهزارتایی پر می‌شود | ✅ انتقال به IndexedDB یا Sync ابری |
| **تغییر اسکیمای Gemini Schema** | کم | متوسط | ممکن است شکل خروجی تغییر کند | ✅ اعتبارسنجی Schema با Zod یا yup پس از دریافت |
| **وابستگی به Web Speech API** | متوسط | متوسط | در برخی مرورگرها/دستگاه‌ها کار نمی‌کند | ✅ پیام‌رسانی واضح؛ fallback به ورودی متنی |
| **محاسبه مالی در رندر** | متوسط | متوسط | تاخیر در رندر برای داده‌های بزرگ | ✅ `useMemo` یا Web Worker |

### ۱۲.۲ ریسک‌های تجاری / کاربری
| ریسک | شانس | شدت | توضیح | اقدام پیشنهادی |
|--------|-------|-------|--------|----------------|
| **عدم پذیرش توسط تکنسین‌های غیرفنی** | متوسط | بالا | رابط ممرا پیچیده باشد | ✅ آموزش تصویری، UserGuideModal |
| **درست نشدن مبلغ توسط AI** | بالا | متوسط | خطاهای محاسبهٔ پول | ✅ ویرایش قبل از ثبت؛ اعتبارسنجی مقدار |
| **از دست رفتن داده در مرورگر** | بالا | بالا | حذف تاریخچیه یا مرورگر جدید | ✅ Export قانی، ذخیرهٔ دوره‌ای |
| **نقص حریم‌خصوصی در Speech API** | متوسط | متوسط | دسترسی میکروفن در مرورگرهای مدرن | ✅ ذخیرهٔ محلی فقط؛ بدون آپلود صدا به سرور |
| **هزینهٔ API Gemini** | متوسط | متوسط | ممکن است برای تراکنش‌های زیاد گران شود | ✅ کش درخواست‌ها؛ fallback اولویت داشته باشد |

### ۱۲.۳ ریسک‌های عملیاتی
| ریسک | شانس | شدت | اقدام پیشنهادی |
|--------|-------|-------|----------------|
| **عدم تست در مرورگرهای مختلف** | بالا | متوسط | تست روی Chrome, Safari, Firefox |
| **HMR در AI Studio** | متوسط | متوسط | متغیر `DISABLE_HMR` مدیریت می‌شود |
| **بروزرسانی وابستگی‌ها** | متوسط | متوسط | `npm audit` و Dependabot فعال کنید |
| **ورژن‌گذاری localStorage** | متوسط | متوسط | افزودن migration و نسخه Schema |
| **افشای کلید SMS.ir** | کم | بسیار بالا | کلید فقط در env سرور/Netlify؛ چرخش کلیدی که در گفتگو منتشر شده |
| **محدودیت IP در پنل SMS.ir** | متوسط | متوسط | برای کلید Netlify باید IP Whitelist خاموش باشد (IPهای Netlify پویا هستند) |
| **خاموش بودن Phone Provider در Supabase** | متوسط | متوسط | fallback خودکار به ایمیل ساینتتیک + ران‌بوک فعال‌سازی در README |
| **هزینهٔ ارسال پیامک** | متوسط | متوسط | سقف ارسال (۵/ساعت/شماره) + استفاده از قالب `verify` به‌جای `bulk` |

---

## ۱۳. جمع‌بندی

**AquaLedger AI** یک معماری **SPA monolith hybrid** است؛ یک برنامهٔ تحت وب تک‌صفحه‌ای که با یک سرور Express هیبریدی (dev: Vite middleware، prod: static) اجرا می‌شود و تمام وضعیت را در `localStorage` مرورگر نگهداری می‌کند. هوش مصنوعی (Gemini 3.8 Flash) فقط در یک نقطهٔ ورودی متمرکز است: `/api/analyze-transaction`؛ که متن عامیانهٔ فارسی را به سند مالی منسجم تبدیل می‌کند.

### ویژگی‌های برتر
- **تخصص بومی:** ۱۰۰٪ متمرکز بر تکنسین‌های تصفیه آب ایران؛ اصطلاحات، واحدها و منطق حسابداری دقیقاً مطابق واقعیت بازار.
- **یکپارچگی دوگانه:** مدیریت هم‌زمان جریان شرکتی (حقوق، مساعده، خرید از جیب) و میدانی (نصب، تعویض فیلتر، فروش قطعه، نسیه).
- **پایداری بالا:** Fallback Parser باعث می‌شود حتی در قطعی Gemini، برنامه قابل استفاده بماند.
- **سادگی اجرا:** یک فرمان (`npm run dev`) تمام فرآیند توسعه را بالا می‌برد؛ نیازی به دیتابیس، Docker یا DevOps نیست.

### محدودیت‌های کلیدی
- **ذخیره‌سازی مرورگری:** localStorage برای کاربران حرفه‌ای یا داده‌های طولانی‌مدت کافی نیست؛ خطر از دسترفتن داده وجود دارد.
- **عدم همگام‌سازی ابری داده:** احراز هویت (گوگل + پیامک) پیاده‌سازی شده، اما بازیابی داده در دستگاه دیگر یا چندکاربری همچنان ممکن نیست.
- **وابستگی به دامنهٔ فارسی:** دقت Gemini در شناسایی اعداد عامیانه و تبدیل تومان و هزار تومن نیاز به نظارت انسانی دارد.

### جلوه‌های معماری
- معماری لایه‌ای واضح با جداسازی خالص منطق محاسباتی از لایهٔ UI.
- استفاده از اسکیمای ساختاری (Structured Schema) برای خروجی هوش مصنوعی؛ این باعث پایداری در برابر خروجی‌های آزادانهٔ GPT می‌شود.
- مدل دوینگی State در App.tsx؛ برای حجم فعلی (ده‌ها تراکنش) کافی است، اما برای رشد بالاتر نیاز به Context یا Store دارد.
- احراز هویت مشترک بین Express و Netlify Functions: منطق سرویس در `server/` زندگی می‌کند و فقط لایهٔ HTTP تکرار می‌شود.

### نتیجه‌گیری نهایی
AquaLedger AI یک پروژهٔ **قابل استقرار، هدفمند و بومی** است که برای یک تکنسین تک‌نفره یا یک شرکت کوچک در حوزه تصفیه آب به عنوان یک راه‌حل کامل عمل می‌کند. سبدی از محدودیت‌های فنی (ذخیره‌سازی مرورگری، نبود همگام‌سازی ابری داده) وجود دارد که بستر مناسبی برای ارتقاء به سمت یک پلتفرم ابری همه‌کاره فراهم می‌کند.

**امتیاز معماری کلی:** ۷٫۸ / ۱۰
- **سادگی و قابلیت اجرا:** ۹/۱۰
- **قابلیت نگهداری و خوانایی:** ۸/۱۰
- **مقیاس‌پذیری:** ۵/۱۰
- **پایداری و امنیت:** ۶/۱۰
- **خوانایی و توسعهٔ آینده:** ۱۰/۱۰

---

📌 **پیوست الف — اصطلاحات تخصصی تکنسین تصفیه آب**
| اصطلاح | توضیح |
|---------|--------|
| پک فیلتر ۱۲۳ | فیلترهای ۳ مرحلهٔ اول (الیافی، اکسید منی، کربن) |
| ممبران گالنی | فیلتر ممبران غشایی (RO)؛ ۵۰ یا ۷۵ گالن |
| سوئیچ هایپرشر / لوپرشر | کلیدهای اتوماتیک قطع‌کن فشار بالا/پایین |
| ایاب و ذهاب | هزینهٔ رفت و آمد برای سرویس میدانی |
| تعویض ۳ مرحله | کار سرویسی شامل تعویض فیلترهای اول؛ هر ۶ ماه |
| مساعده | پول یا کالاهایی که رئیس به تکنسین می‌دهد |
| جیب | پول شخصی تکنسین |
| تومن / تومان | واحد پول ایران |

---

📌 **پیوست ب — فرمول معادلهٔ تراز نهایی با رئیس**
```
BossNetBalance = (BaseSalaryAccrued + OutOfPocketExpenses) − (AdvancesReceived + SalaryPayouts)

    که:
    BaseSalaryAccrued  = Max(0, MonthlyBaseSalary − InsuranceDeduction)
    OutOfPocketExpenses = مجموع "company_expense_out_of_pocket"
    AdvancesReceived    = مجموع "boss_advance_received"
    SalaryPayouts       = مجموع "salary_payout"

    وضعیت:
      >  +500 تومان  → Creditor (طلبکار)
      <  −500 تومان  → Debtor (بدهکار)
      در غیر این صورت → Settled (تسویه)
```

---

📌 **پیوست ج — گردش کار ثبت تراکنش هوشمند**
```
کاربر صحبت می‌کند یا می‌نویسد
         │
         ▼
 SpeechRecognition (fa-IR) یا textarea
         │
         ▼
 SmartQuickEntry ──► fetch POST /api/analyze-transaction
         │
         ▼
    Server (TSX/Express)
         │
    ┌────┴─────────────────────────────────┐
    │  Gemini 3.8-flash (Structured JSON)   │
    │  (با Retry حداکثر ۲ بار؟ 600ms)        │
    └────┬─────────────────────────────────┘
         │ شکست؟
         ▼
    Fallback Parser (قوانین regex فارسی)
         │
         ▼
    AIAnalysisResult (JSON)
         │
         ▼
    SmartQuickEntry: نمایش + ویرایش
         │
         ▼  (کلیک «تایید»)
    App.tsx:
      ─ setTransactions([...new, ...old])
      ─ saveTransactions(localStorage)
      ─ computeFinancialSummary مجدد
      ─ اگر مشتری → بروزرسانی Client
         │
         ▼
    DashboardView + LedgerView + Navbar
    (استاندارد KPIها به‌روز می‌شوند)
```

---

*این سند در تاریخ ۵ اکتبر ۱۴۰۵ به وقت ایران تنظیم شده است. جهت مرور و بازبینی توسط تیم معماری و توسعهٔ AquaLedger AI.*
