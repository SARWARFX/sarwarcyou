/**
 * Web-Standard Orientation Manager
 * Uses Screen Orientation API when available
 */
export async function lockToLandscape(): Promise<void> {
  if (typeof screen !== 'undefined' && 'orientation' in screen && 'lock' in (screen.orientation as any)) {
    try {
      await (screen.orientation as any).lock('landscape');
    } catch (_) {}
  }
}

export async function unlockOrientation(): Promise<void> {
  if (typeof screen !== 'undefined' && 'orientation' in screen && 'unlock' in (screen.orientation as any)) {
    try {
      (screen.orientation as any).unlock();
    } catch (_) {}
  }
}
