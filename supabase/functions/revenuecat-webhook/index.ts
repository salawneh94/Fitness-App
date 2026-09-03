// RevenueCat webhook -> subscription_status.
//
// This is the ONLY writer to subscription_status: the table's RLS policy grants clients
// read-only access (see supabase/migrations/0001_init.sql), so a client can never grant itself
// an entitlement — only this function, running with the service-role key, can.
//
// Setup (once the Supabase project exists):
//   1. Generate a random secret and store it:
//        supabase secrets set REVENUECAT_WEBHOOK_SECRET=<random-string>
//   2. Deploy: supabase functions deploy revenuecat-webhook --no-verify-jwt
//      (--no-verify-jwt because RevenueCat calls this directly, not as a logged-in Supabase
//      user — the shared secret below is what authenticates the request instead.)
//   3. In the RevenueCat dashboard: Project Settings -> Integrations -> Webhooks, set the URL to
//      https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook and the Authorization
//      header to "Bearer <the same random string>".
//
// The single entitlement this app gates on — must match ENTITLEMENT_ID in
// apps/mobile/src/lib/revenuecat.ts and the identifier configured in the RevenueCat dashboard.
const ENTITLEMENT_ID = 'pro';

import { createClient } from 'npm:@supabase/supabase-js@2';

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  entitlement_ids?: string[] | null;
  product_id?: string | null;
  expiration_at_ms?: number | null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const expectedAuth = `Bearer ${Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? ''}`;
  if (!Deno.env.get('REVENUECAT_WEBHOOK_SECRET') || req.headers.get('Authorization') !== expectedAuth) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { event?: RevenueCatEvent };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const event = body.event;
  if (!event?.app_user_id || !event.type) {
    return new Response('Missing event fields', { status: 400 });
  }

  const hasEntitlement = event.entitlement_ids?.includes(ENTITLEMENT_ID) ?? false;
  const expirationAtMs = event.expiration_at_ms ?? null;
  const notExpired = expirationAtMs == null || expirationAtMs > Date.now();
  // EXPIRATION means access has actually ended; every other event type that still carries the
  // entitlement (renewal, trial started/converted, uncancellation, product change, ...) keeps it
  // active as long as the expiration date hasn't already passed.
  const entitlementActive = hasEntitlement && event.type !== 'EXPIRATION' && notExpired;

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { error } = await supabase.from('subscription_status').upsert({
    user_id: event.app_user_id,
    entitlement_active: entitlementActive,
    product_id: event.product_id ?? null,
    expires_at: expirationAtMs ? new Date(expirationAtMs).toISOString() : null,
  });

  if (error) {
    console.error('subscription_status upsert failed', error);
    return new Response('Database error', { status: 500 });
  }

  return new Response('OK', { status: 200 });
});
