import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';

export interface AppInstallerPlugin {
  canRequestPackageInstalls(): Promise<{ value: boolean }>;
  openInstallSettings(): Promise<void>;
  downloadAndInstall(options: { url: string; fileName?: string }): Promise<{ success: boolean }>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (progress: { percent: number; bytesReceived: number; totalBytes: number }) => void
  ): Promise<any>;
  addListener(
    eventName: 'downloadComplete',
    listenerFunc: () => void
  ): Promise<any>;
  addListener(
    eventName: 'downloadFailed',
    listenerFunc: (err: { error: string }) => void
  ): Promise<any>;
  removeAllListeners(): Promise<void>;
}

export const AppInstaller = registerPlugin<AppInstallerPlugin>('AppInstaller');

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  apkUrl: string;
  releaseNotes: string;
  remoteBuildNumber: number;
  currentBuildNumber: number;
}

// Current fallback version matching repository release run number
export const FALLBACK_APP_VERSION = '1.0.18';
export const FALLBACK_BUILD_NUMBER = 18;

/**
 * Extract trailing numeric run/build number from tag (e.g. "v1.0.18" -> 18, "1.0.19" -> 19)
 */
export function extractBuildNumber(versionStr: string): number {
  if (!versionStr) return 0;
  const match = versionStr.match(/(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  const parts = versionStr.replace(/[^0-9.]/g, '').split('.');
  const last = parts[parts.length - 1];
  return last ? parseInt(last, 10) : 0;
}

/**
 * Dynamically retrieve current app version from Capacitor native environment or window/fallback
 */
export async function getCurrentAppVersion(): Promise<{ version: string; buildNumber: number }> {
  let version = (typeof window !== 'undefined' && (window as any).__APP_VERSION__) || FALLBACK_APP_VERSION;
  let buildNumber = extractBuildNumber(version) || FALLBACK_BUILD_NUMBER;

  if (Capacitor.isNativePlatform()) {
    try {
      const info = await App.getInfo();
      if (info.version) {
        version = info.version;
      }
      if (info.build) {
        const parsed = parseInt(info.build, 10);
        if (!isNaN(parsed) && parsed > 0) {
          buildNumber = parsed;
        } else {
          buildNumber = extractBuildNumber(version);
        }
      } else {
        buildNumber = extractBuildNumber(version);
      }
    } catch (err) {
      console.warn('[Updater] Could not retrieve native App.getInfo:', err);
    }
  }

  return { version, buildNumber };
}

/**
 * Query GitHub Releases API for SARWARFX/sarwarcyou latest release and compare versions.
 * Strictly restricted to native Android (Capacitor) platform.
 */
export async function checkAppUpdate(): Promise<UpdateCheckResult | null> {
  const current = await getCurrentAppVersion();
  const repo = 'SARWARFX/sarwarcyou';
  const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

  try {
    const res = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`GitHub Releases API responded with status ${res.status}`);
    }

  const data = await res.json();
  const tagName: string = data.tag_name || '';
  const latestVersion = tagName.startsWith('v') ? tagName : `v${tagName}`;
  const remoteBuildNumber = extractBuildNumber(tagName);

  // Locate release asset URL matching 'SARWARCYOU*.apk'
  let apkUrl = `https://github.com/${repo}/releases/download/${tagName}/SARWARCYOU.apk`;
  if (Array.isArray(data.assets) && data.assets.length > 0) {
    const sarwarAsset = data.assets.find((a: any) =>
      typeof a.name === 'string' && a.name.startsWith('SARWARCYOU') && a.name.endsWith('.apk')
    ) || data.assets.find((a: any) =>
      typeof a.name === 'string' && a.name.endsWith('.apk')
    );

    if (sarwarAsset) {
      apkUrl = sarwarAsset.browser_download_url || `https://github.com/${repo}/releases/download/${tagName}/${sarwarAsset.name}`;
    }
  }

  const hasUpdate = remoteBuildNumber > current.buildNumber;

  return {
    hasUpdate,
    currentVersion: current.version.startsWith('v') ? current.version : `v${current.version}`,
    latestVersion,
    apkUrl,
    releaseNotes: data.body || '',
    remoteBuildNumber,
    currentBuildNumber: current.buildNumber,
  };
  } catch (err) {
    console.warn('[Updater] Check failed:', err);
    return null;
  }
}

/**
 * Trigger in-app download and installation of the new APK (Native Android only)
 */
export async function installAppUpdate(apkUrl: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[Updater] Install bypassed: running on web browser.');
    return;
  }
  try {
    await AppInstaller.downloadAndInstall({ url: apkUrl });
  } catch (err) {
    console.warn('[Updater] AppInstaller native method failed, falling back to system browser:', err);
    window.open(apkUrl, '_system');
  }
}
