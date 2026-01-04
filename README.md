# MCP Server Gemini

A Model Context Protocol (MCP) server for integrating Google's Gemini 3 models with Claude Code, enabling powerful collaboration between both AI systems.

[![npm version](https://badge.fury.io/js/@rlabs-inc%2Fgemini-mcp.svg)](https://www.npmjs.com/package/@rlabs-inc/gemini-mcp)

## What's New in v0.4.0

**20+ tools** for comprehensive Gemini 3 integration:

**Multimodal Analysis:**
- **YouTube Analysis** - Analyze videos by URL with timestamps and clipping
- **Document Analysis** - PDFs, DOCX, spreadsheets with table extraction

**Generation & Editing:**
- **4K Image Generation** - Up to 4K resolution with Nano Banana Pro
- **10 Aspect Ratios** - 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
- **Multi-Turn Image Editing** - Iteratively refine images through conversation
- **Google Search Grounding** - Ground images in real-world information

**Advanced Tools:**
- **Code Execution** - Gemini writes AND runs Python code (pandas, matplotlib, numpy, etc.)
- **Google Search** - Real-time web information with citations
- **Structured Output** - JSON schema responses with validation
- **Data Extraction** - Extract entities, facts, sentiment from text

**Core Improvements:**
- **Thinking Levels** - Control reasoning depth: minimal, low, medium, high
- **Gemini 3 Models** - Updated to latest frontier models

### Previous Versions

**v0.3.0:** Phase 2-3 features (thinking levels, code execution, search)
**v0.2.0:** Image/Video generation with Veo

---

## Features

| Feature                       | Description                                                     |
|-------------------------------|-----------------------------------------------------------------|
| **YouTube Analysis**          | Analyze videos by URL with timestamp clipping                   |
| **Document Analysis**         | PDFs, DOCX, spreadsheets with table extraction                  |
| **4K Image Generation**       | Generate images up to 4K with 10 aspect ratios                  |
| **Multi-Turn Image Editing**  | Iteratively refine images through conversation                  |
| **Video Generation**          | Create videos with Veo (async with polling)                     |
| **Code Execution**            | Gemini writes and runs Python code (pandas, numpy, matplotlib)  |
| **Google Search**             | Real-time web information with inline citations                 |
| **Structured Output**         | JSON responses with schema validation                           |
| **Data Extraction**           | Extract entities, facts, sentiment from text                    |
| **Thinking Levels**           | Control reasoning depth (minimal/low/medium/high)               |
| **Direct Query**              | Send prompts to Gemini 3 Pro/Flash models                       |
| **Brainstorming**             | Collaborative problem-solving                                   |
| **Code Analysis**             | Analyze code for quality, security, performance                 |
| **Summarization**             | Summarize content at different detail levels                    |

---

## Quick Installation

### Using npm (Recommended)

```bash
claude mcp add gemini -s user -- env GEMINI_API_KEY=YOUR_KEY npx -y @rlabs-inc/gemini-mcp
```

### Using bun

```bash
claude mcp add gemini -s user -- env GEMINI_API_KEY=YOUR_KEY bunx @rlabs-inc/gemini-mcp
```

**Get your API key:** Visit [Google AI Studio](https://aistudio.google.com/apikey) - it's free and takes seconds!

### Installation Options

```bash
# With verbose logging
claude mcp add gemini -s user -- env GEMINI_API_KEY=YOUR_KEY VERBOSE=true bunx -y @rlabs-inc/gemini-mcp

# With custom output directory for generated images/videos
claude mcp add gemini -s user -- env GEMINI_API_KEY=YOUR_KEY GEMINI_OUTPUT_DIR=/path/to/output bunx -y @rlabs-inc/gemini-mcp
```

---

## Available Tools

### gemini-query

Direct queries to Gemini with thinking level control:

```
prompt: "Explain quantum entanglement"
model: "pro" or "flash"
thinkingLevel: "low" | "medium" | "high" (optional)
```

- **low**: Fast responses, minimal reasoning
- **medium**: Balanced (Flash only)
- **high**: Deep reasoning for complex tasks (default)

### gemini-generate-image

Generate images with Nano Banana Pro (Claude can SEE them!):

```
prompt: "a futuristic city at sunset"
style: "cyberpunk" (optional)
aspectRatio: "16:9" (1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9)
imageSize: "2K" (1K, 2K, 4K)
useGoogleSearch: false (ground in real-world info)
```

### gemini-start-image-edit

Start a multi-turn image editing session:

```
prompt: "a cozy cabin in the mountains"
aspectRatio: "16:9"
imageSize: "2K"
useGoogleSearch: false
```

Returns a session ID for iterative editing.

### gemini-continue-image-edit

Continue refining an image:

```
sessionId: "edit-123456789"
prompt: "add snow on the roof and make it nighttime"
```

### gemini-end-image-edit

Close an editing session:

```
sessionId: "edit-123456789"
```

### gemini-list-image-sessions

List all active editing sessions.

### gemini-generate-video

Generate videos using Veo:

```
prompt: "a cat playing piano"
aspectRatio: "16:9" (optional)
negativePrompt: "blurry, text" (optional)
```

Video generation is async (takes 1-5 minutes). Use `gemini-check-video` to poll.

### gemini-check-video

Check video generation status and download when complete:

```
operationId: "operations/xxx-xxx-xxx"
```

### gemini-analyze-code

Analyze code for issues:

```
code: "function foo() { ... }"
language: "typescript" (optional)
focus: "quality" | "security" | "performance" | "bugs" | "general"
```

### gemini-analyze-text

Analyze text content:

```
text: "Your text here..."
type: "sentiment" | "summary" | "entities" | "key-points" | "general"
```

### gemini-brainstorm

Collaborative brainstorming:

```
prompt: "How could we implement real-time collaboration?"
claudeThoughts: "I think we should use WebSockets..."
maxRounds: 3 (optional)
```

### gemini-summarize

Summarize content:

```
content: "Long text to summarize..."
length: "brief" | "moderate" | "detailed"
format: "paragraph" | "bullet-points" | "outline"
```

### gemini-run-code

Let Gemini write and execute Python code:

```
prompt: "Calculate the first 50 prime numbers and plot them"
data: "optional CSV data to analyze" (optional)
```

Supports libraries: numpy, pandas, matplotlib, scipy, scikit-learn, tensorflow, and more.
Generated charts are saved to the output directory and returned as images.

### gemini-search

Real-time web search with citations:

```
query: "What happened in tech news this week?"
returnCitations: true (default)
```

Returns grounded responses with inline citations and source URLs.

### gemini-structured

Get JSON responses matching a schema:

```
prompt: "Extract the meeting details from this email..."
schema: '{"type":"object","properties":{"date":{"type":"string"},"attendees":{"type":"array"}}}'
useGoogleSearch: false (optional)
```

### gemini-extract

Convenience tool for common extraction patterns:

```
text: "Your text to analyze..."
extractType: "entities" | "facts" | "summary" | "keywords" | "sentiment" | "custom"
customFields: "name, date, amount" (for custom extraction)
```

### gemini-youtube

Analyze YouTube videos directly:

```
url: "https://www.youtube.com/watch?v=..."
question: "What happens at 2:30?"
startTime: "1m30s" (optional, for clipping)
endTime: "5m00s" (optional, for clipping)
```

### gemini-youtube-summary

Quick video summarization:

```
url: "https://www.youtube.com/watch?v=..."
style: "brief" | "detailed" | "bullet-points" | "chapters"
```

### gemini-analyze-document

Analyze PDFs and documents:

```
filePath: "/path/to/document.pdf"
question: "Summarize the key findings"
mediaResolution: "low" | "medium" | "high"
```

### gemini-summarize-pdf

Quick PDF summarization:

```
filePath: "/path/to/document.pdf"
style: "brief" | "detailed" | "outline" | "key-points"
```

### gemini-extract-tables

Extract tables from documents:

```
filePath: "/path/to/document.pdf"
outputFormat: "markdown" | "csv" | "json"
```

---

## Workflow: Claude + Gemini

The killer combination for development:

| Claude | Gemini |
|--------|--------|
| Complex logic | Frontend/UI |
| Architecture | Visual components |
| Backend code | Image generation |
| Integration | React/CSS styling |
| Reasoning | Creative generation |

**Example workflow:**
1. Ask Claude to design the backend API
2. Use `gemini-generate-image` for UI mockups
3. Ask Gemini to generate React components via `gemini-query`
4. Use multi-turn editing to refine visuals
5. Let Claude wire everything together

---

## Environment Variables

| Variable                | Required | Default                      | Description                   |
|-------------------------|----------|------------------------------|-------------------------------|
| `GEMINI_API_KEY`        | Yes      | -                            | Your Google Gemini API key    |
| `GEMINI_OUTPUT_DIR`     | No       | `./gemini-output`            | Where to save generated files |
| `GEMINI_MODEL`          | No       | -                            | Override model for init test  |
| `GEMINI_PRO_MODEL`      | No       | `gemini-3-pro-preview`       | Pro model (Gemini 3)          |
| `GEMINI_FLASH_MODEL`    | No       | `gemini-3-flash-preview`     | Flash model (Gemini 3)        |
| `GEMINI_IMAGE_MODEL`    | No       | `gemini-3-pro-image-preview` | Image model (Nano Banana Pro) |
| `GEMINI_VIDEO_MODEL`    | No       | `veo-2.0-generate-001`       | Video model                   |
| `VERBOSE`               | No       | `false`                      | Enable verbose logging        |
| `QUIET`                 | No       | `false`                      | Minimize logging              |

---

## Manual Installation

### Global Install

```bash
# Using npm
npm install -g @rlabs-inc/gemini-mcp

# Using bun
bun install -g @rlabs-inc/gemini-mcp
```

### Claude Code Configuration

```json
{
  "gemini": {
    "command": "npx",
    "args": ["-y", "@rlabs-inc/gemini-mcp"],
    "env": {
      "GEMINI_API_KEY": "your-api-key",
      "GEMINI_OUTPUT_DIR": "/path/to/save/files"
    }
  }
}
```

---

## Troubleshooting

### Rate Limits (429 Errors)

If you're hitting rate limits on the free tier:
- Set `GEMINI_MODEL=gemini-3-flash-preview` to use Flash for init (higher limits)
- Or upgrade to a paid plan

### Connection Issues

1. Verify your API key at [Google AI Studio](https://aistudio.google.com/apikey)
2. Check server status: `claude mcp list`
3. Try with verbose logging: `VERBOSE=true`

### Image/Video Issues

- Ensure your API key has access to image/video generation
- Check output directory permissions
- Files save to `GEMINI_OUTPUT_DIR` (default: `./gemini-output`)
- For 4K images, generation takes longer

---

## Development

```bash
git clone https://github.com/rlabs-inc/gemini-mcp.git
cd gemini-mcp
bun install
bun run build
bun run dev -- --verbose
```

### Scripts

| Command             | Description                 |
|---------------------|-----------------------------|
| `bun run build`     | Build for production        |
| `bun run dev`       | Development mode with watch |
| `bun run typecheck` | Type check without emitting |
| `bun run format`    | Format with Prettier        |
| `bun run lint`      | Lint with ESLint            |

---

## License

MIT License

---

Made with Claude + Gemini working together
