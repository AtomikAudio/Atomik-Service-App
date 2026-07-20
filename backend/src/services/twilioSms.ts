import crypto from 'crypto';
import { AppConfig } from '../models/AppConfig';
import { toE164 } from '../utils/phone';

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

let cachedConfig: TwilioConfig | null = null;

async function loadTwilioConfig(): Promise<TwilioConfig> {
  if (cachedConfig) return cachedConfig;

  const seeded = (await AppConfig.findOne({ key: 'twilio_sms' }))?.value as
    | { accountSid?: string; fromNumber?: string; authToken?: string }
    | undefined;

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() || seeded?.accountSid;
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim() || seeded?.fromNumber;

  const envToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const authToken =
    envToken && envToken !== 'your_twilio_auth_token_here'
      ? envToken
      : seeded?.authToken?.trim();

  if (!accountSid || !fromNumber) {
    throw new Error(
      'Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_FROM_NUMBER in backend/.env'
    );
  }

  if (!authToken) {
    throw new Error(
      'Twilio Auth Token missing. In your curl, replace [AuthToken] with the secret from Twilio Console → Account → Auth Token → Show, then set TWILIO_AUTH_TOKEN in backend/.env'
    );
  }

  cachedConfig = { accountSid, authToken, fromNumber };
  return cachedConfig;
}

export function generateOtpCode(length = 4): string {
  const max = 10 ** length;
  const code = crypto.randomInt(0, max).toString().padStart(length, '0');
  return code;
}

export function hashOtpCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function sendOtpSms(phone: string, code: string): Promise<void> {
  const config = await loadTwilioConfig();
  const to = toE164(phone);

  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: config.fromNumber,
        // Branded body improves deliverability vs a bare numeric code.
        Body: `ATOMIK Audio: Your verification code is ${code}. Valid for 10 minutes. Do not share this code.`,
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error('Twilio SMS failed:', response.status, detail);

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        'Twilio authentication failed. Check TWILIO_AUTH_TOKEN in backend/.env'
      );
    }
    if (response.status === 400 && detail.includes('21211')) {
      throw new Error('Invalid phone number. Use format +91XXXXXXXXXX');
    }
    // Twilio trial accounts can only SMS verified numbers.
    if (detail.includes('21608') || detail.includes('unverified')) {
      throw new Error(
        'This phone number is not verified for SMS. On a Twilio trial account, verify the number in the Twilio console, or upgrade the account.'
      );
    }

    throw new Error(
      'Could not send verification SMS. Check the phone number and Twilio settings.'
    );
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[OTP] Sent to ${to} (message body is the ${code.length}-digit code)`);
  }
}

export function clearTwilioConfigCache(): void {
  cachedConfig = null;
}
