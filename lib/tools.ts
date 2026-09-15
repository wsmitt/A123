import { DEFENSE_KEYS } from "./defenseSystems";

// Groq/OpenAI-style tool schema, attached to every /api/chat request so the
// model can control the HUD's defense systems by voice. Keep this list
// small and specific — a vague or broad tool invites the model to call it
// for things it shouldn't.
export const CHAT_TOOLS = [
  {
    type: "function",
    function: {
      name: "toggle_defense_system",
      description:
        "Turn one of JARVIS's four defense systems on or off. Call this whenever the user asks to engage, activate, enable, raise, disable, deactivate, lower, turn on, or turn off the shield, power grid, uplink, or reactor.",
      parameters: {
        type: "object",
        properties: {
          system: {
            type: "string",
            enum: DEFENSE_KEYS,
            description: "Which defense system to control.",
          },
          state: {
            type: "string",
            enum: ["on", "off"],
            description: "Whether to turn the system on or off.",
          },
        },
        required: ["system", "state"],
      },
    },
  },
] as const;
