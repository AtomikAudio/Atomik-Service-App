/**
 * Send device push notifications via Expo Push Service.
 * Tokens are Expo push tokens stored on User.fcmToken (legacy field name).
 */
function serializeData(
  data?: Record<string, unknown>
): Record<string, string> {
  if (!data) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    out[key] = typeof value === 'string' ? value : String(value);
  }
  return out;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Sends push notifications and returns the tokens that Expo reported as
 * permanently invalid (`DeviceNotRegistered`) so the caller can prune them.
 *
 * Expo returns HTTP 200 even when individual messages fail — the real outcome
 * is in each ticket's `status`/`details.error`. We log those so delivery
 * problems (e.g. `MismatchSenderId` / missing FCM credentials) are visible.
 */
export async function sendExpoPushToTokens(
  tokens: Array<string | null | undefined>,
  payload: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): Promise<{ invalidTokens: string[] }> {
  const unique = [
    ...new Set(
      tokens
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter(
          (t) =>
            t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[')
        )
    ),
  ];

  if (unique.length === 0) return { invalidTokens: [] };

  const data = serializeData(payload.data);
  const invalidTokens: string[] = [];

  try {
    // Expo accepts up to 100 messages per request.
    for (let i = 0; i < unique.length; i += 100) {
      const chunkTokens = unique.slice(i, i + 100);
      const chunk = chunkTokens.map((to) => ({
        to,
        sound: 'default' as const,
        title: payload.title,
        body: payload.body,
        data,
        channelId: 'default',
        priority: 'high' as const,
      }));

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn(
          `[push] Expo push failed (${res.status}): ${text.slice(0, 300)}`
        );
        continue;
      }

      const json = (await res.json().catch(() => null)) as
        | { data?: ExpoPushTicket[] }
        | null;
      const tickets = json?.data ?? [];
      tickets.forEach((ticket, idx) => {
        if (ticket.status !== 'error') return;
        const token = chunkTokens[idx];
        const code = ticket.details?.error ?? 'Unknown';
        console.warn(
          `[push] Ticket error for ${token}: ${code} — ${ticket.message ?? ''}`
        );
        // Drop permanently-bad tokens so the device can re-register on next login.
        if (
          code === 'DeviceNotRegistered' ||
          code === 'InvalidCredentials' ||
          code === 'MismatchSenderId'
        ) {
          invalidTokens.push(token);
        }
      });
    }
  } catch (err) {
    console.warn('[push] Expo push request error:', err);
  }

  return { invalidTokens };
}
