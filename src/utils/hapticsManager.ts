import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export async function hapticLight(): Promise<void> {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (_) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch (__) {}
    }
  }
}

export async function hapticMedium(): Promise<void> {
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (_) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(25);
      } catch (__) {}
    }
  }
}

export async function hapticHeavy(): Promise<void> {
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (_) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(40);
      } catch (__) {}
    }
  }
}

export async function hapticSelection(): Promise<void> {
  try {
    await Haptics.selectionChanged();
  } catch (_) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch (__) {}
    }
  }
}

export async function hapticSuccess(): Promise<void> {
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (_) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([15, 40, 25]);
      } catch (__) {}
    }
  }
}
