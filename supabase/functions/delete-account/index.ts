// Self-service account deletion, called from the mobile app's Profile screen.
// Apple requires this in-app for any app with account creation (Guideline 5.1.1v).
//
// Deploy: supabase functions deploy delete-account
// (JWT verification stays ON for this one, unlike the RevenueCat webhook — the caller must be
// a signed-in Supabase user, and the function only ever deletes *that* caller's own account.)
//
// Deleting the auth.users row cascades to every table in 0001_init.sql (each has
// `references auth.users(id) on delete cascade`), so Postgres cleanup is automatic. Storage
// objects are not covered by that cascade, so this function removes the user's
// progress-photos/{user_id}/ folder first.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Missing Authorization header', { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Identify the caller with their own JWT (anon-key client) — this is what makes it safe for
  // this function to delete "the current user" without a client ever supplying a user id.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();

  if (userError || !user) {
    return new Response('Invalid session', { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: files } = await adminClient.storage.from('progress-photos').list(user.id);
  if (files && files.length > 0) {
    await adminClient.storage.from('progress-photos').remove(files.map((f) => `${user.id}/${f.name}`));
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('deleteUser failed', deleteError);
    return new Response('Could not delete account', { status: 500 });
  }

  return new Response('OK', { status: 200 });
});
