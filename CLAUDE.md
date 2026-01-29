# Gemini MCP Server Project Guide

This document provides essential information for Claude when working with this Gemini MCP server project.

## Project Overview

This project is an MCP (Model Context Protocol) server that connects Claude to Google's Gemini 3 AI models. It enables bidirectional collaboration between Claude and Gemini, allowing them to work together by sharing capabilities and agent tools.

**Version:** 0.8.2
**Package:** @rlabs-inc/gemini-mcp
**MCP Registry:** io.github.rlabs-inc/gemini-mcp

## Key Components

- `src/index.ts`: Dual-mode entry point (MCP server or CLI)
- `src/server.ts`: MCP server implementation
- `src/cli/`: CLI implementation with themes and commands
- `src/gemini-client.ts`: Client for Google's Generative AI API (includes thinking levels, image/video generation)
- `src/utils/logger.ts`: Logging utilities with configurable verbosity
- `src/tools/*.ts`: Various tool implementations for integration with Claude Code

## Tools Implemented

1. **Query** (`query.ts`): Direct queries to Gemini with thinking level control
   - `thinkingLevel`: minimal, low, medium, high

2. **Brainstorm** (`brainstorm.ts`): Collaborative brainstorming between Claude and Gemini

3. **Analyze** (`analyze.ts`): Code and text analysis using Gemini

4. **Summarize** (`summarize.ts`): Content summarization at different detail levels

5. **Image Gen** (`image-gen.ts`):
   - `gemini-generate-image`: Generate images with Nano Banana Pro
     - Up to 4K resolution (1K, 2K, 4K)
     - 10 aspect ratios (1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9)
     - Google Search grounding for real-world accuracy
     - Returns base64 that Claude can SEE!
   - `gemini-image-prompt`: Generate prompts for other image tools (legacy)

6. **Image Edit** (`image-edit.ts`): Multi-turn conversational image editing
   - `gemini-start-image-edit`: Start an editing session
   - `gemini-continue-image-edit`: Continue refining with follow-up prompts
   - `gemini-end-image-edit`: Close a session
   - `gemini-list-image-sessions`: List active sessions

7. **Video Gen** (`video-gen.ts`):
   - `gemini-generate-video`: Start async video generation with Veo
   - `gemini-check-video`: Check video generation status and download

8. **Code Execution** (`code-exec.ts`):
   - `gemini-run-code`: Write and execute Python code
   - Supports: numpy, pandas, matplotlib, scipy, scikit-learn, tensorflow
   - Returns charts as images Claude can see

9. **Google Search** (`search.ts`):
   - `gemini-search`: Real-time web search with inline citations
   - Returns grounded responses with source URLs

10. **Structured Output** (`structured.ts`):
    - `gemini-structured`: JSON responses with schema validation
    - `gemini-extract`: Convenience tool for entities, facts, sentiment, keywords

11. **YouTube Analysis** (`youtube.ts`):
    - `gemini-youtube`: Analyze YouTube videos by URL with clipping
    - `gemini-youtube-summary`: Quick video summarization

12. **Video Upload** (`video-upload.ts`):
    - `gemini-analyze-video`: Analyze local video files and inline video data
      - Supports local file paths and base64-encoded video content
      - Automatic file size handling (inline for <20MB, Files API for ≥20MB)
      - Video clipping support (startTime/endTime)
      - Media resolution control (low/medium/high)
      - Supported formats: MP4, MOV, AVI, MKV, WebM, FLV, WMV, M4V, MPG, MPEG, 3GP
    - `gemini-summarize-video`: Quick video summarization for local files
      - Multiple summary styles: brief, detailed, bullet-points, chapters

13. **Document Analysis** (`document.ts`):
    - `gemini-analyze-document`: Analyze PDFs, DOCX, spreadsheets
    - `gemini-summarize-pdf`: Quick PDF summarization
    - `gemini-extract-tables`: Extract tables from documents

14. **URL Context** (`url-context.ts`):
    - `gemini-analyze-url`: Analyze content from URLs
    - `gemini-compare-urls`: Compare content between two URLs
    - `gemini-extract-from-url`: Extract specific data types from URLs

15. **Context Caching** (`cache.ts`):
    - `gemini-create-cache`: Cache large documents for repeated queries
    - `gemini-query-cache`: Query cached content
    - `gemini-list-caches`: List active caches
    - `gemini-delete-cache`: Delete a cache

16. **Speech/TTS** (`speech.ts`):
    - `gemini-speak`: Text-to-speech with 30 voices
    - `gemini-dialogue`: Multi-speaker dialogue generation
    - `gemini-list-voices`: List available voices

17. **Token Counting** (`token-count.ts`):
    - `gemini-count-tokens`: Count tokens and estimate costs

