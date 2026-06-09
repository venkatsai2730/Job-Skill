import mixpanel from "mixpanel-browser";
import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

// In production, use your actual Mixpanel project token.
// For development, we use a placeholder or check ENV.
const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN || "mock-token-12345";

export const useTracking = () => {
  const { user } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      mixpanel.init(MIXPANEL_TOKEN, {
        debug: import.meta.env.DEV, // Log events to console in dev mode
        track_pageview: true,
        persistence: "localStorage",
      });
      initialized.current = true;
    }

    if (user) {
      mixpanel.identify(user.id);
      mixpanel.people.set({
        $email: user.email,
        $name: user.fullName || user.email?.split("@")[0],
        CreditsList: user.dailyCreditsLimit,
      });
    }
  }, [user]);

  const track = (eventName: string, properties?: Record<string, any>) => {
    try {
      if (initialized.current) {
        mixpanel.track(eventName, {
          ...properties,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn("Mixpanel track error:", e);
    }
  };

  return { track };
};
