# SAM for Creators — Project Skill

## Email Setup (completed May 16 2026)
- joey@samforcreators.com forwards to samforcreators@gmail.com
- File: api/email/forward.js
- Commit: bde7a09 on quietstudio branch

### Environment Variables (all in Vercel)
- RESEND_API_KEY = send-only key (existing, used by app to send emails)
- RESEND_ADMIN_KEY = stored in Vercel only (full access, added May 16 2026, used to manage webhooks via API)
- GMAIL_FORWARD_ADDRESS = samforcreators@gmail.com
- RESEND_DOMAIN = samforcreators.com

### How it works
1. Email sent to joey@samforcreators.com
2. Porkbun DNS MX record routes to inbound.resend.com
3. Resend fires webhook to https://samforcreators.com/api/email/forward
4. Webhook ID: 6826d0cc-8f9e-4ffd-9533-5dc6db6e83d0
5. Function forwards to samforcreators@gmail.com with original sender in Reply-To

### DNS (Porkbun)
- MX @ priority 10 → inbound.resend.com (TTL 600)
- Removed: fwd1.porkbun.com and fwd2.porkbun.com
