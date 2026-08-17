# LifeOS Documentary Studio

## Goal
Build an AI-directed long-form documentary pipeline for Bence's Hungarian personal film: **Ami még előttem áll**.

## Current MVP
- `/dashboard/documentary` page
- Editable master director brief
- 12-chapter story structure
- Personal media upload selection in the browser
- Privacy-first product direction
- Provider-agnostic render architecture target

## Next implementation stages
1. Persist projects, chapters, assets and generations in Supabase.
2. Upload media to private Supabase Storage buckets; create signed URLs only when needed.
3. Add an AI screenplay/storyboard endpoint using the configured OpenAI integration already present in LifeOS.
4. Add scene-level regeneration and user guidance: `make this more emotional`, `use my real footage`, `shorten this`, `change music`, etc.
5. Add a provider adapter layer for image/video generation and TTS rather than hard-coding a vendor.
6. Add FFmpeg/Remotion-based timeline rendering on a server/worker capable of long-running jobs. Do not attempt 30-minute rendering inside a normal Next.js request.
7. Add render job status, preview, chapter approval, final MP4 export and YouTube-ready metadata.
8. Add automated privacy processing: face/license-plate/document redaction before generated/public output.

## Product principle
The user is the director. AI should make creative decisions autonomously inside explicit constraints, while preserving factual truth and allowing scene-level guidance.

## Important factual constraints
- Real uploaded personal media should take priority over generic stock/AI media.
- Never invent major life events.
- Future goals must be presented as future goals.
- Do not expose sensitive documents, addresses, license plates, access codes or security-system details.
- Hungarian narration should be natural and cinematic, not machine-translated or overly theatrical.
