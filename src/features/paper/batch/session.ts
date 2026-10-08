/**
 * A single batch may run at a time. The plugin runs in Zotero's shared global
 * scope, so the lock also covers a second window starting the same command.
 * Each session records the window that started it; closing that window stops
 * the batch before the next item is dispatched, while closing another window
 * leaves it running. Plugin unload stops whatever session is still active.
 */
export interface BatchSession {
  isActive(): boolean;
  finish(): void;
}

let sessionCounter = 0;
let activeSession: { token: number; owner: object } | null = null;

export function beginBatchSession(owner: object): BatchSession | null {
  if (activeSession) {
    return null;
  }
  const token = (sessionCounter += 1);
  activeSession = { token, owner };
  return {
    isActive: () => activeSession?.token === token,
    finish: () => {
      if (activeSession?.token === token) {
        activeSession = null;
      }
    },
  };
}

/**
 * Stops the active batch. Called with a window it only stops that window's
 * batch; called without an argument it stops the batch regardless of owner.
 */
export function stopActiveBatchSession(owner?: object): boolean {
  if (!activeSession) {
    return false;
  }
  if (owner !== undefined && activeSession.owner !== owner) {
    return false;
  }
  activeSession = null;
  return true;
}

export function hasActiveBatchSession(): boolean {
  return activeSession !== null;
}
