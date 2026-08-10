# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary audiences, deliberately served by the same app:

1. **Existing/prospective course participants** — people who take (or are about to take) in-person breathwork courses and use the app to build a self-guided breathing routine between sessions.
2. **Cold audience from social media** — people with no prior contact who discover the app through social media marketing and enter with no course relationship at all.

The app is not scoped to just one of these; both are confirmed as primary.

## Product Purpose

Free guided box-breathing sequences plus a paid custom sequence configurator (the paid capability is the *right to save* a custom sequence, not gated content). The app is a dual-purpose tool: a standalone breathing-practice product in its own right, and a marketing/lead-generation channel that converts newcomers into paying course participants.

## Positioning

An independent app product that grows through its own reach (primarily social media), not merely a digital extension of existing courses. At the same time it doubles as an acquisition channel: new users who arrive via the app are meant to convert into course participants. This dual role — standalone product *and* course funnel — should inform content and structural decisions (e.g., a real, visible Kurse page with an external signup link; a Team page with real people and bios, since trust-building matters more for the cold, no-prior-contact audience).

## Operating Context

- An existing in-person coaching business runs alongside the app: courses have a location, price info, and an external signup link (`courses` table).
- Content editing (News, Kurse, Team) happens through Supabase Studio directly — there is deliberately no in-app admin UI in this phase.
- German-language, Austria-based (Kleinunternehmerregelung / small-business VAT exemption referenced in SAD §4.5).
- No trial period: the sequence configurator is usable without an account; only saving a sequence requires Plus. Trying it out replaces a trial as the sales argument.
- The app is currently replacing an existing separate website outright — News, Kurse, Team, navigation, and legal pages (Impressum/Datenschutz) exist specifically so the app can take over the main domain immediately, collapsing two hosting setups into one.

## Capabilities and Constraints

- Free, permanent: preconfigured box-breathing sequences and videos (Vimeo, private + domain-restricted).
- Paid (Plus): the sequence configurator — building and *saving* custom box-breathing sequences. Reading, playing, and deleting one's own saved sequences stays allowed even after a subscription lapses.
- Audio cues are synthetic tones only (`OscillatorNode`) — no spoken guidance, no background music files (CLAUDE.md; supersedes an older SAD passage that still mentions music/voice — CLAUDE.md is the binding source).
- Deliberately outside medical device (MDR) scope: no diagnosis, no therapy recommendations, no automated health warnings. Metrics like BOLT score are presented as training metrics, never as medical readings with a "your value is too low" framing.
- Web-only in V1, delivered as an installable PWA (static export, no server process). Native apps are V2, same Expo codebase.
- Explicitly out of scope for V1 (do not start work here without flagging it): breathing journal, micro habits, session log, guided/spoken recordings, trial periods, lifetime pricing, native apps, offline mode, in-app content admin UI.

## Brand Commitments

- "TheHaCode" is the confirmed, final public product/brand name — not a placeholder or internal codename. (Current `home.title`/`home.subtitle` strings in the code are still literal placeholders — "TheHaCode" / "In Entwicklung" — and need real hero copy, not a name change.)
- The Team page shows real people with photos and short bios. Personal visibility of the trainers/coaches is part of building trust, which matters especially for the cold social-media audience with no prior relationship to the business.

## Evidence on Hand

- No real content is populated yet: News, Kurse, and Team are all empty in the running app (empty states currently show: "Noch keine Neuigkeiten", "Aktuell keine Kurse", "Team wird gerade vorgestellt").
- No testimonials, customer quotes, or press mentions exist — future work must not invent any.
- No UI specification exists: the README references a `ui/*.svg` spec directory, but it is currently empty. The only committed visual authority is `src/design/tokens.ts` (a minimal token set: background/surface/text/brand colors, spacing, radius) and the stated design principle in `docs/SAD.md` §6 — "minimalistisch-medizinisch": white, generous whitespace, thin hairline borders, two calm accent colors, no shadows, no gradients, no illustrations; the breathing animation itself is the one deliberate visual highlight.

## Product Principles

- One system, not two: the app fully replaces the old website (including legal pages) to enable an immediate move onto the main domain and collapse two hosting contracts into one.
- Access is a capability, not content: reading, playing, and deleting one's own sequences stays available regardless of subscription status; only the ability to save new custom sequences is gated.
- No trial period, but the configurator works fully while logged out — hands-on trying replaces the trial as the conversion argument.
- The app is simultaneously product and acquisition channel: content and structural decisions (Kurse, Team, hero framing) must work for cold, no-context visitors as well as for existing course participants.
- Low-maintenance beats elegant: a two-person, part-time (20 hrs/week combined) team builds this: fewer moving parts wins over an individually optimal solution.

## Accessibility & Inclusion

- Visible keyboard focus is required on all interactive elements (Backlog T03 acceptance criterion).
- Body text must use only the 700-weight color tokens, ≥4.5:1 contrast (CLAUDE.md, enforced project rule).
- No further product-specific accessibility requirement has been confirmed beyond these standard bars.