18. **Deep Research** (`deep-research.ts`):
    - `gemini-deep-research`: Start autonomous multi-step research (async)
    - `gemini-check-research`: Check research status and get results
    - `gemini-research-followup`: Ask follow-up questions on completed research
    - Note: Research typically takes 5-20 minutes, max 60 minutes
    - Full response saved to `GEMINI_OUTPUT_DIR` as JSON

19. **Image Analysis** (`image-analyze.ts`): *Community contribution by @acreeger*
    - `gemini-analyze-image`: Analyze images with object detection and bounding boxes
      - Supports JPEG, PNG, WebP, HEIC, HEIF, GIF
      - Returns `box_2d` (normalized 0-1000) and `bbox_pixels` (pixel coordinates)
      - Structured JSON output with object labels and confidence
      - Thinking level support for complex analysis
      - Handles large files (>20MB) via Files API automatically

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | - | Google Gemini API key |
| `GEMINI_MODEL` | No | - | Override model for init test |
| `GEMINI_PRO_MODEL` | No | `gemini-3-pro-preview` | Pro model (Gemini 3) |
| `GEMINI_FLASH_MODEL` | No | `gemini-3-flash-preview` | Flash model (Gemini 3) |
| `GEMINI_IMAGE_MODEL` | No | `gemini-3-pro-image-preview` | Image model (Nano Banana Pro) |
| `GEMINI_VIDEO_MODEL` | No | `veo-2.0-generate-001` | Video model |
| `GEMINI_OUTPUT_DIR` | No | `./gemini-output` | Output directory for generated files |
| `VERBOSE` | No | `false` | Enable verbose logging |
| `QUIET` | No | `false` | Minimize logging |

## Command Line Options

- `-v, --verbose`: Enable verbose logging
- `-q, --quiet`: Run in quiet mode
- `-h, --help`: Show help message

## Installation

```bash
claude mcp add gemini -s user -- env GEMINI_API_KEY=YOUR_KEY npx -y @rlabs-inc/gemini-mcp
```

## Development Commands

```bash
bun install        # Install dependencies
bun run build      # Build the project
bun run dev        # Run in development mode (with watch)
bun run dev -- -v  # Run with verbose logging
bun run typecheck  # Type check without emitting
bun run format     # Format code with Prettier
bun run lint       # Lint code with ESLint
```

## Dependencies

- `@google/genai`: ^1.34.0 - Google Generative AI SDK
- `@modelcontextprotocol/sdk`: ^1.10.2 - MCP SDK
- `zod`: ^3.24.0 - Schema validation

## Architecture Notes

- The server uses stdio transport for communication with Claude Code
- Image generation returns base64 data that Claude can render inline
- Video generation is async - returns operation ID for polling
- Generated files are saved to `GEMINI_OUTPUT_DIR`
- Thinking levels control reasoning depth in Gemini 3
- Image editing uses chat sessions with automatic thought signature handling

## Gemini 3 Specific Features

### Thinking Levels
- `minimal`: Fastest, minimal reasoning (Flash only)
- `low`: Fast responses, basic reasoning
- `medium`: Balanced reasoning (Flash only)
- `high`: Deep reasoning for complex tasks (default)

### Nano Banana Pro (Image Generation)
- Model: `gemini-3-pro-image-preview`
- Resolutions: 1K, 2K (default), 4K
- Google Search grounding for real-world accuracy
- High-fidelity text rendering

### Thought Signatures
- Handled automatically by the SDK when using chat sessions
- Required for multi-turn image editing
- Preserved in conversation history for function calling

## Key Changes in v0.8.2

- **Video Upload Support**: New tools for analyzing local video files and inline video data
  - Added `gemini-analyze-video` for comprehensive video analysis
  - Added `gemini-summarize-video` for quick video summarization
  - Supports 11 video formats: MP4, MOV, AVI, MKV, WebM, FLV, WMV, M4V, MPG, MPEG, 3GP
  - Automatic file size handling (inline data for <20MB, Files API for ≥20MB)
  - Media resolution control and video clipping support
  - Complements existing YouTube analysis tools (kept separate and unchanged)

### Previous Versions
- v0.8.0: Image Analysis Tool with object detection, thinking level support, dual coordinate output
- v0.7.x: Published to MCP Registry, CLI renamed to gcli
- v0.6.3: Deep Research Agent, Token Counting
- v0.6.0: TTS with 30 voices, context caching, URL analysis
- v0.5.0: Code execution, Google Search, YouTube analysis, document analysis
- v0.3.0: Gemini 3 models, thinking levels, 4K image gen, multi-turn editing

## Future Roadmap

See `docs/ROADMAP.md` for implementation plan. Remaining features:
- **Lyria Music Generation**: Real-time music via WebSocket (complex)
- **Live Streaming API**: Real-time bidirectional streaming
- **File Search**: Search through uploaded file stores
