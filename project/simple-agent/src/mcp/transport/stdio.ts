/**
 * Stdio transport for MCP communication
 *
 * Spawns a child process and communicates via stdin/stdout using JSON-RPC 2.0
 */

import { spawn, ChildProcess } from "child_process";
import {
  MCPTransport,
  JSONRPCRequest,
  JSONRPCNotification,
  JSONRPCResponse,
} from "../types";

export class StdioTransport implements MCPTransport {
  private process: ChildProcess | null = null;
  private messageHandlers: ((message: JSONRPCResponse | JSONRPCNotification) => void)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];
  private pendingRequests: Map<number | string, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private messageBuffer: string = "";
  private idCounter: number = 0;

  constructor(
    private command: string,
    private args: string[] = [],
    private env: Record<string, string> = {}
  ) {}

  /**
   * Connect to the MCP server by spawning the child process
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.command, this.args, {
          env: { ...process.env, ...this.env },
          stdio: ["pipe", "pipe", "pipe"],
        });

        if (!this.process.stdout || !this.process.stdin) {
          reject(new Error("Failed to create stdio pipes"));
          return;
        }

        this.process.stdout.on("data", (data: Buffer) => {
          this.handleData(data);
        });

        this.process.stderr?.on("data", (data: Buffer) => {
          // MCP servers may output debug info to stderr
          console.error("[MCP Stderr]", data.toString());
        });

        this.process.on("error", (error) => {
          this.errorHandlers.forEach((handler) => handler(error));
        });

        this.process.on("exit", (code, signal) => {
          if (code !== 0 && code !== null) {
            this.errorHandlers.forEach((handler) =>
              handler(new Error(`Process exited with code ${code}`))
            );
          }
        });

        // Wait for the process to be ready (MCP servers typically send an initial message)
        // For stdio, we resolve immediately after spawn as there's no handshake
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming data from stdout
   */
  private handleData(data: Buffer): void {
    this.messageBuffer += data.toString();

    // Split by newlines (JSON-RPC messages are typically line-delimited)
    const lines = this.messageBuffer.split("\n");
    this.messageBuffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as JSONRPCResponse | JSONRPCNotification;
          this.handleMessage(message);
        } catch (error) {
          console.error("[MCP] Failed to parse message:", line);
        }
      }
    }
  }

  /**
   * Handle a parsed JSON-RPC message
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
   * Send a JSON-RPC request and wait for response
   */
  async send(message: JSONRPCRequest | JSONRPCNotification): Promise<unknown> {
    if (!this.process?.stdin) {
      throw new Error("Process not connected");
    }

    // Assign ID to request if not present (for notifications)
    if ("id" in message && message.id === undefined) {
      message.id = ++this.idCounter;
    }

    const json = JSON.stringify(message) + "\n";
    this.process.stdin.write(json);

    // If this is a notification, don't wait for response
    if (!("id" in message) || message.id === undefined) {
      return undefined;
    }

    // Wait for response
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(message.id as number | string, { resolve, reject });

      // Timeout after 30 seconds
      setTimeout(() => {
        const pending = this.pendingRequests.get(message.id as number | string);
        if (pending) {
          pending.reject(new Error("Request timeout"));
          this.pendingRequests.delete(message.id as number | string);
        }
      }, 30000);
    });
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
   * Disconnect from the MCP server by terminating the child process
   */
  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.pendingRequests.clear();
    this.messageBuffer = "";
  }
}
