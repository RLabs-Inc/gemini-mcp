# Gemini MCP Server Project Guide

This document provides essential information for Claude when working with this Gemini MCP server project.

## Project Overview

This project is an MCP (Model Context Protocol) server that connects Claude to Google's Gemini AI models. It enables bidirectional collaboration between Claude and Gemini, allowing them to work together by sharing capabilities and agent tools.

## Key Components

- `src/index.ts`: Main entry point for the MCP server
- `src/gemini-client.ts`: Client for Google's Generative AI API
- `src/utils/logger.ts`: Logging utilities with configurable verbosity
- `src/tools/*.ts`: Various tool implementations for integration with Claude Code

## Tools Implemented

1. **Query** (`query.ts`): Direct queries to Gemini models
2. **Brainstorm** (`brainstorm.ts`): Collaborative brainstorming between Claude and Gemini
3. **Analyze** (`analyze.ts`): Code and text analysis using Gemini
4. **Summarize** (`summarize.ts`): Content summarization at different detail levels
5. **Image Gen** (`image-gen.ts`): Image prompt generation for use with image generation tools

## Environment Variables

- `GEMINI_API_KEY` (required): Google Gemini API key
- `VERBOSE=true`: Enable verbose logging
- `QUIET=true`: Enable quiet logging
- `GEMINI_MODEL`: Default Gemini model (default: "gemini-1.5-pro")
- `GEMINI_PRO_MODEL`: Pro model variant (default: "gemini-1.5-pro")
- `GEMINI_FLASH_MODEL`: Flash model variant (default: "gemini-1.5-flash")
- `http_proxy` or `HTTP_PROXY`: HTTP proxy URL (e.g., `http://proxy.example.com:8080`)
- `https_proxy` or `HTTPS_PROXY`: HTTPS proxy URL (e.g., `http://proxy.example.com:8080`)
- `no_proxy` or `NO_PROXY`: Comma-separated list of hosts to bypass proxy

## Command Line Options

- `-v, --verbose`: Enable verbose logging
- `-q, --quiet`: Run in quiet mode
- `-h, --help`: Show help message

## Installation Methods

### Direct Installation Command

```bash
claude mcp add gemini -s user -- env GEMINI_API_KEY=YOUR_GEMINI_API_KEY npx -y @rlabs/gemini-mcp
```

With verbosity settings:
```bash
# Verbose logging
claude mcp add gemini -s user -- env GEMINI_API_KEY=YOUR_GEMINI_API_KEY VERBOSE=true npx -y @rlabs/gemini-mcp

# Quiet mode
claude mcp add gemini -s user -- env GEMINI_API_KEY=YOUR_GEMINI_API_KEY QUIET=true npx -y @rlabs/gemini-mcp

# With proxy support
claude mcp add gemini -s user -- env GEMINI_API_KEY=YOUR_GEMINI_API_KEY https_proxy=http://proxy.example.com:8080 npx -y @rlabs/gemini-mcp
```

### Manual Installation

1. Install globally: `npm install -g @rlabs/gemini-mcp`
2. Add to Claude Code with `/mcp add` and configuration JSON

## MCP Tool Commands

- `/gemini-query`: Direct queries to Gemini
- `/gemini-brainstorm`: Collaborative brainstorming
- `/gemini-analyze-code`: Code analysis
- `/gemini-analyze-text`: Text analysis 
- `/gemini-summarize`: Content summarization
- `/gemini-image-prompt`: Image prompt generation

## Custom Slash Commands

Users can create custom slash commands for simpler usage:

- Project-specific: `.claude/commands/` directory
- Personal commands: `~/.claude/commands/` directory

Examples:
- `/project:gemini` - Direct query to Gemini
- `/project:analyze` - Code analysis with Gemini
- `/project:brainstorm` - Start brainstorming session
- `/project:summarize` - Summarize content

## Development Commands

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run with verbose logging
npm run dev -- --verbose
```

## Package Information

- Name: `@rlabs/gemini-mcp`
- Binary: `gemini-mcp`
- Version: 0.1.0

## Troubleshooting

If the server doesn't connect:

1. Check installation: `npm list -g @rlabs/gemini-mcp`
2. Verify API key configuration
3. Try running manually: `gemini-mcp -v`
4. Ensure internet access

## Future Enhancements

Potential enhancements to consider:
- Additional Gemini models support
- More tool integrations
- Improved error handling and retry mechanisms
- Support for system prompts and context management