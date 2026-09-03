const EFFECTIVE_DATE = 'TBD — set this when you publish';
const CONTACT_EMAIL = 'REPLACE_WITH_SUPPORT_EMAIL';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen px-6 py-12" style={{ backgroundColor: 'var(--background, #0b0d14)', color: 'var(--text-primary)' }}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">FitTrack Privacy Policy</h1>
        <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>
          Effective date: {EFFECTIVE_DATE}
        </p>

        <Section title="What this covers">
          <p>
            This policy explains what FitTrack ("we", "the app") collects when you use the FitTrack mobile app,
            why we collect it, and how you can control or delete it.
          </p>
        </Section>

        <Section title="Information we collect">
          <p><strong>Account information.</strong> Your email address and password (password is never visible to
            us — it's handled by our authentication provider, Supabase, using industry-standard hashing).</p>
          <p><strong>Profile information.</strong> Age, sex, height, weight, fitness goals, activity level, and
            training preferences you enter during onboarding or in your profile.</p>
          <p><strong>Health and fitness logs.</strong> Weight, steps, and sleep entries; food and meal logs
            (including any nutrition data you enter manually or retrieve by scanning a barcode); workout
            schedules and logged sets/reps; body measurements; and progress photos you choose to add.</p>
          <p><strong>Subscription information.</strong> Your subscription status (active, trialing, expired) so
            the app can unlock the features you've paid for. Payment details themselves (card numbers, etc.) are
            handled entirely by Apple or Google and are never seen by us.</p>
          <p>We do not currently collect analytics, advertising identifiers, or usage-tracking data of any kind.</p>
        </Section>

        <Section title="How we use your information">
          <p>
            Everything above is used for exactly one purpose: running the app for you — calculating your daily
            targets, showing your trends and history, syncing your data across your own devices, and managing
            your subscription. We do not sell your data, and we do not use it for advertising.
          </p>
        </Section>

        <Section title="Where your data is stored">
          <p>
            Your data is stored in a managed Postgres database and file storage operated by Supabase, our backend
            provider, encrypted in transit and at rest. Access is enforced at the database level (row-level
            security), so your data is only ever readable by your own signed-in account — not by other users, and
            not by us in the normal course of operating the app.
          </p>
        </Section>

        <Section title="Third parties we work with">
          <p><strong>Supabase</strong> — database, authentication, and file storage.</p>
          <p><strong>RevenueCat</strong> — subscription and entitlement management, itself built on Apple's
            StoreKit and Google Play Billing. RevenueCat receives your purchase/subscription events but not your
            fitness data.</p>
          <p><strong>Open Food Facts</strong> — when you scan a barcode, the barcode number is sent to Open Food
            Facts's public product database to look up nutrition info. No account or profile information is sent
            with that request.</p>
          <p><strong>Apple / Google</strong> — app distribution and in-app purchase processing, governed by their
            own privacy policies.</p>
        </Section>

        <Section title="Your choices">
          <p><strong>Access & export.</strong> Everything you've entered is visible to you in the app at any time.</p>
          <p><strong>Deletion.</strong> You can delete individual entries (food logs, workouts, photos, etc.)
            directly in the app at any time. To delete your account and all associated data, email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a> from your account's
            email address, and we'll delete it within 30 days.</p>
          <p><strong>Sign out.</strong> Signing out on a device stops that device from syncing, but doesn't delete
            your account.</p>
        </Section>

        <Section title="Children's privacy">
          <p>
            FitTrack is not directed at children under 13, and we do not knowingly collect information from
            children under 13. If you believe a child has created an account, contact us and we'll delete it.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we make material changes to this policy, we'll update the effective date above and, where
            required, notify you in the app.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or your data? Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.
          </p>
        </Section>
      </div>
    </div>
  );
}
