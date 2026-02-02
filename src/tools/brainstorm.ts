/**
 * Brainstorm Tool - Enables automatic collaborative brainstorming between Claude and Gemini
 *
 * This tool facilitates multi-round collaborative planning until consensus is reached.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { generateWithGeminiPro } from '../gemini-client.js'
import { logger } from '../utils/logger.js'

interface Round {
  number: number
  claudeThoughts: string
  geminiResponse: string
  consensusScore: number
}

/** Consensus threshold - score at which brainstorming is considered complete */
const CONSENSUS_THRESHOLD = 8

/**
 * Register brainstorm tool with the MCP server
 */
export function registerBrainstormTool(server: McpServer): void {
  server.tool(
    'gemini-brainstorm',
    {
      prompt: z.string().describe('The problem statement or query to brainstorm about'),
      maxRounds: z.number().int().min(1).max(5).default(3).describe('Maximum number of brainstorming rounds'),
      claudeThoughts: z.string().describe("Claude's initial thoughts on the problem"),
    },
    async ({ prompt, maxRounds = 3, claudeThoughts }) => {
      logger.info(`Starting consensus-building brainstorm with Gemini: ${prompt.substring(0, 50)}...`)

      try {
        // Set up conversation tracking
        const rounds: Round[] = []
        let currentRound = 1
        let consensusReached = false

        // First round - Gemini responds to Claude's initial thoughts
        const firstRoundPrompt = `
You're collaborating with Claude (another AI assistant) to address this user request:

---
${prompt}
---

Claude has shared these initial thoughts:
${claudeThoughts}

Analyze Claude's thoughts and respond with:
1. Points of agreement
2. Additional insights or perspectives
3. Any modifications to Claude's approach
4. Next steps to implement the solution

End your response with a "Consensus Score" from 1-10 indicating how aligned you are with Claude:
- 1-3: Significant differences in approach
- 4-6: Partial agreement with key differences
- 7-9: Strong alignment with minor refinements
- 10: Complete consensus

Format this as: "Consensus Score: [NUMBER]"
`

        const geminiFirstResponse = await generateWithGeminiPro(firstRoundPrompt)

        // Extract consensus score
        const consensusMatch = geminiFirstResponse.match(/Consensus Score:\s*(\d+)/i)
        const consensusScore = consensusMatch ? parseInt(consensusMatch[1], 10) : 0

        // Record first round
        rounds.push({
          number: currentRound,
          claudeThoughts: claudeThoughts,
          geminiResponse: geminiFirstResponse,
          consensusScore: consensusScore,
        })

        // Check if we already have consensus
        if (consensusScore >= CONSENSUS_THRESHOLD) {
          logger.info(`Consensus reached in first round with score ${consensusScore}`)
          consensusReached = true
        }

        // Continue with additional rounds if needed
        currentRound++
        let lastClaudeThoughts = claudeThoughts
        let lastGeminiResponse = geminiFirstResponse

        while (currentRound <= maxRounds && !consensusReached) {
          // Generate Claude's response to Gemini (using Gemini to simulate)
          const simulateClaudePrompt = `
You will simulate Claude's response in our brainstorming process about this request:

---
${prompt}
---

Previous exchange:
1. Claude's initial thoughts: 
${lastClaudeThoughts.substring(0, 300)}${lastClaudeThoughts.length > 300 ? '...' : ''}

2. Your (Gemini's) response: 
${lastGeminiResponse}

As Claude, respond to Gemini's message. Use Claude's communication style:
1. Analytical, thoughtful, and balanced
2. Precise and well-structured
3. Careful about implementation details
4. Focused on understanding nuance

Include areas of agreement, further refinements, and a path forward.

End your response with a "Consensus Score" from 1-10:
- 1-3: Significant differences remain
- 4-6: Closer alignment but key differences exist
- 7-9: Strong alignment with minor refinements
- 10: Complete consensus

Format: "Consensus Score: [NUMBER]"
`

          const simulatedClaudeResponse = await generateWithGeminiPro(simulateClaudePrompt)

          // Extract consensus score
          const claudeConsensusMatch = simulatedClaudeResponse.match(/Consensus Score:\s*(\d+)/i)
          const claudeConsensusScore = claudeConsensusMatch ? parseInt(claudeConsensusMatch[1], 10) : 0

          // Generate Gemini's response to Claude
          const geminiFollowUpPrompt = `
Continuing our collaboration with Claude on this request:

---
${prompt}
---

Latest exchange:
1. Your previous response: 
${lastGeminiResponse.substring(0, 300)}${lastGeminiResponse.length > 300 ? '...' : ''}

2. Claude's latest thoughts: 
${simulatedClaudeResponse}

Respond to Claude's latest message, focusing on:
1. Addressing any remaining differences
2. Building on areas of agreement
3. Moving toward a final consensus solution
4. Clarifying implementation details

End your response with a "Consensus Score" from 1-10:
- 1-3: Significant differences remain
- 4-6: Closer alignment but key differences exist
- 7-9: Strong alignment with minor refinements
- 10: Complete consensus

Format: "Consensus Score: [NUMBER]"
`

          const geminiResponse = await generateWithGeminiPro(geminiFollowUpPrompt)

          // Extract consensus score
          const geminiConsensusMatch = geminiResponse.match(/Consensus Score:\s*(\d+)/i)
          const geminiConsensusScore = geminiConsensusMatch ? parseInt(geminiConsensusMatch[1], 10) : 0

          // Record this round
          rounds.push({
            number: currentRound,
            claudeThoughts: simulatedClaudeResponse,
            geminiResponse: geminiResponse,
            consensusScore: geminiConsensusScore,
          })

          // Check if we've reached consensus
          if (geminiConsensusScore >= CONSENSUS_THRESHOLD || claudeConsensusScore >= CONSENSUS_THRESHOLD) {
            logger.info(`Consensus reached in round ${currentRound} with score ${geminiConsensusScore}`)
            consensusReached = true
          }

          // Update for next round
          lastClaudeThoughts = simulatedClaudeResponse
          lastGeminiResponse = geminiResponse
          currentRound++
        }

        // Generate final synthesis of the conversation
        const synthesisPrompt = `
You've completed a collaborative brainstorming session with Claude about:

---
${prompt}
---

Here's the conversation history:
${rounds
  .map(
    (round) => `
Round ${round.number}:
- Claude: ${round.claudeThoughts.substring(0, 250)}${round.claudeThoughts.length > 250 ? '...' : ''}
- Gemini: ${round.geminiResponse.substring(0, 250)}${round.geminiResponse.length > 250 ? '...' : ''}
- Consensus Score: ${round.consensusScore}/10
`
  )
  .join('\n')}

Create a comprehensive synthesis that Claude can implement:
1. A clear summary of the approach both AIs agreed upon
2. A specific, actionable plan addressing the user's request
3. Key implementation details and considerations
4. Any technical requirements or resources needed
5. Next steps for Claude to execute

Your synthesis should be structured, thorough, and ready for Claude to implement.
`

        const finalSynthesis = await generateWithGeminiPro(synthesisPrompt)

        // Format the conversation history
        const conversationHistory = rounds
          .map(
            (round) => `
## Round ${round.number}

### Claude's Thoughts
${round.claudeThoughts}

### Gemini's Response
${round.geminiResponse}

**Consensus Score: ${round.consensusScore}/10**
`
          )
          .join('\n\n---\n\n')

        // Return the final result
        return {
          content: [
            {
              type: 'text',
              text: `# Collaborative Solution: ${prompt.substring(0, 50)}...

## Final Synthesis
${finalSynthesis}

${
  consensusReached
    ? `\n\n*Consensus reached after ${rounds.length} rounds of collaboration.*`
    : `\n\n*Maximum rounds (${maxRounds}) reached. Providing best synthesis.*`
}

## Conversation History
${conversationHistory}`,
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Error in brainstorming: ${errorMessage}`)

        return {
          content: [{ type: 'text', text: `Error: ${errorMessage}` }],
          isError: true,
        }
      }
    }
  )
}
