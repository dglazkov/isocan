## Audio

Generate music or spoken audio clips with your Gemini key and transcribe audio
items into searchable canvas context.

- `isocan audio music "<prompt>" [--quality clip|pro] [--json]` — generate a
  music clip with Lyria 3 and place it on the canvas (`audio.kind=music`,
  `audio.prompt`, `credentialRef`).
- `isocan audio speak "<text>" [--voice <name>] [--style <style>] [--json]` —
  synthesize speech with Gemini TTS and place it on the canvas
  (`audio.kind=speech`, `audio.voice`, `credentialRef`).
- `isocan audio transcribe <item> [--json]` — transcribe an audio item and save
  `audio.transcript`, `agentDescription`, and `credentialRef` via `item.update`.

MCP agents receive the same verbs as `audio_music`, `audio_speak`, and
`audio_transcribe`. Transcripts appear in canvas context whenever any audio
item carries `audio.transcript`.
