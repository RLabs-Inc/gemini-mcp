# MCP Server Gemini

A Model Context Protocol (MCP) server for integrating Google's Gemini models with Claude Code, enabling powerful collaboration between both AI systems.

## Features

- **Direct Query**: Send prompts to Gemini models and get responses
- **Collaborative Brainstorming**: Enable Claude and Gemini to work together on complex problems
- **Code Analysis**: Analyze code for quality, security, performance, and bugs
- **Text Analysis**: Analyze text for sentiment, key points, entities, and more
- **Content Summarization**: Summarize long content at different levels of detail
- **Image Prompt Generation**: Create detailed prompts for image generation

## Installation



## Integration with Claude Code

Claude Code uses the Model Context Protocol (MCP) to connect with external tools and data sources. This MCP server allows Claude to access Gemini's capabilities directly within your Claude Code environment.

### Quick Installation (One-Line Command)

The easiest way to add Gemini to Claude Code is with a one-line command:

```bash
# Replace YOUR_GEMINI_API_KEY with your actual Google Gemini API key
claude mcp add gemini -s user -- env GEMINI_API_KEY=YOUR_GEMINI_API_KEY npx -y https://github.com/rlabs-inc/gemini-mcp.git
```

You can also include verbosity options:
```bash
# For verbose logging
claude mcp add gemini -s user -- env GEMINI_API_KEY=YOUR_GEMINI_API_KEY VERBOSE=true npx -y https://github.com/rlabs-inc/gemini-mcp.git

# For quiet mode
claude mcp add gemini -s user -- env GEMINI_API_KEY=YOUR_GEMINI_API_KEY QUIET=true npx -y https://github.com/rlabs-inc/gemini-mcp.gitp
```

### Alternative Manual Installation

If you prefer a manual setup:

#### Step 1: Install the MCP Server

First, make sure you have Node.js installed, then install the server globally:


#### Step 2: Start Claude Code

Launch Claude Code in your terminal:

```bash
claude
```

#### Step 3: Add the Gemini MCP Server

Once in Claude Code, use the `/mcp add` command to add the Gemini server:

```
/mcp add
```

When prompted, provide this configuration:

```json
{
  "gemini": {
    "command": "npx",
    "args": ["-y", "https://github.com/rlabs-inc/gemini-mcp.git"],
    "env": {
      "GEMINI_API_KEY": "your-gemini-api-key"
    }
  }
}
```

#### Step 4: Verify and Enable the Server

Verify that the server was added successfully:

```
/mcp list
```

Then enable the Gemini server for your current session:

```
/mcp use gemini
```

## Using Gemini Tools in Claude Code

After enabling the Gemini server, you can access Gemini's capabilities through MCP tools:

### MCP Tool-Based Approach

When you enable the Gemini server with `/mcp use gemini`, you can call the tools directly:

```
/gemini-query What is quantum computing?
/gemini-brainstorm How could we implement a real-time collaboration feature?
/gemini-analyze-code python performance
```

### Creating Custom Slash Commands (Recommended)

For a more seamless experience, you can create custom slash commands to access Gemini's tools. This makes them easier to use and remember.

#### Project-Specific Commands

Create a commands directory in your project:

```bash
mkdir -p .claude/commands
```

Then create markdown files for each command:

1. **Query Gemini** (.claude/commands/gemini.md):
```markdown
Ask Gemini: $ARGUMENTS
```

2. **Analyze Code** (.claude/commands/analyze.md):
```markdown
/gemini-analyze-code general

$ARGUMENTS
```

3. **Brainstorm** (.claude/commands/brainstorm.md):
```markdown
/gemini-brainstorm $ARGUMENTS
```

4. **Summarize** (.claude/commands/summarize.md):
```markdown
/gemini-summarize brief paragraph

$ARGUMENTS
```

#### Using Your Custom Commands

Now you can use these simple commands in Claude Code:

```
/project:gemini How does quantum computing work?
/project:analyze def fibonacci(n): return 1 if n <= 1 else fibonacci(n-1) + fibonacci(n-2)
/project:brainstorm How can we improve our CI/CD pipeline?
/project:summarize [Paste long text here]
```

#### Personal Commands

You can also create personal commands that work across all your projects:

```bash
mkdir -p ~/.claude/commands
```

Example personal command for Gemini code reviews (~/.claude/commands/review.md):
```markdown
/gemini-analyze-code $ARGUMENTS
```

Then use it with:
```
/user:review security [Your code here]
```

## Tool Examples

Here are examples of using each Gemini tool:

### Basic Queries

```
/gemini-query What is quantum computing?
```

### Collaborative Brainstorming

Start a brainstorming session:
```
/gemini-brainstorm How could we implement a real-time collaboration feature?
```

Continue the brainstorming session with your input:
```
/gemini-brainstorm round:2 claudeInput:"I think we should use WebSockets for real-time updates. What about handling offline mode?"
```

Create a final synthesis after several rounds:
```
/gemini-brainstorm-synthesis prompt:"Real-time collaboration feature implementation" history:[...]
```

### Code Analysis

