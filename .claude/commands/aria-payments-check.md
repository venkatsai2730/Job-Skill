---
description: Exercise the Pricing + payment path and report the integration status. Currently surfaces that payment backend routes are not yet implemented.
argument-hint: "[optional test user id]"
---

Check the JobSkill AI ("Aria") payments/Pricing path. Optional test user: **$ARGUMENTS**.

First call `mcp__aria__aria_verify_payment_flow`. Today this is a **stub** because the app ships a Pricing UI but no checkout/payment backend routes — so expect a "not implemented" result. That is the correct current state, not a bug to hide.

Then dispatch in parallel:

1. **frontend-agent** — "Open the Pricing page in the browser via Playwright. Confirm plans render, CTAs are present, and capture what happens when a plan/CTA is clicked (does it route anywhere, call any API, or dead-end?). Report with snapshots + network log."
2. **backend-agent** — "Grep the server for any payment/checkout/Stripe/Razorpay routes or services. Confirm whether `aria_verify_payment_flow` should call a real endpoint. Report exactly what exists vs. what's missing."

Synthesize into a **payments readiness report**:
- Current state (UI present? backend present?) with evidence
- The gap to a working flow (e.g. "add POST /api/payments/checkout → Razorpay test order → webhook")
- A short, ordered implementation checklist

If the user wants it built, offer to scaffold the route + update the `aria_verify_payment_flow` tool to call it — but only after they confirm the provider (Stripe vs Razorpay) and that it's a test/sandbox environment.
