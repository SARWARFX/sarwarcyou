import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

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
 * Query GitHub Releases API for SARWARFX/sarwarcyou latest release and compare versions
 */
export async function checkAppUpdate(): Promise<UpdateCheckResult> {
  const current = await getCurrentAppVersion();
  const repo = 'SARWARFX/sarwarcyou';
  const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

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
}

/**
 * Trigger installation or download of the new APK
 */
export function installAppUpdate(apkUrl: string): void {
  if (Capacitor.isNativePlatform()) {
    // Open in Android system browser/DownloadManager to invoke native package installer
    window.open(apkUrl, '_system');
  } else {
    // Web browser direct download
    window.location.href = apkUrl;
  }
}
