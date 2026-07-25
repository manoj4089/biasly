"use client";

import posthog from "posthog-js";

export default function NewsletterForm() {
  return (
    <form
      className="newsletter-form"
      onSubmit={(event) => {
        event.preventDefault();
        posthog.capture("newsletter_subscribe_submitted", {
          location: "article_detail",
        });
      }}
    >
      <input type="email" placeholder="Enter your email" required aria-label="Email address" />
      <button type="submit" className="subscribe-button">Subscribe</button>
    </form>
  );
}
