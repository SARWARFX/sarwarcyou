import { ScreenOrientation } from '@capacitor/screen-orientation';

export async function lockToLandscape(): Promise<void> {
  try {
    await ScreenOrientation.lock({ orientation: 'landscape' });
  } catch (_) {
    if (typeof screen !== 'undefined' && 'orientation' in screen && 'lock' in (screen.orientation as any)) {
      try {
        await (screen.orientation as any).lock('landscape');
      } catch (__) {}
    }
  }
}

export async function unlockOrientation(): Promise<void> {
  try {
    await ScreenOrientation.unlock();
  } catch (_) {
    if (typeof screen !== 'undefined' && 'orientation' in screen && 'unlock' in (screen.orientation as any)) {
      try {
        (screen.orientation as any).unlock();
      } catch (__) {}
    }
  }
}
