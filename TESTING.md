# Testing Video Upload Functionality

This guide explains how to test the new video upload features locally.

## Prerequisites

1. **Set your API key:**
   ```bash
   export GEMINI_API_KEY=your_gemini_api_key_here
   ```

2. **Have a test video file** (any of these formats):
   - MP4, MOV, AVI, MKV, WebM, FLV, WMV, M4V, MPG, MPEG, 3GP
   - Small file (<20MB) for quick testing recommended

## Method 1: Quick Test Script (Easiest)

Use the provided test script to quickly test video analysis:

```bash
# Basic usage - will summarize the video
bun test-video-upload.ts ./path/to/your/video.mp4

# Ask a specific question
bun test-video-upload.ts ./path/to/your/video.mp4 "What happens in this video?"

# Test with clipping (requires adding startTime/endTime - see below)
```

The script will:
- ✅ Automatically detect file size
- ✅ Use inline data for files <20MB
- ✅ Use Files API for files ≥20MB
- ✅ Show the analysis result

## Method 2: Test via MCP Protocol

### Step 1: Build the project

```bash
bun run build
```

### Step 2: Create a test MCP client

Create `test-mcp-client.ts`:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

async function testVideoTools() {
  // Start the MCP server process
  const transport = new StdioClientTransport({
    command: 'bun',
    args: ['dist/index.js'],
    env: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
    },
  })

  const client = new Client({
    name: 'test-client',
    version: '1.0.0',
  }, {
    capabilities: {},
  })

  await client.connect(transport)

  // List available tools
  const tools = await client.listTools()
  console.log('Available video tools:')
  tools.tools
    .filter(t => t.name.includes('video'))
    .forEach(t => console.log(`  - ${t.name}`))

  // Test gemini-analyze-video
  const result = await client.callTool({
    name: 'gemini-analyze-video',
    arguments: {
      videoPath: './path/to/your/video.mp4',
      question: 'Summarize this video',
      mediaResolution: 'medium',
    },
  })

  console.log('\nResult:', result)

  await client.close()
}

testVideoTools().catch(console.error)
```

Run it:
```bash
bun test-mcp-client.ts
```

## Method 3: Manual Testing with Direct API Calls

Create `test-direct.ts`:

```typescript
import { GoogleGenAI } from '@google/genai'
import * as fs from 'fs'

const apiKey = process.env.GEMINI_API_KEY!
const genAI = new GoogleGenAI({ apiKey })

// Test small file (inline data)
const videoBuffer = fs.readFileSync('./small-video.mp4')
const base64 = videoBuffer.toString('base64')

const response = await genAI.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents: [{
    role: 'user',
    parts: [
      {
        inlineData: {
          mimeType: 'video/mp4',
          data: base64,
        },
      },
      { text: 'Summarize this video' },
    ],
  }],
})

console.log(response.text)
```

## Method 4: Test via Claude Desktop

If you have Claude Desktop with MCP support:

1. **Add to your Claude Desktop config** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "gemini-dev": {
      "command": "bun",
      "args": ["/home/user/gemini-mcp/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your_key_here"
      }
    }
  }
}
```

2. **Restart Claude Desktop**

3. **Test the tools** by asking Claude:
   - "Use gemini-analyze-video to analyze the video at /path/to/video.mp4"
   - "Use gemini-summarize-video to summarize /path/to/video.mp4"

## Test Cases to Try

### Test 1: Small video file (<20MB)
```bash
bun test-video-upload.ts ./small-video.mp4 "What's in this video?"
```
**Expected:** Should use inline data (base64)

### Test 2: Large video file (≥20MB)
```bash
bun test-video-upload.ts ./large-video.mp4 "Summarize this video"
```
**Expected:** Should upload via Files API first

### Test 3: Different video formats
```bash
bun test-video-upload.ts ./video.mov "What happens?"
bun test-video-upload.ts ./video.avi "Describe this"
bun test-video-upload.ts ./video.webm "What do you see?"
```
**Expected:** All formats should work

### Test 4: Video summarization
```bash
# This would need to be tested via MCP or by modifying the test script
# to call the summarize-video functionality
```

## Expected Output

Successful test should show:
```
🎬 Testing Video Upload Functionality
=====================================

📁 Video file: ./sample.mp4
📊 File size: 5.32 MB
🎞️  MIME type: video/mp4
❓ Question: Summarize this video in 2-3 sentences.

📤 Using inline data (small file)...

🤖 Analyzing video with Gemini...

✨ Analysis Result:
==================
[Gemini's response about your video]

✅ Test completed successfully!
```

## Troubleshooting

### Error: "GEMINI_API_KEY not set"
```bash
export GEMINI_API_KEY=your_key_here
```

### Error: "File not found"
- Make sure the video path is correct
- Use absolute paths or paths relative to where you run the command

### Error: "Failed to upload"
- Check your API key is valid
- Verify the file isn't corrupted
- Ensure the video format is supported

### TypeScript errors when building
- Pre-existing type configuration issues (see main README)
- The code works at runtime even with type errors

## Development Tips

1. **Watch mode for development:**
   ```bash
   bun run dev
   ```

2. **Enable verbose logging:**
   ```bash
   VERBOSE=true bun test-video-upload.ts ./video.mp4
   ```

3. **Test different resolutions:**
   Modify test script to include `mediaResolution` parameter

4. **Test video clipping:**
   Add `startTime` and `endTime` parameters to test partial video analysis

## Next Steps

Once local testing is successful:
- Test integration with Claude Desktop
- Test via the full MCP protocol
- Add unit tests if needed
- Test edge cases (corrupted files, unsupported formats, etc.)
