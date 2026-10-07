// Gemini client: system instruction (with Persian number rules), structured
// response schema, retry + zod validation. Server-side only (API key never
// reaches the browser).
import { GoogleGenAI, Type } from '@google/genai';
import { aiAnalysisResultSchema } from '../src/types/schemas.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function getClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

export const SYSTEM_INSTRUCTION = `تو یک حسابدار هوشمند و دستیار مالی اختصاصی برای یک مدیر خدمات و تکنسین تصفیه آب در ایران هستی.
کاربر هم کارمند با حقوق ثابت در شرکت/مغازه است (صبح تا ظهر) و هم سرویس‌کار میدانی مستقل/پورسانتی (عصرها).

وظیفه تو:
1. تحلیل متن ورودی کاربر (فارسی محاوره‌ای، اصطلاحات بازاری، عامیانه، صوتی یا فاکتور دستی).
2. استخراج جزئیات تراکنش مالی شامل مبالغ (تبدیل تومان، هزار تومان، میلیون، تومن به عدد تومان دقیق).
3. تفکیک دقیق تراکنش بین:
   - "شرکت/رئیس": (جریان شرکتی)
   - "مشتری بیرونی": (جریان میدانی)
4. دسته‌بندی قطعات و خدمات تخصصی تصفیه آب (مانند: پک فیلتر ۱۲۳، ممبران ۷۵ یا ۵۰ گالن، فیلتر پست کربن، مینرال، پمپ و هد پمپ، سوئیچ های‌پرشر و لوپرشر، شیر برداشت اهرمی یا ستاره‌ای، شیر برقی، چهارراهی، مخزن تصفیه، شلنگ و فیتینگ، گیج فشار، دستمزد تعویض فیلتر، دستمزد نصب، عیب‌یابی، هزینه ایاب و ذهاب، حقوق، مساعده، کسر کار و...).
5. بازگرداندن یک ساختار استاندارد JSON بر اساس اسکیمای مشخص شده.

قوانین اعداد فارسی (بسیار مهم — هم در متن و هم در گفتار):
- ارقام فارسی (۰-۹) و عربی (٠-٩) را به انگلیسی تبدیل کن.
- «هزار» یعنی ×۱٬۰۰۰، «میلیون/ملیون» یعنی ×۱٬۰۰۰٬۰۰۰، «میلیارد» یعنی ×۱٬۰۰۰٬۰۰۰٬۰۰۰.
- «نیم» و «و نیم» یعنی +۰٫۵ واحد قبلی؛ مثلاً «۲ و نیم میلیون» = ۲٬۵۰۰٬۰۰۰.
- اعداد حرفی را بفهم: یک، دو، ...، ده، بیست، ...، نود، صد، دویست، ...، نهصد.
- گفتار عامیانه: عدد کوچک تنها با «تومن/تومان» و بدون واحد یعنی ×۱۰۰۰؛ مثلاً «۵۸۰ تومن» = ۵۸۰٬۰۰۰ تومان و «صد تومن» = ۱۰۰٬۰۰۰ تومان.
- اگر جمله چند مبلغ دارد (مثل «۴۵۰ تومن شد که ۳۵۰ نقد داد و ۱۰۰ تومنش موند»): اولی مبلغ کل، دومی پرداخت‌شده، سومی مانده بدهی است.

قوانین محاسباتی اکید:
- اگر کاربر گفت "از جیب دادم برای شرکت" یا "قطعه خریدم برای مغازه/رئیس"، این نوع: "company_expense_out_of_pocket" است و این یعنی طلبکاری کاربر از رئیس افزایش می‌یابد.
- اگر کاربر گفت "از رئیس گرفتم" یا "مساعده گرفتم"، این نوع: "boss_advance_received" است و طلب کاربر را کم یا او را به رئیس بدهکار می‌کند.
- اگر برای مشتری قطعه خریده و مشتری هنوز نداده: نوع "client_receivable" (طلب از مشتری).
- اگر مشتری پول را نقد یا کارت به کارت داده: نوع "client_payment_received".
- اگر مشتری هم هزینه قطعه و هم دستمزد را داده: هزینه قطعه و دستمزد و سود را در اقلام تفکیک کن.
- اگر کاربر گفت "حقوق واریز شد" یا "حقوق پایه ثبت شد": نوع "salary_payout".
- اگر کاربر ابزار یا وسایل کار برای خودش خریده: نوع "technician_tool_expense".
- همیشه تمام مبالغ در کلیدها باید به عدد صحیح "تومان" (Toman) باشد (بدون اعشار).
- اگر مبلغ مشکوک است (صفر، یا بیش از ۱۰ برابر مبالغ معمول این کار)، در warnings ذکر کن و confidence را پایین بگذار.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    success: { type: Type.BOOLEAN, description: 'آیا تراکنش با موفقیت تشخیص داده شد' },
    streamType: {
      type: Type.STRING,
      description: 'شرکتی یا میدانی: company (شرکت و رئیس) یا field (مشتری میدانی)',
    },
    transactionType: {
      type: Type.STRING,
      description:
        'یکی از: company_expense_out_of_pocket, boss_advance_received, client_payment_received, client_receivable, client_part_cost, technician_tool_expense, salary_payout, other',
    },
    party: {
      type: Type.OBJECT,
      properties: {
        role: { type: Type.STRING, description: 'boss (رئیس/شرکت) یا client (مشتری) یا self (شخصی)' },
        name: { type: Type.STRING, description: 'نام طرف حساب یا شخص (مثلا: مهندس جلالی، آقای رضایی)' },
        phone: { type: Type.STRING, description: 'شماره تماس در صورت ذکر شدن در متن' },
        address: { type: Type.STRING, description: 'آدرس مشتری در صورت ذکر شدن' },
      },
      required: ['role', 'name'],
    },
    totalAmount: { type: Type.NUMBER, description: 'کل مبلغ تراکنش به تومان (عدد صحیح)' },
    paidAmount: { type: Type.NUMBER, description: 'مبلغی که پرداخت یا تسویه شده به تومان' },
    remainingDebt: { type: Type.NUMBER, description: 'مانده بدهی/طلب به تومان (مبلغ کل منهای مبلغ پرداختی)' },
    financialImpact: {
      type: Type.OBJECT,
      properties: {
        targetBalance: {
          type: Type.STRING,
          description: 'boss_balance (حساب رئیس) یا client_receivable (طلب از مشتری) یا personal_cash (نقدینگی تکنسین)',
        },
        userBalanceChange: {
          type: Type.NUMBER,
          description: 'تغییر مانده طلب کاربر از رئیس یا مشتری (مثبت = طلبکارتر شدن، منفی = کاهش طلب/دریافت وجه)',
        },
        profitAmount: { type: Type.NUMBER, description: 'سود خالص کاربر از این سرویس/معامله به تومان' },
      },
      required: ['targetBalance', 'userBalanceChange'],
    },
    paymentMethod: {
      type: Type.STRING,
      description: 'نقدی (cash)، کارت به کارت (card_to_card)، نسیه/طلب (credit)، پوز (pos)، چک (cheque)',
    },
    category: {
      type: Type.STRING,
      description: 'دسته بندی: تعویض فیلتر، نصب دستگاه، تعمیر پمپ و اتصالات، خرید تنخواه، مساعده، ایاب و ذهاب، ابزار، سایر',
    },
    items: {
      type: Type.ARRAY,
      description: 'اقلام و قطعات فاکتور در صورت وجود',
      items: {
        type: Type.OBJECT,
        properties: {
          itemName: { type: Type.STRING, description: 'نام قطعه مثلا فیلتر ۱۲۳، ممبران، پمپ، اتصالات، دستمزد' },
          quantity: { type: Type.NUMBER, description: 'تعداد' },
          purchasePrice: { type: Type.NUMBER, description: 'قیمت خرید قطعه به تومان (در صورت مشخص بودن)' },
          sellPrice: { type: Type.NUMBER, description: 'قیمت فاکتور شده برای مشتری به تومان' },
        },
        required: ['itemName'],
      },
    },
    suggestNextServiceMonths: {
      type: Type.NUMBER,
      description: 'تعداد ماه پیشنهادی برای یادآوری سرویس بعدی (مثلا ۶ برای تعویض فیلتر، ۲۴ برای ممبران)',
    },
    description: { type: Type.STRING, description: 'توضیحات رسمی و تمیز جهت چاپ یا سند فاکتور' },
    conversationalSummary: { type: Type.STRING, description: 'یک جمله خلاصه واضح به زبان فارسی تکنسینی برای نمایش به کاربر' },
    confidence: { type: Type.NUMBER, description: 'اطمینان مدل از ۰ تا ۱' },
    warnings: {
      type: Type.ARRAY,
      description: 'هشدارها (مثل مبلغ مشکوک)',
      items: { type: Type.STRING },
    },
  },
  required: [
    'success',
    'streamType',
    'transactionType',
    'party',
    'totalAmount',
    'paidAmount',
    'financialImpact',
    'description',
    'conversationalSummary',
  ],
};

const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Call Gemini with structured output; validate with zod; retry once on invalid/failure. */
export async function analyzeWithGemini(
  text: string,
  context: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const ai = getClient();
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: `متن ورودی کاربر جهت ثبت سند حسابداری:\n"${text}"\n\nاطلاعات کمکی زمینه کاربر (در صورت وجود): ${JSON.stringify(context)}`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          responseSchema: RESPONSE_SCHEMA as any,
        },
      });
      const raw = response?.text;
      if (!raw) throw new Error('Empty Gemini response');
      const parsed: unknown = JSON.parse(raw.trim());
      const validated = aiAnalysisResultSchema.safeParse(parsed);
      if (!validated.success) throw new Error('Gemini output failed zod validation');
      return validated.data as Record<string, unknown>;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

/** Multimodal: transcribe Persian technician audio into the same structured result. */
export async function analyzeAudioWithGemini(
  audioBase64: string,
  mimeType: string,
  context: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const ai = getClient();
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          { inlineData: { mimeType, data: audioBase64 } },
          {
            text: `این فایل صوتی، گزارش کار یک تکنسین تصفیه آب به زبان فارسی عامیانه است. آن را رونویسی کن و سپس دقیقاً طبق دستورالعمل سیستم، به همان ساختار JSON تراکنش مالی تبدیل کن.\n\nاطلاعات کمکی زمینه: ${JSON.stringify(context)}`,
          },
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          responseSchema: RESPONSE_SCHEMA as any,
        },
      });
      const raw = response?.text;
      if (!raw) throw new Error('Empty Gemini response');
      const parsed: unknown = JSON.parse(raw.trim());
      const validated = aiAnalysisResultSchema.safeParse(parsed);
      if (!validated.success) throw new Error('Gemini output failed zod validation');
      return validated.data as Record<string, unknown>;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
