import { DEFENSE_KEYS } from "./defenseSystems";

// Groq/OpenAI-style tool schema, attached to every /api/chat request. Keep
// each one small and specific — a vague or broad tool invites the model to
// call it for things it shouldn't.
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
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the live web for current information — news, prices, scores, dates, or anything else that could have changed since training or that you aren't confident about. Call this rather than guessing.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "A concise web search query.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "launch_missiles",
      description:
        "Simulated armory action for this HUD demo only — logs a dramatic launch sequence and speaks a theatrical confirmation. No real system is affected. Call only when the user explicitly and unambiguously asks, in an obviously playful or fictional context, to launch missiles at a named target.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description: "The named target for the simulated launch.",
          },
        },
        required: ["target"],
      },
    },
  },
] as const;
