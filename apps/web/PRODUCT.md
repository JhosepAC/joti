# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People organizing study, work, personal projects, relationships, and shared plans. They may use a phone or a desktop browser.

## Product Purpose

Nook brings the information for each area of life into an independent, customizable space. A space defines context; its modules organize the information.

## Operating Context

Create an account, verify email, finish a profile, then create the first space or return to an existing workspace. Account recovery uses an emailed, single-use password reset link.

## Capabilities and Constraints

The application uses Next.js, React, Convex, and next-intl (Spanish and English). Preserve the existing stack and space onboarding. Use free tools and services. Authentication uses email and password; Google sign-in is excluded by the user's explicit request. The product name is Nook, confirmed by the user. Browser sessions use an HttpOnly cookie with a seven-day lifetime; short-lived scoped grants authorize Convex operations.

## Evidence on Hand

`../../docs/business_context.md` describes the product. `../../docs/technical_specifications.md` requires free tooling. The current code implements account verification, password recovery, profiles, and spaces. Do not invent customers, statistics, testimonials, or legal policies.

## Product Principles

- Organize by context rather than imposing a rigid system.
- Start simple and personalize progressively.
- Keep spaces private by default.
- Preserve information reliably and make recovery understandable.

## Accessibility & Inclusion

Keyboard navigation, accessible forms and errors, reduced motion, and usable mobile layouts are explicit product principles in the supplied documentation.
