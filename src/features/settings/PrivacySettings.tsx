'use client';

import { useEffect, useState } from 'react';

import { analytics } from '@/lib/analytics';

type ToggleState = 'enabled' | 'disabled';

const describeState = (state: ToggleState) =>
  state === 'enabled' ? 'Analytics is currently enabled.' : 'Analytics is currently disabled.';

export const PrivacySettings = (): JSX.Element => {
  const [consent, setConsent] = useState<ToggleState>('disabled');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    analytics.init();
    const currentConsent = analytics.isEnabled() ? 'enabled' : 'disabled';
    setConsent(currentConsent);
    setHydrated(true);

    return analytics.subscribe((value) => {
      setConsent(value ? 'enabled' : 'disabled');
    });
  }, []);

  const handleToggle = () => {
    const nextConsent = consent === 'enabled' ? 'disabled' : 'enabled';

    if (nextConsent === 'enabled') {
      analytics.track('analytics_consent_granted', {
        source: 'account_settings',
      });
    } else {
      analytics.track('analytics_consent_revoked', {
        source: 'account_settings',
      });
    }

    analytics.setConsent(nextConsent === 'enabled');
    setConsent(nextConsent);
  };

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-neutral-900">Privacy controls</h2>
        <p className="text-sm text-neutral-600">
          GoalSplit collects only anonymous product usage metrics. We never store personal details
          in analytics events, and data older than 60 days is routinely deleted.
        </p>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-semibold text-neutral-900">Allow product analytics</p>
          <p className="text-sm text-neutral-600">{describeState(consent)}</p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={!hydrated}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
            consent === 'enabled'
              ? 'border-primary-300 bg-primary-50 text-primary-800'
              : 'border-neutral-200 bg-white text-neutral-700'
          } ${hydrated ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
          aria-pressed={consent === 'enabled'}
        >
          <span>{consent === 'enabled' ? 'Disable' : 'Enable'}</span>
        </button>
      </div>
    </section>
  );
};

export default PrivacySettings;
