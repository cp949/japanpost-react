import type { ChildProcess, SpawnOptions } from "node:child_process";

export function loadExportEnvFile(options?: {
  env?: NodeJS.ProcessEnv;
  envFilePath?: string;
}): NodeJS.ProcessEnv;

export function isReadyHealthPayload(
  payload: unknown,
  expectedInstanceId?: string,
): boolean;

export function createInstanceId(prefix: string): string;

export function sleep(ms: number): Promise<void>;

export function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{
  response: Response;
  payload: unknown;
  text: string;
}>;

export function waitForReadyHealth(options: {
  attempts?: number;
  baseUrl: string;
  expectedInstanceId?: string;
  intervalMs?: number;
  isProcessAlive?: () => boolean;
}): Promise<boolean>;

export function spawnCommand(
  command: string,
  args: string[],
  options?: SpawnOptions,
): ChildProcess;

export function stopProcessTree(
  child: ChildProcess | undefined,
  options?: {
    graceMs?: number;
  },
): Promise<void>;

export function captureProcessOutput(
  child: ChildProcess,
  maxLength?: number,
): () => string;
