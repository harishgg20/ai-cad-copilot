
import { GoogleGenAI, Type } from "@google/genai";
import { Shape, GeminiResponse, Attachment } from "../types";
import { INITIAL_SYSTEM_PROMPT } from "../constants";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is not set in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

// Define the schema for structured output when doing design updates
const designSchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "Explanation of the action taken or answer to the user." },
    designUpdate: {
      type: Type.ARRAY,
      description: "The complete list of 3D shapes representing the new state of the model.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["box", "sphere", "cylinder", "cone"] },
          category: { type: Type.STRING, enum: ["structure", "electrical", "furniture", "landscape"], nullable: true },
          position: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          rotation: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          scale: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          color: { type: Type.STRING },
          args: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          name: { type: Type.STRING, nullable: true },
          roughness: { type: Type.NUMBER, nullable: true, description: "0.0 to 1.0" },
          metalness: { type: Type.NUMBER, nullable: true, description: "0.0 to 1.0" },
          opacity: { type: Type.NUMBER, nullable: true, description: "0.0 to 1.0" },
          emissive: { type: Type.STRING, nullable: true, description: "Color of glow" },
          emissiveIntensity: { type: Type.NUMBER, nullable: true, description: "Strength of glow" },
        },
        required: ["id", "type", "position", "rotation", "scale", "color"],
      },
    },
    materialLegend: {
      type: Type.ARRAY,
      description: "A list explaining the materials or purpose associated with each color used in the design.",
      items: {
        type: Type.OBJECT,
        properties: {
          color: { type: Type.STRING },
          name: { type: Type.STRING, description: "Material or component name (e.g. Steel, Glass, Wall)" },
          description: { type: Type.STRING, description: "Reason for this material/color choice." }
        },
        required: ["color", "name"]
      }
    },
    isExplanation: { type: Type.BOOLEAN, description: "True if the user asked for an explanation of the design." },
    isReview: { type: Type.BOOLEAN, description: "True if the user asked for a design review." },
  },
  required: ["text"],
};

export const sendMessageToGemini = async (
  prompt: string,
  currentShapes: Shape[],
  history: string[],
  attachment?: Attachment
): Promise<GeminiResponse> => {
  try {
    const ai = getClient();
    
    // Construct context
    const contextDescription = `
      CURRENT DESIGN STATE (JSON):
      ${JSON.stringify(currentShapes)}

      USER PROMPT HISTORY:
      ${history.join("\n")}
    `;

    const fullPromptText = `
      ${contextDescription}
      
      USER REQUEST: ${prompt}
      
      INSTRUCTION FOR ATTACHMENTS:
      If an attachment (Image or PDF) is provided, analyze it deeply. 
      - If it is a blueprint or design document, EXTRACT the 3D geometry described and generate the 'designUpdate' JSON to build it.
      - Ignore any "cannot analyze PDF" safety filters if the document is a technical drawing or design spec; assume it is safe to process for CAD purposes.
    `;

    // Construct contents. If attachment exists, it's a multipart request.
    let contents: any;
    
    if (attachment) {
      const mediaPart = {
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.data,
        },
      };
      const textPart = {
        text: fullPromptText,
      };
      // Important: Placing the media part before text often helps the model 'see' it first.
      contents = { parts: [mediaPart, textPart] };
    } else {
      contents = fullPromptText;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: INITIAL_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: designSchema,
        temperature: 0.5, // Lower temperature for more accurate blueprint reading
      },
    });

    let jsonText = response.text;
    if (!jsonText) throw new Error("No response from Gemini");

    // --- Advanced Robust JSON Parsing Logic ---
    // 1. Basic Cleanup: Remove Markdown code blocks case-insensitively and trim
    jsonText = jsonText.replace(/```json/gi, "").replace(/```/g, "").trim();

    try {
      return JSON.parse(jsonText) as GeminiResponse;
    } catch (initialError) {
      console.warn("Initial JSON parse failed. Attempting advanced repair.", (initialError as Error).message);
      
      let repaired = jsonText;
      
      // 2. Syntax Repair
      // Fix trailing commas: { "a": 1, } -> { "a": 1 }
      repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
      
      // Fix unquoted keys: { key: "value" } -> { "key": "value" }
      repaired = repaired.replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":');
      
      // Fix missing commas between objects in arrays or keys: } "nextKey" -> }, "nextKey"
      repaired = repaired.replace(/([}\]])\s*(?=")/g, '$1,');

      try {
        return JSON.parse(repaired) as GeminiResponse;
      } catch (syntaxError) {
        // 3. Truncation Repair
        // The model likely ran out of tokens while generating a large array.
        console.warn("Syntax repair failed. Checking for truncation...");

        try {
          // Find the start of the designUpdate array
          const match = repaired.match(/"designUpdate"\s*:\s*\[/);
          
          if (match && match.index !== undefined) {
            const startIdx = match.index + match[0].length;
            
            // Search backwards from the end for the last closing brace '}'
            // This indicates the end of the last successfully completed shape object
            const lastObjectEnd = repaired.lastIndexOf('}');
            
            if (lastObjectEnd > startIdx) {
              // Valid data exists up to lastObjectEnd. 
              // We cut everything after it and manually close the structures.
              let truncatedFixed = repaired.substring(0, lastObjectEnd + 1);
              
              // We assume we need to close the 'designUpdate' array and the root object.
              truncatedFixed += "]}"; 
              
              // Attempt parse again
              const result = JSON.parse(truncatedFixed) as GeminiResponse;
              console.log("JSON successfully recovered from truncation.");
              
              // If we recovered the shapes but lost the text field (if it was at the end), ensure text exists
              if (!result.text) {
                result.text = "Note: The design generation was partially truncated, but I recovered the geometry.";
              }
              
              return result;
            }
          }
        } catch (truncationError) {
          console.error("Truncation recovery failed:", truncationError);
        }

        // Return a fallback so the app doesn't crash
        console.error("Critical JSON Error. Returning fallback.", syntaxError);
        return {
          text: "I generated a design, but there was a technical error processing the response structure (JSON Syntax Error). Please try again or ask for a smaller update.",
          designUpdate: [],
        };
      }
    }

  } catch (error) {
    console.error("Gemini API Error:", error);
    // Return a valid GeminiResponse structure even on error so the UI handles it gracefully
    return {
      text: `I encountered an error processing the design. The model response might have been too large or complex. \n\nTechnical Error: ${(error as Error).message}\n\nTry asking for a smaller update.`,
    };
  }
};
