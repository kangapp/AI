/**
 * Streamable HTTP transport for MCP communication
 *
 * Connects to MCP server via HTTP SSE (Server-Sent Events)
 * Sends POST requests for tool calls and receives streaming responses
 */

import {
  MCPTransport,
  JSONRPCRequest,
  JSONRPCNotification,
  JSONRPCResponse,
} from "../types";

export class StreamableHTTPTransport implements MCPTransport {
  private url: string;
  private eventSource: EventSource | null = null;
  private messageHandlers: ((message: JSONRPCResponse | JSONRPCNotification) => void)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];
  private pendingRequests: Map<number | string, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private idCounter: number = 0;
  private abortController: AbortController | null = null;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to the MCP server via HTTP SSE
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // For HTTP transport, we use EventSource for server-sent events
        // Note: EventSource doesn't support POST, so we use fetch for sending
        // and EventSource for receiving
        this.abortController = new AbortController();

        // Create EventSource for receiving streaming responses
        // MCP over HTTP typically uses a special endpoint for SSE
        const sseUrl = this.url.replace("/message", "/sse").replace("/v1/mcp", "/v1/mcp/sse");
        this.eventSource = new EventSource(sseUrl);

        this.eventSource.onopen = () => {
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as JSONRPCResponse | JSONRPCNotification;
            this.handleMessage(message);
          } catch (error) {
            console.error("[MCP HTTP] Failed to parse message:", event.data);
          }
        };

        this.eventSource.onerror = (error) => {
          const err = new Error("SSE connection error");
          this.errorHandlers.forEach((handler) => handler(err));
          // Don't reject here as EventSource reconnect automatically
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming JSON-RPC message
   */
  private handleMessage(message: JSONRPCResponse | JSONRPCNotification): void {
    // If this is a response to a request, resolve the pending promise
    if ("id" in message && message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else if (message.result !== undefined) {
          pending.resolve(message.result);
        }
        this.pendingRequests.delete(message.id);
      }
    }

    // Notify all message handlers
    this.messageHandlers.forEach((handler) => handler(message));
  }

  /**
   * Send a JSON-RPC request via POST
   */
  async send(message: JSONRPCRequest | JSONRPCNotification): Promise<unknown> {
    // Assign ID to request if not present
    if ("id" in message && message.id === undefined) {
      message.id = ++this.idCounter;
    }

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify(message),
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      // For streaming responses, read the SSE stream
      if (response.headers.get("Content-Type")?.includes("text/event-stream")) {
        return this.handleStreamingResponse(response);
      }

      // For non-streaming responses, parse JSON directly
      const result = await response.json();
      return result;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request aborted");
      }
      throw error;
    }
  }

  /**
   * Handle streaming SSE response
   */
  private async handleStreamingResponse(response: Response): Promise<unknown> {
    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              return undefined;
            }
            try {
              const message = JSON.parse(data) as JSONRPCResponse | JSONRPCNotification;
              this.handleMessage(message);
            } catch {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return undefined;
  }

  /**
   * Register a handler for incoming messages
   */
  onMessage(handler: (message: JSONRPCResponse | JSONRPCNotification) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Register a handler for errors
   */
  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.pendingRequests.clear();
  }
}
