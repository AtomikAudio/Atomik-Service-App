import { Router } from 'express';

/**
 * Public, self-contained Privacy Policy and Support pages required for the
 * App Store / Play Store listing. Mounted BEFORE the security middleware so
 * Helmet's CSP does not strip the inline styles used here.
 */

const SUPPORT_EMAIL = 'djsahilmadan@gmail.com';
const EFFECTIVE_DATE = 'June 25, 2026';

const baseStyles = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #231f20;
    color: #e8e6e6;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
  }
  .wrap { max-width: 760px; margin: 0 auto; padding: 48px 22px 96px; }
  header { border-bottom: 1px solid #3a3536; padding-bottom: 20px; margin-bottom: 28px; }
  .brand { font-size: 22px; font-weight: 700; letter-spacing: 1px; }
  .brand span { color: #ed1d24; }
  .tag { color: #9a9596; font-size: 13px; margin-top: 4px; }
  h1 { font-size: 26px; margin: 0 0 6px; }
  h2 { font-size: 18px; margin: 32px 0 10px; color: #fff; }
  .meta { color: #9a9596; font-size: 13px; margin-bottom: 8px; }
  p, li { color: #cfcbcc; font-size: 15px; }
  a { color: #ed1d24; }
  ul { padding-left: 20px; }
  .card { background: #2b2728; border: 1px solid #3a3536; border-radius: 12px; padding: 18px 20px; margin: 18px 0; }
  footer { margin-top: 48px; border-top: 1px solid #3a3536; padding-top: 18px; color: #777; font-size: 13px; }
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="index,follow" />
<title>${title} — ATOMIK Audio</title>
<style>${baseStyles}</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="brand">ATOMIK<span>•</span> Audio</div>
      <div class="tag">Audio Engineering and Design<br/>Service Infrastructure</div>
    </header>
    ${body}
    <footer>
      © 2026 Atomik Audio. All rights reserved. ·
      <a href="/privacy">Privacy</a> · <a href="/support">Support</a>
    </footer>
  </div>
</body>
</html>`;
}

const privacyBody = `
  <h1>Privacy Policy</h1>
  <div class="meta">Effective ${EFFECTIVE_DATE}</div>
  <p>This Privacy Policy explains how the ATOMIK Audio mobile application ("ATOMIK", "we", "us") collects, uses, and protects your information. By using the app you agree to this policy.</p>

  <h2>Information We Collect</h2>
  <ul>
    <li><strong>Account information</strong> — your name, email address, and phone number, used to create and secure your account.</li>
    <li><strong>Service and venue details</strong> — locations you save (including map coordinates) and the service requests you create.</li>
    <li><strong>Reference photos</strong> — images you choose to attach to a service request.</li>
    <li><strong>Payment information</strong> — payments are processed by our third-party payment provider (Razorpay). We do not store your full card details on our servers.</li>
    <li><strong>Usage and device data</strong> — basic technical information needed to operate the service reliably.</li>
  </ul>

  <h2>How We Use Your Information</h2>
  <ul>
    <li>To provide core app functionality: booking, assigning, and tracking service visits.</li>
    <li>To communicate with you about your bookings and account.</li>
    <li>To process payments for services you request.</li>
    <li>To maintain security and prevent abuse of the service.</li>
  </ul>

  <h2>Permissions</h2>
  <p>The app may request the following permissions, all optional and only used for the stated purpose:</p>
  <ul>
    <li><strong>Location</strong> — to pin your service venue on the map.</li>
    <li><strong>Camera / Photo Library</strong> — to attach reference photos to a service request.</li>
  </ul>
  <p>The app remains usable without granting these permissions.</p>

  <h2>Sharing of Information</h2>
  <p>We do not sell your personal information. We share data only with service providers that help us operate the app (such as cloud hosting, image storage, and payment processing) and only as needed to deliver the service, or where required by law.</p>

  <h2>Data Retention</h2>
  <p>We retain your information for as long as your account is active or as needed to provide the service and meet legal obligations. You may request deletion of your account and associated data at any time.</p>

  <h2>Security</h2>
  <p>We use industry-standard measures including encrypted connections and access controls to protect your data. No method of transmission or storage is completely secure, but we work to protect your information.</p>

  <h2>Children's Privacy</h2>
  <p>ATOMIK is intended for business and professional use and is not directed to children under 13.</p>

  <h2>Your Rights</h2>
  <p>You may access, correct, or delete your personal information, or withdraw consent, by contacting us at the email below.</p>

  <h2>Changes to This Policy</h2>
  <p>We may update this policy from time to time. Material changes will be reflected by updating the effective date above.</p>

  <h2>Contact Us</h2>
  <div class="card">
    Questions about this policy or your data? Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.
  </div>
`;

const supportBody = `
  <h1>Support</h1>
  <div class="meta">We're here to help.</div>
  <p>Need help with the ATOMIK Audio app? We're happy to assist with account access, bookings, payments, or any technical issue.</p>

  <h2>Contact</h2>
  <div class="card">
    <p style="margin:0 0 6px"><strong>Email:</strong> <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
    <p style="margin:0"><strong>Response time:</strong> typically within 1–2 business days.</p>
  </div>

  <h2>Common Questions</h2>
  <ul>
    <li><strong>How do I book a service?</strong> Sign in, tap “Book a Service”, choose a service type, add details, and confirm.</li>
    <li><strong>How do I add a venue?</strong> Open Venues, add an address, and optionally pin its location on the map.</li>
    <li><strong>I can't sign in.</strong> Make sure you're using the email or phone number and password tied to your account, then contact us if the issue continues.</li>
    <li><strong>How do I delete my account?</strong> Email us at the address above and we'll process your request.</li>
  </ul>

  <h2>Privacy</h2>
  <p>Read how we handle your data in our <a href="/privacy">Privacy Policy</a>.</p>
`;

const router = Router();

router.get('/privacy', (_req, res) => {
  res.type('html').send(page('Privacy Policy', privacyBody));
});

router.get('/support', (_req, res) => {
  res.type('html').send(page('Support', supportBody));
});

export default router;
