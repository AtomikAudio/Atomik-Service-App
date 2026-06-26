import { ID } from './appwriteId';

export type OtpPurpose =
  | 'signup'
  | 'login'
  | 'technician_signup'
  | 'technician_login'
  | 'forgot_password';

export function isAppwriteConfigured(): boolean {
  return !!(
    process.env.APPWRITE_ENDPOINT?.trim() &&
    process.env.APPWRITE_PROJECT_ID?.trim()
  );
}

function getEndpoint(): string {
  const base = process.env.APPWRITE_ENDPOINT!.trim().replace(/\/$/, '');
  return base.endsWith('/v1') ? base : `${base}/v1`;
}

function projectHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': process.env.APPWRITE_PROJECT_ID!.trim(),
  };
}

async function appwriteJson<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${getEndpoint()}${path}`, {
    method: 'POST',
    headers: projectHeaders(),
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    message?: string;
  };

  if (!res.ok) {
    const msg =
      (data as { message?: string }).message ||
      `Appwrite request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

/** Send SMS OTP via Appwrite; returns Appwrite user id to store until verify. */
export async function appwriteSendPhoneToken(
  phoneE164: string,
  existingUserId?: string
): Promise<{ userId: string }> {
  const userId = existingUserId?.trim() || ID.unique();

  const token = await appwriteJson<{ userId: string }>(
    '/account/tokens/phone',
    {
      userId,
      phone: phoneE164,
    }
  );

  return { userId: token.userId || userId };
}

/** Verify OTP and create an Appwrite session (validates the code). */
export async function appwriteVerifyPhoneOtp(
  appwriteUserId: string,
  otp: string
): Promise<void> {
  await appwriteJson('/account/sessions', {
    userId: appwriteUserId,
    secret: String(otp).trim(),
  });
}
