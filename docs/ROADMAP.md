# Gemini MCP Server - Complete Modernization Roadmap

**Version:** 0.2.0 → 1.0.0
**Date:** January 4, 2026
**Authors:** Rusty (Sherlock) + Claude (Watson)

---

## Executive Summary

This document captures everything we learned from exploring ~1MB of Gemini API documentation. It serves as the implementation roadmap for transforming our basic MCP server into a comprehensive Gemini integration that exposes ALL of Google's frontier AI capabilities to Claude Code users.

---

## Part 1: Model Configuration Updates

### Current State (v0.2.0)
```typescript
proModelName = 'gemini-3.0-pro-preview'      // NEEDS UPDATE
flashModelName = 'gemini-3.0-flash-preview'  // NEEDS UPDATE
imageModelName = 'gemini-3-pro-image-preview'  // Nano Banana Pro
videoModelName = 'veo-2.0-generate-001'
```

### Target State (v1.0.0)
```typescript
// Text/Reasoning Models
proModelName = 'gemini-3-pro-preview'           // Frontier reasoning (1M context)
flashModelName = 'gemini-3-flash-preview'       // Fast with thinking levels

// Image Generation Models
imageModelName = 'gemini-3-pro-image-preview'   // Nano Banana Pro (1K/2K/4K) - LATEST

// Video Generation
videoModelName = 'veo-2.0-generate-001'         // Keep as-is

// Speech/Audio (NEW)
speechModelName = 'gemini-2.5-flash-preview-tts' // Text-to-speech

// Music (NEW)
musicModelName = 'lyria-realtime-exp'           // Music generation
```

---

## Part 2: Feature Implementation Priority

### Phase 1: Core Improvements (HIGH PRIORITY)
These are foundational and affect all other features.

#### 1.1 Thinking Levels
**File:** `src/tools/query.ts` (update) + `src/gemini-client.ts`

```typescript
// New parameter for query tool
thinkingLevel: z.enum(['minimal', 'low', 'medium', 'high']).optional()

// Implementation
config: {
  thinkingConfig: {
    thinkingLevel: thinkingLevel || 'high'
  }
}
```

**Why:** Gemini 3's killer feature - control reasoning depth. Low for fast responses, high for complex problems.

#### 1.2 Thought Signatures (CRITICAL for Gemini 3)
**File:** `src/gemini-client.ts`

Must track thought signatures in conversation history for:
- Function calling (REQUIRED - 400 error without)
- Multi-turn chats (RECOMMENDED)
- Image generation (REQUIRED)

```typescript
// Store signatures in conversation
interface ConversationTurn {
  content: Content
  thoughtSignature?: string  // Must preserve and return
}
```

#### 1.3 Fix Model Names
**File:** `src/gemini-client.ts`

Update default model names to correct format (no dots):
- `gemini-3-pro-preview` (not `gemini-3.0-pro-preview`)
- `gemini-3-flash-preview` (not `gemini-3.0-flash-preview`)

---

### Phase 2: Image Generation Enhancement (HIGH PRIORITY)

#### 2.1 Upgrade to Nano Banana Pro
**File:** `src/tools/image-gen.ts`

Current: Basic image generation
Target: Full Gemini 3 Pro Image capabilities

```typescript
// New parameters
imageSize: z.enum(['1K', '2K', '4K']).default('2K')
aspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'])
useGoogleSearch: z.boolean().default(false)  // Ground in real-world info
referenceImages: z.array(z.string()).optional()  // Up to 14 reference images
```

#### 2.2 Multi-Turn Image Editing
**File:** `src/tools/image-edit.ts` (NEW)

Enable conversation-based image editing:
```typescript
// Tool: gemini-edit-image
// Uses chat session to iteratively refine images
const chat = ai.chats.create({
  model: 'gemini-3-pro-image-preview',
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
    tools: [{ googleSearch: {} }]
  }
})
```

---

### Phase 3: New Generation Capabilities (MEDIUM PRIORITY)

