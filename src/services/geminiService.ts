const GEMINI_API_KEY =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY;

const GEMINI_MODEL = "gemini-3.5-flash-lite";

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/` +
  `${GEMINI_MODEL}:generateContent`;

export type SafeRouteAIContext = {
  weatherAlerts?: string;
  amberAlerts?: string;
  hazards?: string;
};

/**
 * Error used when the user cancels an AI request.
 *
 * This lets ai.tsx recognize cancellation separately
 * from an actual Gemini/API error.
 */
export class SafeRouteAICancelledError extends Error {
  constructor() {
    super("SafeRoute AI request was cancelled.");
    this.name = "SafeRouteAICancelledError";
  }
}

/**
 * The currently active Gemini request.
 *
 * Only one SafeRoute AI request should be active at
 * a time. Starting a new request automatically
 * cancels the previous one.
 */
let activeController: AbortController | null = null;

/**
 * Cancel the currently active Gemini request.
 *
 * This actually aborts the underlying fetch request,
 * rather than simply ignoring its eventual response.
 */
export function cancelSafeRouteAI(): void {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
}

export async function askSafeRouteAI(
  question: string,
  context?: SafeRouteAIContext
): Promise<string> {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    throw new Error("Please enter a question.");
  }

  if (!GEMINI_API_KEY) {
    throw new Error(
      "Gemini API key is missing. Check your .env file."
    );
  }

  /*
   * If another request is still active, cancel it first.
   */
  cancelSafeRouteAI();

  /*
   * Create a fresh controller for this request.
   */
  const controller = new AbortController();

  activeController = controller;

  const contextParts: string[] = [];

  if (context?.weatherAlerts?.trim()) {
    contextParts.push(
      `CURRENT NATIONAL WEATHER SERVICE ALERTS:\n${context.weatherAlerts.trim()}`
    );
  }

  if (context?.amberAlerts?.trim()) {
    contextParts.push(
      `CURRENT AMBER ALERT INFORMATION:\n${context.amberAlerts.trim()}`
    );
  }

  if (context?.hazards?.trim()) {
    contextParts.push(
      `CURRENT SAFEROUTE HAZARDS:\n${context.hazards.trim()}`
    );
  }

  const safetyContext =
    contextParts.length > 0
      ? `\n\nLIVE SAFETY DATA:\n\n${contextParts.join(
          "\n\n"
        )}`
      : "";

  try {
    const response = await fetch(
      `${GEMINI_URL}?key=${encodeURIComponent(
        GEMINI_API_KEY
      )}`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        /*
         * This is what makes cancellation real.
         *
         * When controller.abort() is called,
         * fetch() is terminated.
         */
        signal: controller.signal,

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  "You are SafeRoute AI, a safety assistant inside " +
                  "the SafeRoute navigation app. Your job is to help " +
                  "users understand safety alerts, hazards, weather, " +
                  "travel safety, and emergency preparedness. " +
                  "Give clear, calm, practical answers. Never claim " +
                  "that a location is completely safe. When there is " +
                  "an immediate emergency or danger, tell the user " +
                  "to contact appropriate emergency services. " +
                  "Do not invent alerts, hazards, routes, or official " +
                  "information. " +
                  "When live safety data is provided, use it as the " +
                  "primary source for your answer and clearly distinguish " +
                  "between live data and general safety advice. " +
                  "If no relevant live data is provided, say so rather " +
                  "than pretending that current alerts exist. " +
                  "Keep responses concise and easy to understand.",
              },
            ],
          },

          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    trimmedQuestion +
                    safetyContext,
                },
              ],
            },
          ],

          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    /*
     * If the request was cancelled while fetch was
     * finishing, treat it as cancellation.
     */
    if (controller.signal.aborted) {
      throw new SafeRouteAICancelledError();
    }

    if (!response.ok) {
      let errorMessage =
        `Gemini request failed with status ${response.status}.`;

      try {
        const errorData = await response.json();

        const apiMessage =
          errorData?.error?.message;

        if (
          typeof apiMessage === "string" &&
          apiMessage.trim()
        ) {
          errorMessage = apiMessage;
        }
      } catch {
        // Keep the default error message.
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();

    /*
     * Check again before processing the response.
     */
    if (controller.signal.aborted) {
      throw new SafeRouteAICancelledError();
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(
          (part: { text?: string }) =>
            part.text ?? ""
        )
        .join("")
        .trim();

    if (!text) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    return text;
  } catch (error) {
    /*
     * AbortController causes fetch() to reject with
     * an AbortError. Convert that into our own
     * SafeRoute-specific cancellation error.
     */
    if (
      controller.signal.aborted ||
      (error instanceof Error &&
        error.name === "AbortError")
    ) {
      throw new SafeRouteAICancelledError();
    }

    throw error;
  } finally {
    /*
     * Only clear the controller if this is still the
     * active request.
     */
    if (activeController === controller) {
      activeController = null;
    }
  }
}