```
/gemini-analyze-code python performance

def fibonacci(n):
    if n <= 1:
        return n
    else:
        return fibonacci(n-1) + fibonacci(n-2)
```

### Text Analysis

```
/gemini-analyze-text sentiment

The product launch exceeded our expectations with positive customer feedback,
though we noticed some performance issues under heavy load.
```

### Summarization

```
/gemini-summarize brief bullet-points

[Paste long content here]
```

### Image Prompt Generation

```
/gemini-image-prompt minimalist calm

A modern workspace overlooking a peaceful garden
```

## Collaborative Workflow Example

Here's an example of how to use Claude and Gemini together for solving problems:

1. **Initial analysis with Claude**:
   ```
   claude
   > analyze the performance issue in our authentication service
   ```

2. **Get Gemini's perspective**:
   ```
   /project:gemini What could cause authentication service bottlenecks?
   ```

3. **Generate solution with Claude**: 
   ```
   > Based on your analysis and Gemini's input, create a plan to fix these issues
   ```

4. **Refine with Gemini's insights**:
   ```
   /project:analyze 
   
   [Paste the proposed solution here]
   ```

5. **Implement the solution with Claude**:
   ```
   > Please implement the solution we developed
   ```

## Command Line Options

The MCP server supports these command line options:

```bash
gemini-mcp [options]

Options:
  -v, --verbose    Enable verbose logging (shows all prompts and responses)
  -q, --quiet      Run in quiet mode (minimal logging)
  -h, --help       Show this help message
```

## Environment Variables

- `GEMINI_API_KEY` (required): Your Google Gemini API key
- `GEMINI_MODEL` (optional): Default Gemini model (default: "gemini-1.5-pro")
- `GEMINI_PRO_MODEL` (optional): Specify Pro model variant (default: "gemini-1.5-pro")
- `GEMINI_FLASH_MODEL` (optional): Specify Flash model variant (default: "gemini-1.5-flash")
- `VERBOSE` (optional): Set to "true" to enable verbose logging
- `QUIET` (optional): Set to "true" to enable quiet mode

### Proxy Configuration

The MCP server respects standard proxy environment variables:

- `http_proxy` or `HTTP_PROXY`: HTTP proxy URL (e.g., `http://proxy.example.com:8080`)
- `https_proxy` or `HTTPS_PROXY`: HTTPS proxy URL (e.g., `http://proxy.example.com:8080`)
- `no_proxy` or `NO_PROXY`: Comma-separated list of hosts to bypass proxy (e.g., `localhost,127.0.0.1,.internal.domain`)

Example with proxy:
```bash
export https_proxy=http://corporate-proxy.example.com:8080
export no_proxy=localhost,127.0.0.1
claude mcp add gemini -s user -- env GEMINI_API_KEY=YOUR_KEY https_proxy=$https_proxy no_proxy=$no_proxy npx -y @rlabs/gemini-mcp
```

## Recommended Project Setup

For the best experience, we recommend this setup for your project:

1. **Install the MCP server globally** for your team to use

2. **Create a `.claude` directory** in your project:
   ```bash
   mkdir -p .claude/commands
   ```

3. **Add custom slash commands** for common Gemini operations:
   ```bash
   # Create the commands
   echo "/gemini-query \$ARGUMENTS" > .claude/commands/gemini.md
   echo "/gemini-analyze-code general\n\n\$ARGUMENTS" > .claude/commands/analyze.md
   echo "/gemini-brainstorm \$ARGUMENTS" > .claude/commands/brainstorm.md
   echo "/gemini-summarize brief paragraph\n\n\$ARGUMENTS" > .claude/commands/summarize.md
   ```

4. **Create a project-specific CLAUDE.md** with Gemini usage instructions:
   ```markdown
   # Gemini Integration
   
   This project has Gemini integration enabled through MCP. Use these commands:
   
   - `/project:gemini [question]` - Ask Gemini a question
   - `/project:analyze [code]` - Analyze code with Gemini
   - `/project:brainstorm [topic]` - Start a brainstorming session
   - `/project:summarize [text]` - Summarize text with Gemini
   ```

5. **Commit these files to your repository** so your entire team can use them

## Troubleshooting

### Server Connection Issues

If Claude can't connect to the Gemini MCP server:

1. Check that the server is installed: `npm list -g @rlabs/gemini-mcp`
2. Verify your API key is correct in the configuration
3. Try running the server manually: `gemini-mcp -v`
4. Make sure your terminal has internet access

### Custom Command Issues

If your custom slash commands aren't working:

1. Check that the `.claude/commands/` directory exists
2. Verify the command files have the correct format
3. Make sure the files have a `.md` extension
4. Try restarting Claude Code

### Tool Execution Problems

If tools aren't working as expected:

1. Verify the server is listed with `/mcp list`
2. Make sure you've enabled the server with `/mcp use gemini`
3. Check if your Gemini API key has the necessary permissions
4. Try restarting Claude Code and the MCP server

## Development

```bash
# Clone the repository
git clone https://github.com/rlabs-inc/gemini-mcp.git
cd gemini-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run with verbose logging
npm run dev -- --verbose
```

## License

MIT License