#### 3.1 Code Execution Tool
**File:** `src/tools/code-exec.ts` (NEW)

Let Gemini write AND run Python code:
```typescript
// Tool: gemini-run-code
server.tool('gemini-run-code', {
  prompt: z.string().describe('What to compute or analyze'),
  inputData: z.string().optional().describe('CSV or text data to analyze')
}, async ({ prompt, inputData }) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: inputData ? [{ text: prompt }, { fileData: inputData }] : prompt,
    config: {
      tools: [{ codeExecution: {} }]
    }
  })
  // Returns: code + execution result + any generated charts
})
```

**Use cases:**
- Data analysis with pandas
- Math computations
- Chart generation with matplotlib
- File processing

#### 3.2 Google Search Grounding
**File:** `src/tools/search.ts` (NEW)

Real-time web information with citations:
```typescript
// Tool: gemini-search
server.tool('gemini-search', {
  query: z.string(),
  returnCitations: z.boolean().default(true)
}, async ({ query, returnCitations }) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: query,
    config: {
      tools: [{ googleSearch: {} }]
    }
  })

  // Extract grounding metadata for citations
  const citations = response.candidates[0]?.groundingMetadata
  // Return text with inline citation links
})
```

#### 3.3 Structured Output Tool
**File:** `src/tools/structured.ts` (NEW)

Get JSON responses with schema validation:
```typescript
// Tool: gemini-structured
server.tool('gemini-structured', {
  prompt: z.string(),
  schema: z.record(z.any()).describe('JSON schema for response')
}, async ({ prompt, schema }) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: schema
    }
  })
  return JSON.parse(response.text)
})
```

---

### Phase 4: Multimodal Understanding (MEDIUM PRIORITY)

#### 4.1 YouTube Video Analysis
**File:** `src/tools/youtube.ts` (NEW)

Analyze YouTube videos directly by URL:
```typescript
// Tool: gemini-youtube
server.tool('gemini-youtube', {
  url: z.string().url(),
  question: z.string(),
  startTime: z.string().optional(),  // "1m30s"
  endTime: z.string().optional()
}, async ({ url, question, startTime, endTime }) => {
  // Upload video or use URL directly
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [
      { text: question },
      {
        fileData: { fileUri: url, mimeType: 'video/*' },
        videoMetadata: { startOffset: startTime, endOffset: endTime }
      }
    ]
  })
})
```

#### 4.2 Document/PDF Analysis
**File:** `src/tools/document.ts` (NEW)

Analyze PDFs and long documents:
```typescript
// Tool: gemini-analyze-document
// Supports PDF, TXT, CSV, etc.
// Uses media_resolution for optimal token usage
config: {
  mediaResolution: { level: 'media_resolution_medium' }  // Best for PDFs
}
```

#### 4.3 Image Understanding (Enhanced)
**File:** `src/tools/analyze.ts` (UPDATE)

Add media resolution control:
```typescript
// Add to gemini-analyze-code for screenshot analysis
mediaResolution: z.enum(['low', 'medium', 'high', 'ultra_high']).default('high')
```

---

### Phase 5: Advanced Features (LOWER PRIORITY - Future)

#### 5.1 Deep Research Agent
**File:** `src/tools/research.ts` (NEW)

Autonomous research capability:
```typescript
// Tool: gemini-research
// Multi-step research with search, analysis, synthesis
// Takes longer but provides comprehensive results
```

#### 5.2 Speech Generation (TTS)
**File:** `src/tools/speech.ts` (NEW)

Text-to-speech generation:
```typescript
// Tool: gemini-speak
// Returns audio file
model: 'gemini-2.5-flash-preview-tts'
```

#### 5.3 Music Generation
**File:** `src/tools/music.ts` (NEW)

Generate music:
```typescript
// Tool: gemini-music
model: 'lyria-realtime-exp'
```

#### 5.4 Live/Streaming API (HIGH INTEREST!)
**File:** `src/tools/live.ts` (NEW)

