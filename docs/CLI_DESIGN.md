# Gemini CLI Design Document

**Version:** 0.7.0 (planned)
**Created:** January 5, 2026
**Status:** In Progress

## Vision

Transform gemini-mcp from an MCP-only server into a dual-mode tool:
1. **MCP Server Mode** (existing) - `bunx @rlabs-inc/gemini-mcp`
2. **CLI Mode** (new) - `gemini <command> [options]`

The CLI should be **beautiful**, with themes and terminal-aware colors.

## Architecture

```
src/
  index.ts              # Entry point - routes to MCP or CLI
  cli/
    index.ts            # CLI router
    commands/           # Individual command handlers
      research.ts       # Deep research
      music.ts          # Lyria music generation
      image.ts          # Image generation
      speak.ts          # TTS
      search.ts         # Web search
      query.ts          # Direct Gemini query
      video.ts          # Video generation
      tokens.ts         # Token counting
    ui/
      theme.ts          # Theme system
      colors.ts         # Color utilities (uses Bun)
      spinner.ts        # Animated spinners
      box.ts            # Bordered boxes
      progress.ts       # Progress bars
      prompt.ts         # Interactive prompts
    config.ts           # CLI configuration
  server/               # Renamed from current root
    ... (existing MCP code)
```

## Entry Point Logic

```typescript
// src/index.ts
const args = process.argv.slice(2)

if (args.length === 0 || args[0] === 'serve') {
  // Start MCP server (existing behavior)
  startMcpServer()
} else {
  // CLI mode
  runCli(args)
}
```

## Theme System

### Default Theme (Terminal)
Uses the terminal's native colors via ANSI codes. Respects `NO_COLOR` env var.

### Theme Structure
```typescript
interface Theme {
  name: string
  colors: {
    primary: string      // Main accent
    secondary: string    // Secondary accent
    success: string      // Green/success
    error: string        // Red/error
    warning: string      // Yellow/warning
    info: string         // Blue/info
    muted: string        // Gray/subtle
    text: string         // Default text
  }
  symbols: {
    success: string      // ✓
    error: string        // ✗
    warning: string      // ⚠
    info: string         // ℹ
    spinner: string[]    // ['◐', '◓', '◑', '◒']
    arrow: string        // →
    bullet: string       // •
  }
  box: {
    topLeft: string
    topRight: string
    bottomLeft: string
    bottomRight: string
    horizontal: string
    vertical: string
  }
}
```

### Available Themes
1. **terminal** (default) - Adapts to terminal colors
2. **neon** - Cyberpunk/synthwave vibes (magenta, cyan, yellow)
3. **minimal** - Subtle, mostly monochrome
4. **ocean** - Blues and teals
5. **forest** - Greens and earth tones

### Bun Color API

Bun provides built-in ANSI color support:
```typescript
// Using Bun's built-in
const text = `\x1b[36mCyan text\x1b[0m`

// Or check for color support
const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR
```

We'll create a thin wrapper that:
- Uses Bun's native capabilities
- Falls back gracefully in non-TTY
- Respects NO_COLOR and FORCE_COLOR

## Commands

### gemini research
```bash
gemini research "query" [--format report|outline|brief]
```
- Starts deep research agent
- Shows real-time progress
- Saves full JSON + summary

### gemini music
```bash
gemini music "genre/mood" [--bpm 120] [--duration 30]
```
- Uses Lyria for music generation
- Shows progress bar
- Saves MP3/WAV

### gemini image
```bash
gemini image "prompt" [--size 1K|2K|4K] [--ratio 16:9]
```
- Uses Nano Banana Pro
- Shows generation progress
- Saves PNG, opens in viewer (optional)

### gemini speak
```bash
gemini speak "text" [--voice Kore] [--output file.mp3]
```
- Text-to-speech
- Lists voices with --list-voices
- Plays audio or saves file

### gemini search
```bash
gemini search "query"
```
- Real-time web search
- Displays results with citations
- Can save to file

### gemini query
```bash
gemini query "prompt" [--thinking high]
```
- Direct Gemini query
- Supports thinking levels
- Streams response

### gemini video
```bash
gemini video "prompt" [--ratio 16:9|9:16]
```
- Async video generation with Veo
- Polls and shows progress
- Downloads when complete

### gemini tokens
```bash
gemini tokens "text or @file.txt"
```
- Counts tokens
- Shows cost estimate

## UI Components

### Spinner
```
◐ Loading...
◓ Loading...
◑ Loading...
◒ Loading...
```

### Progress Bar
```
Generating ████████████░░░░░░░░ 60% (12s)
```

### Box
```
┌─────────────────────────────────────┐
│  🔮 Gemini CLI                      │
│  AI-powered tools at your terminal  │
└─────────────────────────────────────┘
```

### Result Display
```
✓ Research complete!

  Duration: 23m 42s
  Sources: 42 citations

  📄 Full report: ~/Downloads/research.json
  📝 Summary: ~/Downloads/research.md
```

## Configuration

Config file: `~/.config/gemini-cli/config.json`

```json
{
  "theme": "terminal",
  "outputDir": "~/Downloads",
  "defaultVoice": "Kore",
  "defaultImageSize": "2K",
  "apiKey": "..." // Or use GEMINI_API_KEY env
}
```

## Implementation Order

1. **Phase 1: Foundation**
   - [ ] CLI entry point and routing
   - [ ] Theme system with terminal default
   - [ ] Basic UI components (colors, spinner)
   - [ ] Config loading

2. **Phase 2: Core Commands**
   - [ ] `gemini query` - simplest, good test
   - [ ] `gemini search` - uses existing tool
   - [ ] `gemini tokens` - quick utility

3. **Phase 3: Rich Commands**
   - [ ] `gemini research` - async with progress
   - [ ] `gemini image` - file output
   - [ ] `gemini speak` - audio output

4. **Phase 4: Advanced**
   - [ ] `gemini music` - Lyria integration
   - [ ] `gemini video` - Veo integration
   - [ ] Interactive mode (REPL)

## Technical Notes

### Bun-Specific Features to Use
- Native file I/O (`Bun.write`, `Bun.file`)
- Built-in test runner for CLI tests
- Fast startup time (important for CLI feel)

### Dependencies to Add
- None for colors (use Bun/native ANSI)
- `@inquirer/prompts` for interactive mode
- Consider `ora` or build custom spinner

### Backwards Compatibility
- Running without args = MCP server (unchanged)
- All existing MCP functionality preserved
- CLI is additive, not replacing

## Open Questions

1. Should we support piping? (`cat file.txt | gemini query`)
2. Should `gemini image` auto-open the image viewer?
3. Interactive REPL mode for multi-turn conversations?
4. Should themes be in config or just CLI flags?

---

*This document serves as the blueprint for implementing the Gemini CLI. Continue from Phase 1.*
