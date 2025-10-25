const STORAGE_KEY = "goalsplit.analytics.consent";
const SENSITIVE_KEYS = new Set<string>([
  "email",
  "e-mail",
  "phone",
  "telephone",
  "name",
  "full_name",
  "full-name",
  "address",
  "token",
  "session",
  "password",
]);

type AnalyticsPrimitive = string | number | boolean | null;

interface AnalyticsEventPayload {
  event: string;
  timestamp: string;
  properties: Record<string, AnalyticsPrimitive>;
}

type ConsentListener = (consent: boolean) => void;

const isBrowser = () => typeof window !== "undefined";

const redactValue = (key: string, value: unknown): AnalyticsPrimitive => {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const lowerKey = key.toLowerCase();
  if (SENSITIVE_KEYS.has(lowerKey)) {
    return "[redacted]";
  }

  const emailLike = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  if (emailLike.test(value)) {
    return "[redacted]";
  }

  return value.slice(0, 256);
};

const sanitizeProperties = (
  properties: Record<string, unknown> | undefined,
): Record<string, AnalyticsPrimitive> => {
  if (!properties) {
    return {};
  }

  return Object.entries(properties).reduce<Record<string, AnalyticsPrimitive>>(
    (accumulator, [key, value]) => {
      if (value === undefined) {
        return accumulator;
      }

      accumulator[key] = redactValue(key, value);
      return accumulator;
    },
    {},
  );
};

class AnalyticsService {
  private consent = false;
  private consentLoaded = false;
  private buffer: AnalyticsEventPayload[] = [];
  private readonly bufferLimit = 100;
  private listeners: Set<ConsentListener> = new Set<ConsentListener>();
  private unloadRegistered = false;

  private loadConsent(): void {
    if (this.consentLoaded || !isBrowser()) {
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        this.consent = stored === "true";
      }
    } catch (error) {
      console.warn("Failed to read analytics consent flag", error);
    }

    this.consentLoaded = true;
  }

  private persistConsent(value: boolean): void {
    if (!isBrowser()) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
    } catch (error) {
      console.warn("Failed to persist analytics consent flag", error);
    }
  }

  private enqueue(event: AnalyticsEventPayload): void {
    if (this.buffer.length >= this.bufferLimit) {
      this.buffer.shift();
    }
    this.buffer.push(event);
  }

  private emitConsentChange(): void {
    for (const listener of this.listeners) {
      listener(this.consent);
    }
  }

  private registerUnloadHandler(): void {
    if (!isBrowser() || this.unloadRegistered) {
      return;
    }

    const flushBeforeUnload = () => {
      if (!this.consent || this.buffer.length === 0) {
        return;
      }

      const events = [...this.buffer];
      this.buffer = [];
      const payload = JSON.stringify({ events });

      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/analytics", payload);
      } else {
        void fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
          credentials: "include",
        }).catch(() => {
          // Drop failures on unload to avoid blocking navigation.
        });
      }
    };

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushBeforeUnload();
      }
    });
    window.addEventListener("pagehide", flushBeforeUnload);
    this.unloadRegistered = true;
  }

  private async transmit(events: AnalyticsEventPayload[]): Promise<void> {
    if (!isBrowser()) {
      this.buffer.unshift(...events);
      if (this.buffer.length > this.bufferLimit) {
        this.buffer = this.buffer.slice(-this.bufferLimit);
      }
      return;
    }

    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
        keepalive: true,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Analytics request failed with status ${response.status}`);
      }
    } catch (error) {
      console.warn("Failed to deliver analytics events", error);
      this.buffer = events.concat(this.buffer).slice(-this.bufferLimit);
    }
  }

  public init(): void {
    this.loadConsent();
    this.registerUnloadHandler();
  }

  public isEnabled(): boolean {
    this.loadConsent();
    return this.consent;
  }

  public setConsent(value: boolean): void {
    this.loadConsent();
    this.consent = value;
    this.persistConsent(value);
    this.emitConsentChange();

    if (value) {
      const events = [...this.buffer];
      this.buffer = [];
      if (events.length > 0) {
        void this.transmit(events);
      }
    } else {
      this.buffer = [];
    }
  }

  public track(event: string, properties?: Record<string, unknown>): void {
    this.loadConsent();

    const payload: AnalyticsEventPayload = {
      event,
      timestamp: new Date().toISOString(),
      properties: sanitizeProperties(properties),
    };

    if (!this.consent) {
      this.enqueue(payload);
      return;
    }

    void this.transmit([payload]);
  }

  public subscribe(listener: ConsentListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const analytics = new AnalyticsService();
