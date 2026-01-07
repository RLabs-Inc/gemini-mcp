/**
 * Image Analysis Tool - Analyze images with object detection and bounding boxes
 *
 * This tool uses Gemini's vision capabilities to analyze images and detect objects
 * with bounding box coordinates. Returns both normalized box_2d format and pixel coordinates.
 *
 * Bounding Box Format:
 * - box_2d: [y_min, x_min, y_max, x_max] in 0-1000 normalized coordinates
 * - bbox_pixels: {x, y, width, height} in pixel coordinates (when dimensions available)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../utils/logger.js";
import * as fs from "fs";
import * as path from "path";

/**
 * Extract image dimensions from PNG or JPEG file
 */
function extractImageDimensions(
  filePath: string,
): { width: number; height: number } | null {
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".png") {
      // PNG format: width and height are at bytes 16-23 (big-endian)
      if (buffer.length < 24) return null;
      if (buffer.toString("ascii", 1, 4) !== "PNG") return null;

      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    } else if (ext === ".jpg" || ext === ".jpeg") {
      // JPEG format: scan for SOF0 or SOF2 markers
      let offset = 2; // Skip initial 0xFFD8
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) break;

        const marker = buffer[offset + 1];
        const segmentLength = buffer.readUInt16BE(offset + 2);

        // SOF0 (0xC0) or SOF2 (0xC2) markers contain dimensions
        if (marker === 0xc0 || marker === 0xc2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }

        offset += 2 + segmentLength;
      }
    }

    return null;
  } catch (error) {
    logger.debug(`Failed to extract dimensions: ${error}`);
    return null;
  }
}

/**
 * Convert box_2d normalized coordinates to pixel coordinates
 */
function convertToPixelCoords(
  box2d: number[],
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const [yMin, xMin, yMax, xMax] = box2d;
  return {
    x: Math.round((xMin / 1000) * width),
    y: Math.round((yMin / 1000) * height),
    width: Math.round(((xMax - xMin) / 1000) * width),
    height: Math.round(((yMax - yMin) / 1000) * height),
  };
}

/**
 * Get MIME type from file extension
 */
function getImageMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".gif": "image/gif",
  };
  return mimeTypes[ext] || "image/jpeg";
}

/**
 * Register image analysis tools with the MCP server
 */
