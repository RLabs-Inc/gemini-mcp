/**
 * Token Counting Tool - Count tokens before making API calls
 *
 * Helps users estimate costs and manage context windows.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../utils/logger.js";
import { genAI } from "../gemini-client.js";

/**
 * Register token counting tool with the MCP server
 */
export function registerTokenCountTool(server: McpServer): void {
  server.tool(
    "gemini-count-tokens",
    {
      content: z.string().describe("The text content to count tokens for"),
      model: z
        .enum(["pro", "flash"])
        .default("flash")
        .describe("Which model to use for counting (affects tokenization)")
    },
    async ({ content, model = "flash" }) => {
      logger.info(`Counting tokens for ${content.length} characters using ${model} model`);

      try {
        const modelName = model === "pro"
          ? (process.env.GEMINI_PRO_MODEL || "gemini-3-pro-preview")
          : (process.env.GEMINI_FLASH_MODEL || "gemini-3-flash-preview");

        const result = await genAI.models.countTokens({
          model: modelName,
          contents: content
        });

        const totalTokens = result.totalTokens || 0;

        // Estimate costs (approximate, based on typical pricing)
        // Gemini 3 Pro: ~$1.25 per 1M input tokens
        // Gemini 3 Flash: ~$0.075 per 1M input tokens
        const costPer1M = model === "pro" ? 1.25 : 0.075;
        const estimatedCost = (totalTokens / 1_000_000) * costPer1M;

        // Context window info
        const contextWindow = model === "pro" ? 1_000_000 : 1_000_000;
        const percentUsed = (totalTokens / contextWindow) * 100;

        const response = `**Token Count Results**

| Metric | Value |
|--------|-------|
| **Total Tokens** | ${totalTokens.toLocaleString()} |
| **Characters** | ${content.length.toLocaleString()} |
| **Model** | ${modelName} |

**Context Window Usage:**
- Context window: ${contextWindow.toLocaleString()} tokens
- Used: ${percentUsed.toFixed(4)}%
- Remaining: ${(contextWindow - totalTokens).toLocaleString()} tokens

**Estimated Cost:**
- Input cost: ~$${estimatedCost.toFixed(6)} USD
- Per 1M tokens: $${costPer1M} (${model})

*Note: Actual costs may vary. Check [Google AI pricing](https://ai.google.dev/pricing) for current rates.*`;

        logger.info(`Token count: ${totalTokens}`);

        return {
          content: [{ type: "text", text: response }]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error counting tokens: ${errorMessage}`);

        return {
          content: [{ type: "text", text: `Error counting tokens: ${errorMessage}` }],
          isError: true
        };
      }
    }
  );
}
