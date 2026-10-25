# Vapi Voice Agent with Agentic RAG (Node + Express)

Call a phone number -> Vapi answers (STT + TTS) -> LLM decides which tool to use:

- `search_knowledge_base` -> Qdrant vector DB (your private docs)
- `search_web` -> Serper (real-time Google results)

```
Caller --phone--> Vapi (Deepgram STT -> LLM -> Vapi TTS)
                      |  tool-calls (HTTPS POST, x-vapi-secret)
                      v
               Express /vapi/webhook
                 |-- search_knowledge_base -> LangChain: Gemini embeddings -> Qdrant
                 '-- search_web            -> LangChain Serper tool (Google)
```

"Agentic" = the LLM chooses the tool, can retry with a rephrased query, and falls back to web search when the knowledge base returns `NO_RELEVANT_RESULTS`.

## 1. Accounts / keys (all have free tiers; check current limits)

| Service | Where | Needed for |
|---|---|---|
| Vapi | dashboard.vapi.ai -> API Keys -> Private Key | voice, phone number |
| Serper | serper.dev | Google search |
| Google AI Studio | aistudio.google.com/apikey | embeddings |
| Qdrant Cloud | cloud.qdrant.io (free 1 GB cluster) | vector DB |
| Groq (LLM) | console.groq.com | free LLM (or use OpenAI via Vapi credits) |
| ngrok | ngrok.com | public URL while developing |

## 2. Install

```bash
npm install     
cp .env    
```

## 3. Load your knowledge into the vector DB

Put `.txt` / `.md` files in `docs/` (two samples are included — delete them first), then:

```bash
npm run ingest
```

LangChain `DirectoryLoader` -> `RecursiveCharacterTextSplitter` -> `GoogleGenerativeAIEmbeddings` -> `QdrantVectorStore` (collection is created automatically).

## 4. Run server + public tunnel

```bash
npm start                # terminal 1
ngrok http 3000          # terminal 2 -> copy the https URL into PUBLIC_URL in .env
```

## 5. Create the assistant

```bash
npm run create-assistant
```

This registers STT (Deepgram), LLM, TTS (Vapi voice "Elliot"), and both tools pointing at `PUBLIC_URL/vapi/webhook`.
If you use Groq: Vapi Dashboard -> Provider Credentials -> add your Groq key first.
Whenever PUBLIC_URL changes (new ngrok URL), re-run it (or edit the tools' server URL in the dashboard).

## 6. Get a phone number

Vapi Dashboard -> Phone Numbers -> Create -> **Free Vapi Number** (US area code) -> under Inbound pick your assistant -> Save.
Call it.

Notes:
- Free Vapi numbers are US-only; calling from India is an international call for the caller.
- Free alternatives for testing: the **Talk to Assistant** button in the dashboard (web call), or a free **SIP number** in Phone Numbers (`sip:yourname@sip.vapi.ai`) dialed with a softphone like Linphone.
- For an Indian number you need to import one from a provider such as Twilio/Telnyx/Vonage (paid).

## 7. Deploy (free) instead of ngrok

Push to GitHub -> Render.com "Web Service" (free) -> build `npm install`, start `npm start`, add env vars -> set `PUBLIC_URL` to the Render URL -> re-run `npm run create-assistant`. Free Render instances sleep when idle, so the first call may be slow; use a paid instance or a keep-alive ping for production.

## Hindi / multilingual

Set `AGENT_LANGUAGE` in `.env` and re-run `npm run create-assistant`:

| Value | STT (Deepgram) | Voice | Behavior |
|---|---|---|---|
| `en` | nova-2, `en` | Vapi "Elliot" | English only |
| `hi` | nova-2, `hi` | Azure `hi-IN-SwaraNeural` | Hindi (Devanagari) only |
| `multi` | nova-3, `multi` | Vapi "Elliot" v2, `language: "auto"` (free) | Replies in the caller's language, incl. Hinglish |

- The embeddings model is multilingual, so Hindi questions match English docs and vice versa; Hindi docs also work (`docs/company-faq-hi.md`).
- `search_web` takes a `language` argument (`hi`/`en`) that sets Serper's `hl`.
- The prompt makes the LLM write Hindi in Devanagari, because TTS pronounces it much better than romanized Hindi.
- Other voices (ElevenLabs, Cartesia, Google): set `VOICE_PROVIDER` and `VOICE_ID` in `.env`.
- Llama on Groq is acceptable in Hindi; for better quality set `LLM_PROVIDER=openai`, `LLM_MODEL=gpt-4o-mini` (or a Gemini model).

## Troubleshooting

- Server logs `[tool] ...` lines when the agent calls a tool. No lines = Vapi cannot reach your URL or the secret doesn't match.
- 401 -> `VAPI_WEBHOOK_SECRET` mismatch; re-run create-assistant.
- Always answers "no results" -> run `npm run ingest`; lower `MIN_SCORE` in `src/tools.js`.
- Dimension error -> you changed embedding model after ingesting; delete the Qdrant collection (or use a new `QDRANT_COLLECTION`) and re-run ingest.
- npm peer-dependency conflict -> `npm install --legacy-peer-deps`.
- Agent too slow -> use a faster model, keep tool output short (already trimmed to 3500 chars).

## Customizing

- Persona / behavior: `systemPrompt` in `scripts/createAssistant.js`.
- Add a tool: create another `tool({...})` with a zod schema in `src/tools.js` and add it to the `tools` array; its Vapi definition is generated automatically.
- Swap embeddings (OpenAI, Cohere, Ollama...): edit only `src/embeddings.js`, then re-ingest.
- Voice, language, STT: `PRESETS` in `scripts/createAssistant.js` (or the env overrides).
