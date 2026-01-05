/**
 * Deep Research Tool - Autonomous multi-step research agent
 *
 * Uses the Gemini Deep Research Agent for complex research tasks.
 * The agent autonomously plans, searches, reads, and synthesizes research.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { logger } from '../utils/logger.js'
import {
  startDeepResearch,
  checkDeepResearch,
  followUpResearch,
} from '../gemini-client.js'

// Store active research operations for polling
const activeResearchOperations = new Map<
  string,
  {
    startedAt: Date
    prompt: string
  }
>()

/**
 * Register deep research tools with the MCP server
 */
export function registerDeepResearchTool(server: McpServer): void {
  // Start a deep research task
  server.tool(
    'gemini-deep-research',
    {
      query: z.string().describe('The research question or topic to investigate'),
      format: z
        .string()
        .optional()
        .describe("Optional output format instructions (e.g., 'technical report with sections')"),
    },
    async ({ query, format }) => {
      logger.info(`Starting deep research: ${query.substring(0, 50)}...`)

      try {
        // Build the research prompt with optional formatting
        let researchPrompt = query
        if (format) {
          researchPrompt = `${query}\n\nFormat the output as: ${format}`
        }

        const result = await startDeepResearch(researchPrompt)

        // Store for later polling
        activeResearchOperations.set(result.id, {
          startedAt: new Date(),
          prompt: query,
        })

        logger.info(`Deep research started: ${result.id}`)

        return {
          content: [
            {
              type: 'text',
              text: `**Deep Research Started**

| Field | Value |
|-------|-------|
| **Research ID** | \`${result.id}\` |
| **Query** | ${query.substring(0, 100)}${query.length > 100 ? '...' : ''} |
| **Status** | In Progress |
| **Started** | ${new Date().toISOString()} |

**What happens now:**
1. The Deep Research Agent is autonomously planning its research approach
2. It will search the web, read sources, and synthesize findings
3. This typically takes 5-20 minutes (max 60 min for complex queries)

**To check progress:**
Use \`gemini-check-research\` with the Research ID above.

**Note:** Deep research tasks run in the background. You can continue working while waiting.`,
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Error starting deep research: ${errorMessage}`)

        // Check if it's an API availability issue
        if (errorMessage.includes('not available') || errorMessage.includes('interactions')) {
          return {
            content: [
              {
                type: 'text',
                text: `**Deep Research Not Available**

The Interactions API required for Deep Research may not be available yet in your SDK version or API access.

**Error:** ${errorMessage}

**Alternatives:**
- Use \`gemini-search\` for real-time web search
- Use \`gemini-query\` with a detailed research prompt
- Wait for Interactions API to become available in your region`,
              },
            ],
            isError: true,
          }
        }

        return {
          content: [{ type: 'text', text: `Error starting deep research: ${errorMessage}` }],
          isError: true,
        }
      }
    }
  )

  // Check research status
  server.tool(
    'gemini-check-research',
    {
      researchId: z.string().describe('The research ID returned from gemini-deep-research'),
    },
    async ({ researchId }) => {
      logger.info(`Checking research status: ${researchId}`)

      try {
        // Get stored operation info
        const operationInfo = activeResearchOperations.get(researchId)
        const elapsedMs = operationInfo ? Date.now() - operationInfo.startedAt.getTime() : 0
        const elapsedMinutes = Math.floor(elapsedMs / 60000)
        const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000)

        const result = await checkDeepResearch(researchId)

        if (result.status === 'completed') {
          // Research is done - extract the result
          activeResearchOperations.delete(researchId)

          const outputs = result.outputs || []
          const resultText =
            outputs.length > 0
              ? outputs[outputs.length - 1].text || 'No text output'
              : 'Research completed but no output found'

          logger.info(`Research completed: ${researchId}`)

          // Build the saved path info if available
          const savedPathInfo = result.savedPath
            ? `| **Full Response** | \`${result.savedPath}\` |`
            : ''

          return {
            content: [
              {
                type: 'text',
                text: `**Deep Research Complete**

| Field | Value |
|-------|-------|
| **Research ID** | \`${researchId}\` |
| **Status** | ✅ Completed |
| **Duration** | ${elapsedMinutes}m ${elapsedSeconds}s |
${savedPathInfo}

> **Note:** The full response (including citations, images, and all metadata) has been saved to the file above.

---

## Research Results

${resultText}`,
              },
            ],
          }
        } else if (result.status === 'failed') {
          activeResearchOperations.delete(researchId)

          logger.error(`Research failed: ${researchId} - ${result.error}`)

          return {
            content: [
              {
                type: 'text',
                text: `**Deep Research Failed**

| Field | Value |
|-------|-------|
| **Research ID** | \`${researchId}\` |
| **Status** | ❌ Failed |
| **Error** | ${result.error} |

The research task encountered an error. You can try:
- Starting a new research task with a different query
- Using \`gemini-search\` for simpler web searches`,
              },
            ],
            isError: true,
          }
        } else {
          // Still in progress
          return {
            content: [
              {
                type: 'text',
                text: `**Deep Research In Progress**

| Field | Value |
|-------|-------|
| **Research ID** | \`${researchId}\` |
| **Status** | ⏳ ${result.status} |
| **Elapsed** | ${elapsedMinutes}m ${elapsedSeconds}s |
| **Query** | ${operationInfo?.prompt.substring(0, 50) || 'Unknown'}... |

The agent is still working. Deep research typically takes 5-20 minutes (max 60 min for complex queries).

Check again in 30-60 seconds using \`gemini-check-research\`.`,
              },
            ],
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Error checking research status: ${errorMessage}`)

        return {
          content: [{ type: 'text', text: `Error checking research status: ${errorMessage}` }],
          isError: true,
        }
      }
    }
  )

  // Follow-up on completed research
  server.tool(
    'gemini-research-followup',
    {
      researchId: z.string().describe('The research ID from a completed research task'),
      question: z.string().describe('Follow-up question about the research results'),
    },
    async ({ researchId, question }) => {
      logger.info(`Research follow-up on ${researchId}: ${question.substring(0, 50)}...`)

      try {
        const result = await followUpResearch(researchId, question)

        return {
          content: [
            {
              type: 'text',
              text: `**Research Follow-up**

**Question:** ${question}

**Answer:**
${result}`,
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Error with research follow-up: ${errorMessage}`)

        return {
          content: [{ type: 'text', text: `Error with follow-up: ${errorMessage}` }],
          isError: true,
        }
      }
    }
  )
}
