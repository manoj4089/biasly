"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

export default function PostHogIdentifier() {
  const { user, isLoaded, isSignedIn } = useUser();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && user) {
      wasSignedIn.current = true;
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
      });
    } else if (wasSignedIn.current) {
      // Only reset when transitioning out of an identified session
      wasSignedIn.current = false;
      posthog.reset();
    }
  }, [isLoaded, isSignedIn, user]);

  return null;
}