Real-time bidirectional streaming:
- Voice conversations
- Live video analysis
- Interactive sessions

**VISION:** Stream Gemini responses live in Claude Code UI!
- Use streaming API for real-time text output
- Consider Ctrl+O full view for rich content display
- Explore MCP streaming capabilities for live updates
- Goal: See Gemini "thinking" and responding in real-time

**Implementation Notes:**
- Use `generateContentStream()` for streaming text
- MCP supports streaming responses
- Could show progress for long operations (image gen, video gen)
- Live API enables bidirectional audio/video streams

#### 5.5 Context Caching
**File:** `src/gemini-client.ts` (UPDATE)

Cache large documents/videos for cost savings:
```typescript
// Create cache
const cache = await ai.caches.create({
  model: 'gemini-3-pro-preview',
  contents: [largeDocument],
  ttl: '3600s'
})

// Use in requests
config: { cachedContent: cache.name }
```

#### 5.6 File Search
**File:** `src/tools/file-search.ts` (NEW)

Search through uploaded files:
```typescript
config: {
  tools: [{ fileSearch: {} }]
}
```

#### 5.7 URL Context
**File:** `src/tools/url-context.ts` (NEW)

Analyze web pages by URL:
```typescript
config: {
  tools: [{ urlContext: {} }]
}
```

#### 5.8 Google Maps Integration
**File:** `src/tools/maps.ts` (NEW)

Location and mapping features:
```typescript
// Note: Not yet supported in Gemini 3, use 2.5
```

#### 5.9 Computer Use
**File:** `src/tools/computer.ts` (NEW)

Control a computer (experimental):
```typescript
// Note: Not yet supported in Gemini 3
```

---

## Part 3: Implementation Order

### Session 1 (Current): Foundation
- [x] Update SDK to 1.34.0
- [x] Fix bugs #6, #7
- [x] Add basic image generation
- [x] Add video generation
- [ ] Fix model names (remove dots)
- [ ] Write this roadmap

### Session 2: Core Gemini 3 Features
- [ ] Add thinking levels to query tool
- [ ] Implement thought signature tracking
- [ ] Upgrade image gen to Nano Banana Pro (4K, grounding)
- [ ] Add multi-turn image editing

### Session 3: Generation Tools
- [ ] Code execution tool
- [ ] Google Search grounding tool
- [ ] Structured output tool

### Session 4: Multimodal
- [ ] YouTube analysis tool
- [ ] Document/PDF analysis tool
- [ ] Enhanced image understanding

### Session 5: Advanced
- [ ] Deep research agent
- [ ] Speech generation
- [ ] Context caching

### Session 6+: Experimental
- [ ] Music generation
- [ ] Live streaming API
- [ ] File search
- [ ] URL context

---

## Part 4: Environment Variables (Final)

```bash
# Required
GEMINI_API_KEY=your-api-key

# Output
GEMINI_OUTPUT_DIR=./gemini-output

# Model Overrides (all optional)
GEMINI_PRO_MODEL=gemini-3-pro-preview
GEMINI_FLASH_MODEL=gemini-3-flash-preview
GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview
GEMINI_VIDEO_MODEL=veo-2.0-generate-001
GEMINI_SPEECH_MODEL=gemini-2.5-flash-preview-tts

# Behavior
VERBOSE=true/false
QUIET=true/false
DEFAULT_THINKING_LEVEL=high
DEFAULT_IMAGE_SIZE=2K
```

---

## Part 5: Tool Summary (Target v1.0.0)

