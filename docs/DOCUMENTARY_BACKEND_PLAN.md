# Documentary Studio — Backend Build Plan

## Goal
Turn `/dashboard/documentary` from a UI prototype into a real AI-directed long-form documentary pipeline.

## Phase 1 — persistence
Create Supabase-backed entities for:
- documentary_projects
- documentary_chapters
- documentary_assets
- documentary_scenes
- documentary_generations
- documentary_render_jobs

Keep user media private. Store only metadata in the database and private media in Supabase Storage. Use signed URLs when media is needed by a worker/provider.

## Phase 2 — screenplay/storyboard
Add a server-side endpoint that receives a project brief and returns strict JSON:
- project title
- chapters
- scenes
- narration text in natural Hungarian
- visual direction
- asset references
- AI-B-roll requirement
- music mood
- ambience/SFX
- estimated duration
- privacy flags

The model must never invent major life events. Uploaded personal media takes priority. Future plans must be labeled as future.

## Phase 3 — scene control
Every scene needs:
- regenerate
- rewrite narration
- change visual direction
- use real footage
- generate B-roll
- shorten/extend
- change music
- approve/reject

## Phase 4 — media providers
Create provider interfaces rather than hard-coding a vendor:
- VideoGenerationProvider
- ImageGenerationProvider
- TTSProvider
- MusicProvider

Use environment variables for provider credentials. Never expose API keys to the browser.

## Phase 5 — rendering
Use a long-running worker with FFmpeg/Remotion or an equivalent renderer. Do NOT render a 30-minute movie inside a normal Next.js request. Persist job progress and allow retry/resume.

Pipeline:
assets → scene media → Hungarian narration → music/SFX → timeline → privacy processing → final MP4.

## Phase 6 — privacy
Before public/export output, support automatic redaction for:
- license plates
- faces when required
- addresses
- phone numbers
- email addresses
- IDs/documents
- access codes/security details

## Phase 7 — UX
The user should be able to:
1. Create documentary
2. Upload media
3. Generate screenplay
4. Review chapters
5. Review scenes
6. Give natural-language direction
7. Generate missing B-roll
8. Approve scenes
9. Render full film
10. Download final MP4 / prepare YouTube metadata

## Definition of done
A user can start a documentary project, upload private media, generate a Hungarian storyboard, edit individual scenes with natural-language instructions, and submit an asynchronous render job. No fake timers or simulated generation should be used for production actions.
