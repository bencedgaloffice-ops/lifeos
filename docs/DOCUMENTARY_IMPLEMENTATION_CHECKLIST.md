# Documentary Studio — One-Pass Implementation Checklist

This checklist is the acceptance target for the production implementation.

## User flow
1. Open Documentary Studio.
2. Create a documentary project.
3. Upload real photos/videos into private storage.
4. Enter/confirm the Hungarian director brief.
5. Generate a structured screenplay/storyboard through a server-side AI endpoint.
6. Review chapters and scenes.
7. Edit any scene with natural-language direction.
8. Generate missing AI B-roll through a provider adapter.
9. Generate Hungarian narration through a TTS provider adapter.
10. Add music and environmental SFX through provider adapters or uploaded assets.
11. Approve scenes.
12. Submit an asynchronous render job.
13. Show real job status, errors and retry/resume state.
14. Produce a YouTube-ready 16:9 MP4 when providers and render infrastructure are configured.

## Required backend contracts
- Project: id, user_id, title, language, target_duration, aspect_ratio, status, brief.
- Chapter: project_id, order, title, synopsis, status.
- Asset: project_id, storage_path, type, duration, privacy_status, metadata.
- Scene: chapter_id, order, duration, narration, visual_prompt, asset_ids, generation_mode, status.
- Generation: scene_id, provider, kind, input, output, status, error.
- RenderJob: project_id, status, progress, output_path, error, timestamps.

## AI constraints
- Natural Hungarian narration.
- Never invent major personal facts.
- Real uploaded material has priority.
- Future plans are explicitly future.
- Provider secrets remain server-side.
- Validate model output with a schema before persistence.

## Privacy
- Private storage by default.
- Signed URLs only for authorized access.
- Hooks for license plate, face and sensitive-document redaction.
- Do not expose workplace security details or private addresses.

## Rendering
- Long renders must run in a worker/queue, not a request handler.
- Renderer should support scene media, voiceover, music, SFX, subtitles and transitions.
- Persist checkpoints so failed renders can resume.
- Never simulate completion.

## Definition of done
The flow is considered complete only when a configured environment can take uploaded user media and a director brief through storyboard, scene generation, narration, assembly and an actual MP4 render. If a provider is not configured, show a precise configuration error instead of pretending the step succeeded.