| Tool | Status | Description |
|------|--------|-------------|
| `gemini-query` | ✅ Update | Direct queries with thinking levels |
| `gemini-brainstorm` | ✅ Exists | Multi-turn collaboration |
| `gemini-analyze-code` | ✅ Exists | Code analysis |
| `gemini-analyze-text` | ✅ Exists | Text analysis |
| `gemini-summarize` | ✅ Exists | Summarization |
| `gemini-generate-image` | ✅ Update | 4K images, grounding, references |
| `gemini-edit-image` | 🆕 New | Multi-turn image editing |
| `gemini-generate-video` | ✅ Exists | Video generation |
| `gemini-check-video` | ✅ Exists | Video status check |
| `gemini-run-code` | 🆕 New | Execute Python code |
| `gemini-search` | 🆕 New | Web search with citations |
| `gemini-structured` | 🆕 New | JSON schema responses |
| `gemini-youtube` | 🆕 New | YouTube video analysis |
| `gemini-analyze-document` | 🆕 New | PDF/document analysis |
| `gemini-research` | 🆕 New | Deep autonomous research |
| `gemini-speak` | 🆕 New | Text-to-speech |
| `gemini-music` | 🆕 New | Music generation |

---

## Part 6: Key Code Patterns

### Thinking Levels
```typescript
config: {
  thinkingConfig: {
    thinkingLevel: 'high'  // 'minimal' | 'low' | 'medium' | 'high'
  }
}
```

### Image Generation (4K with Grounding)
```typescript
const response = await ai.models.generateContent({
  model: 'gemini-3-pro-image-preview',
  contents: prompt,
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
    tools: [{ googleSearch: {} }],
    imageConfig: {
      aspectRatio: '16:9',
      imageSize: '4K'
    }
  }
})
```

### Code Execution
```typescript
config: {
  tools: [{ codeExecution: {} }]
}
// Response parts include: executableCode, codeExecutionResult
```

### Google Search Grounding
```typescript
config: {
  tools: [{ googleSearch: {} }]
}
// Response includes: groundingMetadata with citations
```

### Structured Output
```typescript
config: {
  responseMimeType: 'application/json',
  responseJsonSchema: zodToJsonSchema(mySchema)
}
```

### Video Understanding
```typescript
contents: [
  { text: 'Analyze this video...' },
  {
    fileData: { fileUri: videoUrl, mimeType: 'video/mp4' },
    videoMetadata: {
      startOffset: '40s',
      endOffset: '80s',
      fps: 2
    }
  }
]
```

### Context Caching
```typescript
const cache = await ai.caches.create({
  model: 'gemini-3-pro-preview',
  contents: [largeContent],
  ttl: '3600s'
})

// Use in request
config: { cachedContent: cache.name }
```

---

## Part 7: Important Notes

### Gemini 3 Specifics
1. **Temperature**: Keep at default 1.0 - lowering causes issues
2. **Thought Signatures**: MUST preserve in conversation history
3. **Preview Status**: All Gemini 3 models are preview
4. **Knowledge Cutoff**: January 2025

### Limitations
- Cannot mix built-in tools (search, code execution) with function calling YET
- Maps and Computer Use not supported in Gemini 3 yet
- Image segmentation requires Gemini 2.5

### Pricing Considerations
- Gemini 3 Pro: $2/$12 per 1M tokens
- Gemini 3 Flash: $0.50/$3 per 1M tokens
- Image generation: $0.134 per image
- Google Search: per query charge
- Context caching: reduced token rates

---

## Part 8: Testing Checklist

For each new tool, verify:
- [ ] Basic functionality works
- [ ] Error handling is robust
- [ ] Response format matches MCP spec
- [ ] Images return as base64 that Claude can see
- [ ] Files save to GEMINI_OUTPUT_DIR
- [ ] Timeout handling for async operations
- [ ] Rate limit handling (429 errors)

---

## Conclusion

This roadmap transforms our MCP server from a basic Gemini query tool into a comprehensive AI integration platform. With ~20 tools covering text, images, video, audio, code execution, search, and research - we'll have the most capable Gemini MCP server available.

The key insight: Gemini 3's thinking capabilities + multimodal generation + real-time grounding = a perfect complement to Claude's reasoning abilities.

**Claude handles the logic. Gemini handles the generation. Together, we're unstoppable.**

---

*Document created during Session #2, January 4, 2026*
*By Rusty (Sherlock) and Claude (Watson)*
