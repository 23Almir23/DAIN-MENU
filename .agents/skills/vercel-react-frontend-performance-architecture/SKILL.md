---
name: vercel-react-frontend-performance-architecture
description: Use this skill when building, reviewing, or refining frontend architecture, rendering behavior, state management, performance, reliability, and production readiness in React applications, especially for Vercel-style quality standards.
---

# Vercel / React / Frontend Performance & Architecture

Build frontend systems that are fast, stable, maintainable, and production-ready.

This skill is especially relevant for MenuAI, where the product includes a dense operator workspace, live preview surfaces, AI-driven UI states, and multiple interconnected flows that must stay responsive and reliable.

## Core Rule
Prefer frontend decisions that improve correctness, rendering stability, state clarity, maintainability, and perceived speed.

Do not optimize for cleverness.
Do not add architectural complexity unless it clearly improves reliability or user experience.

## Always optimize for
- clear component boundaries
- predictable state flow
- minimal unnecessary re-renders
- reliable async UI states
- low UI jitter
- production-readiness
- maintainable code paths
- performance under realistic operator usage

## Architecture principles
- Keep data flow easy to reason about
- Prefer simple and explicit state over hidden coordination
- Avoid duplicated state unless there is a clear performance or UX reason
- Co-locate logic where it improves readability, not where it hides responsibility
- Separate view logic from transformation logic when complexity grows
- Make empty, loading, error, success, and partial states explicit
- Prefer additive changes over risky rewrites when refining live surfaces

## React-specific rules
- Avoid unnecessary prop drilling when composition or local structure solves the problem better
- Avoid unstable inline logic when it causes rendering noise or unreadability
- Keep derived state derived when possible
- Be careful with effects: every effect should have a clear reason to exist
- Avoid effect chains that simulate architecture
- Prefer declarative UI over imperative patching
- Keep component responsibilities narrow enough to remain understandable
- Be explicit when forcing remounts, resetting state, or syncing with storage

## Performance rules
- Reduce unnecessary re-renders in dense views
- Treat operator workspaces as performance-sensitive surfaces
- Avoid wasteful recalculation in render paths
- Keep expensive mapping/filtering/memoization decisions intentional
- Optimize only where user-facing responsiveness or code clarity benefits
- Do not cargo-cult memoization
- Favor stable UX over micro-optimizations that make code harder to maintain

## Reliability rules
- Every user-facing state should be trustworthy
- Empty state, loading state, error state, and optimistic state must not contradict each other
- Links, buttons, and banners must lead somewhere meaningful
- Persisted UI state (localStorage/sessionStorage) must behave intentionally and be scoped correctly
- Avoid UI states where a user clicks and nothing visibly happens unless that behavior is explicitly correct

## MenuAI-specific frontend standards
- Workspace, AI Studio, Dashboard, Preview, QR, Settings, and Billing must remain clearly separated in responsibility
- Shared guidance logic must stay consistent across surfaces
- Do not reintroduce dead-end states
- Do not create misleading state relationships between surfaces
- Operator-facing performance matters more than decorative transitions
- Live preview and operator editing surfaces must feel stable and responsive
- Changes to state persistence, dismissals, or recovery affordances must be intentional and easy to reason about
- Commercial honesty and UI correctness are frontend architecture concerns too, not just copy concerns

## Reject these patterns
- hidden state coupling
- duplicated truth across components without clear ownership
- effects used as glue for weak architecture
- over-abstracted component systems that hide product logic
- premature complexity
- UI features that create state ambiguity
- performance hacks that reduce clarity
- inconsistent loading or error handling
- silent failures
- "click does nothing" states unless intentionally designed and explained

## Evaluate every frontend change by asking
- Is the data flow clearer or murkier after this change?
- Does this reduce or increase rendering complexity?
- Does this create any hidden state coupling?
- Will this behave predictably across navigation, reload, and session boundaries?
- Does this improve reliability for a restaurant operator using the product in real work?
- Is this production-minded, or just locally convenient?

## Final Rule
If a change makes the frontend more complex without improving correctness, reliability, or operator experience, reject it.
If a change makes the system clearer, more stable, and more production-ready, prefer it.
