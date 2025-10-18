import PrivacySettings from '@/features/settings/PrivacySettings';

export const dynamic = 'force-static';

export default function AccountSettingsPage(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-12 px-6 py-16 sm:px-10 lg:px-12">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Account</p>
        <h1 className="font-display text-4xl font-bold text-neutral-900">Settings</h1>
        <p className="max-w-2xl text-base text-neutral-600">
          Manage your communication preferences, privacy controls, and security from this page.
        </p>
      </header>

      <div className="space-y-8">
        <PrivacySettings />
      </div>
    </main>
  );
}
