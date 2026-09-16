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
  {
    type: "function",
    function: {
      name: "get_weather",
      description:
        "Get the current real weather for a named place. Call this whenever the user asks about weather, temperature, or outdoor conditions anywhere.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "A city, region, or place name, e.g. \"Tokyo\" or \"Malibu, California\".",
          },
        },
        required: ["location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_timer",
      description:
        "Set a real countdown timer. Call this whenever the user asks for a timer, alarm, or to be told/reminded after some amount of time — convert minutes or hours to seconds. JARVIS announces it out loud the moment it finishes, and it's shown live in the top bar.",
      parameters: {
        type: "object",
        properties: {
          seconds: {
            type: "number",
            description: "How many seconds from now the timer should go off.",
          },
          label: {
            type: "string",
            description: "A short label for what the timer is for, e.g. \"pasta\" or \"break\". Optional.",
          },
        },
        required: ["seconds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_diagnostics",
      description:
        "Run a real system diagnostic and report back the actual live CPU load, memory usage, and uptime of the machine JARVIS is running on, plus current defense system states. Call this whenever the user asks for a status report, diagnostic, or how the systems are doing.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "self_destruct",
      description:
        "Simulated self-destruct sequence for this HUD demo only — the same kind of theatrical set dressing as launch_missiles. It logs a dramatic countdown and speaks a theatrical confirmation, then stands itself down a few seconds later on its own. No real system is affected, nothing is actually destroyed. Call only when the user explicitly and playfully asks JARVIS to self-destruct or trigger a self-destruct sequence.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
] as const;
