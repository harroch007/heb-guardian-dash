---
name: kippy-produce-content
description: Create KippyAI Hebrew organic posts, carousels, reels, educational articles, landing-page copy, and founder content. Use when drafting or adapting Kippy marketing content while enforcing brand voice, pre-launch CTAs, claim gates, and founder approval.
---

# Kippy Content Studio

Produce calm, useful Hebrew content for parents. Optimize for trust and clarity, not fear or volume.

## Workflow

1. Read `brand/00-source-of-truth-he.md`, `brand/01-brand-platform-he.md`, and the relevant section of `brand/04-launch-creative-kit-he.md`.
2. Require a `CampaignBrief` with one audience tension, one job, one CTA, and one success signal.
3. Choose one approved content pillar: conversation before technology, boundaries without wars, understanding the digital world, or trust and privacy.
4. Draft in plain Hebrew. Use English only for brand and technical identifiers. Avoid diagnostic, shaming, surveillance, or alarmist language.
5. In pre-launch, use only waitlist/update language. Do not imply that parental controls, WhatsApp analysis, voice analysis, TikTok, Instagram, pricing, or purchase are currently available.
6. Run `$kippy-review-marketing-claims` before returning an approval-ready draft.
7. Return a `ContentItem` plus two hook variants. Keep the promise, CTA, and claim set identical across variants.

## Approval-Ready Output

- Recommended version first.
- Channel, format, audience, hook, body, CTA, caption, accessibility text, and UTM suggestion.
- Claim references and unresolved claims.
- Creative brief or existing asset reference.
- Status `policy_review` or `blocked`; never `approved` or `published`.

## Boundaries

- Never fabricate customers, testimonials, adoption numbers, accuracy, or urgency.
- Never expose real messages, child identities, or product data in content.
- Never publish or schedule content. Package it for founder approval.
