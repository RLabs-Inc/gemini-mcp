/**
 * Query Tool - Send direct queries to Gemini models
 *
 * This tool allows sending prompts directly to Gemini and receiving responses.
 * Supports Gemini 3's thinking levels for controlling reasoning depth.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  generateWithGeminiPro,
  generateWithGeminiFlash,
  type ThinkingLevel,
} from '../gemini-client.js'

/**
 * Register query tools with the MCP server
 */
export function registerQueryTool(server: McpServer): void {
  // Standard query tool using Pro model with thinking level support
  server.tool(
    'gemini-query',
    {
      prompt: z.string().describe('The prompt to send to Gemini'),
      model: z
        .enum(['pro', 'flash'])
        .default('pro')
        .describe('The Gemini model to use (pro or flash)'),
      thinkingLevel: z
        .enum(['minimal', 'low', 'medium', 'high'])
        .optional()
        .describe(
          'Reasoning depth: minimal/low for fast responses, medium/high for complex tasks. ' +
            'Pro supports low/high only. Flash supports all levels. Default is high.'
        ),
    },
    async ({ prompt, model, thinkingLevel }) => {
      console.log(
        `Querying Gemini ${model} model (thinking: ${thinkingLevel || 'default'}) with prompt: ${prompt.substring(0, 100)}...`
      )

      try {
        const options = thinkingLevel
          ? { thinkingLevel: thinkingLevel as ThinkingLevel }
          : {}

        const response =
          model === 'pro'
            ? await generateWithGeminiPro(prompt, options)
            : await generateWithGeminiFlash(prompt, options)
        
        // Check for empty response to avoid potential MCP errors
        if (!response || response.trim() === "") {
          return {
            content: [{ 
              type: "text", 
              text: "Error: Received empty response from Gemini API" 
            }],
            isError: true
          };
        }
        
        return {
          content: [{ 
            type: "text", 
            text: response 
          }]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error querying Gemini: ${errorMessage}`);
        
        return {
          content: [{ 
            type: "text", 
            text: `Error: ${errorMessage}` 
          }],
          isError: true
        };
      }
    }
  );
}