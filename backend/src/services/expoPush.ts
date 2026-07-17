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

export async function sendExpoPushToTokens(
  tokens: Array<string | null | undefined>,
  payload: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): Promise<void> {
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

  if (unique.length === 0) return;

  const data = serializeData(payload.data);
  const messages = unique.map((to) => ({
    to,
    sound: 'default' as const,
    title: payload.title,
    body: payload.body,
    data,
    channelId: 'default',
    priority: 'high' as const,
  }));

  try {
    // Expo accepts up to 100 messages per request.
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
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
          `[push] Expo push failed (${res.status}): ${text.slice(0, 200)}`
        );
      }
    }
  } catch (err) {
    console.warn('[push] Expo push request error:', err);
  }
}