export function registerImageAnalyzeTool(server: McpServer): void {
  server.tool(
    "gemini-analyze-image",
    {
      imagePath: z
        .string()
        .describe(
          "Path to image file. Supports JPEG, PNG, WebP, HEIC, HEIF, GIF",
        ),
      query: z
        .string()
        .optional()
        .describe(
          'Specific question about the image (e.g., "What objects are in this image?", "Count the people"). Default: "Analyze this image in detail."',
        ),
      detectObjects: z
        .boolean()
        .default(true)
        .describe(
          "Enable object detection with bounding boxes (returns box_2d coordinates). Default: true",
        ),
      model: z
        .enum(["pro", "flash"])
        .default("flash")
        .describe("Model to use: pro (more accurate) or flash (faster). Default: flash"),
      mediaResolution: z
        .enum(["low", "medium", "high"])
        .default("medium")
        .describe(
          "Resolution for processing: low (faster), medium (balanced), high (more detail). Default: medium",
        ),
    },
    async ({ imagePath, query, detectObjects, model, mediaResolution }) => {
      logger.info(`Analyzing image: ${imagePath}`);

      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error("GEMINI_API_KEY not set");
        }

        if (!fs.existsSync(imagePath)) {
          throw new Error(`File not found: ${imagePath}`);
        }

        const fileBuffer = fs.readFileSync(imagePath);
        const mimeType = getImageMimeType(imagePath);
        const dimensions = extractImageDimensions(imagePath);

        const genAI = new GoogleGenAI({ apiKey });
        const modelName =
          model === "pro"
            ? process.env.GEMINI_PRO_MODEL || "gemini-3-pro-preview"
            : process.env.GEMINI_FLASH_MODEL || "gemini-3-flash-preview";

        const fileSize = fileBuffer.length;
        logger.debug(`Image size: ${fileSize} bytes, MIME type: ${mimeType}`);

        // Log image dimensions (for pixel coordinate conversion)
        if (dimensions) {
          logger.debug(
            `Image dimensions: ${dimensions.width}x${dimensions.height}`,
          );
        } else {
          logger.debug("Could not extract image dimensions");
        }

        // Build prompt based on parameters
        let prompt = query || "Analyze this image in detail.";

        if (detectObjects) {
          prompt += `\n\nFor each object you identify, provide bounding box coordinates in the box_2d format: [y_min, x_min, y_max, x_max] where coordinates are normalized to 0-1000 scale.

Return your response as a JSON object with this structure:
{
  "description": "Overall description of the image",
  "objects": [
    {
      "label": "object name",
      "confidence": "high/medium/low",
      "box_2d": [y_min, x_min, y_max, x_max]
    }
  ]
}

If you cannot detect specific objects or bounding boxes are not applicable, return an empty objects array.`;
        }

        // Map resolution to API parameter
        const resolutionMap: Record<string, unknown> = {
          low: "media_resolution_low",
          medium: "media_resolution_medium",
          high: "media_resolution_high",
        };

        // For files <20MB, use inline data. For larger files, use Files API
        let responseText: string;

        if (fileSize > 20 * 1024 * 1024) {
          // Upload using Files API
          logger.info("Large file detected, uploading via Files API...");

          const uploadedFile = await genAI.files.upload({
            file: new Blob([new Uint8Array(fileBuffer)], { type: mimeType }),
            config: { mimeType },
          });

          const config: Record<string, unknown> = {};
          if (mediaResolution !== "medium") {
            config.mediaResolution = resolutionMap[mediaResolution];
          }

          // Add structured output for object detection
          if (detectObjects) {
            config.responseMimeType = "application/json";
            config.responseJsonSchema = {
              type: "object",
              properties: {
                description: { type: "string" },
                objects: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      confidence: { type: "string" },
                      box_2d: {
                        type: "array",
                        items: { type: "number" },
                        minItems: 4,
                        maxItems: 4,
                      },
                    },
                    required: ["label", "confidence", "box_2d"],
                  },
                },
              },
              required: ["description", "objects"],
            };
          }

          const response = await genAI.models.generateContent({
            model: modelName,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    fileData: {
                      fileUri: uploadedFile.uri,
                      mimeType: uploadedFile.mimeType,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            config: Object.keys(config).length > 0 ? config : undefined,
          });

          responseText = response.text || "";
        } else {
          // Use inline data for smaller files
          const base64Data = fileBuffer.toString("base64");

          const inlineConfig: Record<string, unknown> = {};
          if (mediaResolution !== "medium") {
            inlineConfig.mediaResolution = resolutionMap[mediaResolution];
          }

          // Add structured output for object detection
          if (detectObjects) {
            inlineConfig.responseMimeType = "application/json";
            inlineConfig.responseJsonSchema = {
              type: "object",
              properties: {
                description: { type: "string" },
                objects: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      confidence: { type: "string" },
                      box_2d: {
                        type: "array",
                        items: { type: "number" },
                        minItems: 4,
                        maxItems: 4,
                      },
                    },
                    required: ["label", "confidence", "box_2d"],
                  },
                },
              },
              required: ["description", "objects"],
            };
          }

          const response = await genAI.models.generateContent({
            model: modelName,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            config:
              Object.keys(inlineConfig).length > 0 ? inlineConfig : undefined,
          });

          responseText = response.text || "";
        }

        // Process response
        if (detectObjects && responseText) {
          try {
            const parsed = JSON.parse(responseText);

            // Add pixel coordinates if dimensions are available
            if (dimensions && parsed.objects && Array.isArray(parsed.objects)) {
              parsed.objects = parsed.objects.map(
                (obj: Record<string, unknown>) => {
                  if (Array.isArray(obj.box_2d) && obj.box_2d.length === 4) {
                    return {
                      ...obj,
                      bbox_pixels: convertToPixelCoords(
                        obj.box_2d as number[],
                        dimensions.width,
                        dimensions.height,
                      ),
                    };
                  }
                  return obj;
                },
              );
            }

            const formattedJson = JSON.stringify(parsed, null, 2);
            logger.info("Image analysis completed with object detection");

            return {
              content: [
                {
                  type: "text" as const,
                  text: `**Image Analysis Results:**\n\`\`\`json\n${formattedJson}\n\`\`\``,
                },
              ],
            };
          } catch (parseError) {
            // Fallback to plain text if JSON parsing fails
            logger.warn("Failed to parse JSON response, returning as text");
            return {
              content: [
                {
                  type: "text" as const,
                  text: responseText,
                },
              ],
            };
          }
        }

        logger.info("Image analysis completed");

        return {
          content: [
            {
              type: "text" as const,
              text: responseText || "Unable to analyze image.",
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(`Error in image analysis: ${errorMessage}`);

        return {
          content: [
            {
              type: "text" as const,
              text: `Error analyzing image: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
