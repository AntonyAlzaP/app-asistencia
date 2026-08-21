import { Injectable } from '@angular/core';

interface SavedCredentials {
  email: string;
  password: string;
}

declare global {
  interface Window {
    attendanceCredentials?: {
      save(email: string, password: string): Promise<{ ok: boolean }>;
      load(): Promise<SavedCredentials | null>;
      clear(): Promise<void>;
    };
  }
}

/**
 * "Recordar mis datos" storage — only meaningful inside Electron, where
 * main.js encrypts it via the OS credential store (safeStorage). Outside
 * Electron (e.g. `ng serve` in a plain browser) this is a no-op; there's no
 * secure place to put it, so we simply don't offer the feature there.
 */
@Injectable({ providedIn: 'root' })
export class CredentialsService {
  async save(email: string, password: string): Promise<void> {
    await window.attendanceCredentials?.save(email, password);
  }

  async load(): Promise<SavedCredentials | null> {
    return (await window.attendanceCredentials?.load()) ?? null;
  }

  async clear(): Promise<void> {
    await window.attendanceCredentials?.clear();
  }
}
