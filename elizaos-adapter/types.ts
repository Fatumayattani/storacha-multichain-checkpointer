/**
 * @title ElizaOS Type Stubs
 * @notice Minimal local type definitions for ElizaOS adapter.
 *         These avoid a hard dependency on @elizaos/core while remaining
 *         structurally compatible with the real interfaces.
 */

export interface IAgentRuntime {
  // eslint-disable-next-line no-unused-vars
  getSetting(_key: string): string | undefined;
}

export interface Message {
  content: {
    text?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

export interface ActionResult {
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
  error?: string;
}

// eslint-disable-next-line no-unused-vars
export type ActionCallback = (_response: {
  text: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
}) => void;

export interface Action {
  name: string;
  description: string;
  similes?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  examples?: any[];
  validate: (
    // eslint-disable-next-line no-unused-vars
    _runtime: IAgentRuntime,
    // eslint-disable-next-line no-unused-vars
    _message: Message
  ) => Promise<boolean>;
  handler: (
    // eslint-disable-next-line no-unused-vars
    _runtime: IAgentRuntime,
    // eslint-disable-next-line no-unused-vars
    _message: Message,
    // eslint-disable-next-line no-unused-vars
    _state?: unknown,
    // eslint-disable-next-line no-unused-vars
    _options?: unknown,
    // eslint-disable-next-line no-unused-vars
    _callback?: ActionCallback
  ) => Promise<ActionResult>;
}

export interface Plugin {
  name: string;
  description: string;
  actions?: Action[];
}
