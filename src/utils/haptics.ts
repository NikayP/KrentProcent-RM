/**
 * Triggers subtle native-like haptic feedback on supported Android devices.
 * Safely no-ops on browsers/devices without navigator.vibrate support.
 */
export function triggerHaptic(durationMs = 8): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(durationMs);
    }
  } catch {
    // Ignore unsupported environments
  }
}
