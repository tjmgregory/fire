/**
 * Vitest Setup File
 *
 * Mocks Google Apps Script global objects for testing domain logic.
 * This allows us to test pure business logic without Apps Script runtime.
 */

// Mock Google Apps Script Utilities global
global.Utilities = {
  getUuid: () => {
    // Simple UUID v4 implementation for testing
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  sleep: (ms: number) => {
    // In tests, we don't actually want to sleep
    // This is a no-op for fast test execution
  },

  computeDigest: (algorithm: any, input: string) => {
    // Simple hash for testing (not cryptographically secure)
    // In real Apps Script, this uses SHA-256
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    // Convert to byte array (mimics Apps Script behavior)
    const bytes = [];
    for (let i = 0; i < 32; i++) {
      bytes.push((hash >> (i * 8)) & 0xff);
    }
    return bytes;
  },

  DigestAlgorithm: {
    SHA_256: 'SHA_256'
  }
} as any;

// Mock crypto for Node.js environment
if (typeof crypto === 'undefined') {
  (global as any).crypto = {
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  };
}
