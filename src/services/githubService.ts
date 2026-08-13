import { CoreInfo, GitHubRelease, CoreType } from '../types/vpn';

export class GitHubCoreService {
  private static REPOS: Record<Exclude<CoreType, 'auto'>, { name: string; repo: string; binaryName: string }> = {
    xray: {
      name: 'Xray-core',
      repo: 'XTLS/Xray-core',
      binaryName: 'xray.exe',
    },
    singbox: {
      name: 'Sing-box',
      repo: 'SagerNet/sing-box',
      binaryName: 'sing-box.exe',
    },
    hysteria: {
      name: 'Hysteria 2',
      repo: 'apernet/hysteria',
      binaryName: 'hysteria.exe',
    },
  };

  /**
   * Fetch list of releases for a specific core repository (both stable and pre-releases)
   */
  static async fetchReleases(
    coreType: Exclude<CoreType, 'auto'>,
    includePrereleases: boolean = true
  ): Promise<GitHubRelease[]> {
    const info = this.REPOS[coreType];
    const url = `https://api.github.com/repos/${info.repo}/releases?per_page=15`;

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}`);
      }

      const releases: GitHubRelease[] = await response.json();

      if (!includePrereleases) {
        return releases.filter(r => !r.prerelease);
      }

      return releases;
    } catch (err) {
      console.error(`Failed to fetch releases for ${coreType}:`, err);
      // Fallback mock releases if offline or rate limited
      return this.getFallbackReleases(coreType);
    }
  }

  /**
   * Get initial core info for all supported cores
   */
  static getCoresList(): CoreInfo[] {
    return [
      {
        type: 'singbox',
        name: 'Sing-box Core',
        installedVersion: 'v1.10.1',
        latestVersion: 'v1.10.1',
        latestPrerelease: 'v1.11.0-alpha.2',
        repo: 'SagerNet/sing-box',
        binaryName: 'sing-box.exe',
      },
      {
        type: 'xray',
        name: 'Xray-core',
        installedVersion: 'v1.8.24',
        latestVersion: 'v1.8.24',
        latestPrerelease: 'v24.9.31',
        repo: 'XTLS/Xray-core',
        binaryName: 'xray.exe',
      },
      {
        type: 'hysteria',
        name: 'Hysteria 2 Core',
        installedVersion: 'v2.5.2',
        latestVersion: 'v2.5.2',
        latestPrerelease: 'v2.6.0-rc.1',
        repo: 'apernet/hysteria',
        binaryName: 'hysteria.exe',
      },
    ];
  }

  /**
   * Find matching 64-bit Windows asset inside a GitHub release
   */
  static findWindowsAsset(release: GitHubRelease, coreType: Exclude<CoreType, 'auto'>): string | null {
    const assets = release.assets || [];
    
    if (coreType === 'xray') {
      // Xray releases: Xray-windows-64.zip
      const match = assets.find(a => 
        a.name.toLowerCase().includes('windows-64') || 
        a.name.toLowerCase().includes('windows-amd64') ||
        a.name.toLowerCase().includes('win64')
      );
      return match ? match.browser_download_url : null;
    }

    if (coreType === 'singbox') {
      // Sing-box releases: sing-box-1.x.x-windows-amd64.zip
      const match = assets.find(a => 
        a.name.toLowerCase().includes('windows-amd64') ||
        a.name.toLowerCase().includes('windows-64')
      );
      return match ? match.browser_download_url : null;
    }

    if (coreType === 'hysteria') {
      // Hysteria releases: hysteria-windows-amd64.exe or .zip
      const match = assets.find(a => 
        a.name.toLowerCase().includes('windows-amd64')
      );
      return match ? match.browser_download_url : null;
    }

    return null;
  }

  private static getFallbackReleases(coreType: Exclude<CoreType, 'auto'>): GitHubRelease[] {
    const repo = this.REPOS[coreType].repo;
    const stableTag = coreType === 'xray' ? 'v26.3.27' : coreType === 'singbox' ? 'v1.13.18' : 'v2.12.1';
    const stableUrl = coreType === 'singbox'
      ? 'https://github.com/SagerNet/sing-box/releases/download/v1.13.18/sing-box-1.13.18-windows-amd64.zip'
      : coreType === 'xray'
      ? 'https://github.com/XTLS/Xray-core/releases/download/v26.3.27/Xray-windows-64.zip'
      : 'https://github.com/apernet/hysteria/releases/download/app%2Fv2.12.1/hysteria-windows-amd64.exe';

    return [
      {
        id: 101,
        tag_name: stableTag,
        name: `${this.REPOS[coreType].name} Official Release`,
        prerelease: false,
        draft: false,
        published_at: new Date().toISOString(),
        body: 'Official stable release with performance & security updates.',
        html_url: `https://github.com/${repo}/releases`,
        assets: [
          {
            name: `${coreType}-windows-amd64.zip`,
            browser_download_url: stableUrl,
            size: 21000000,
            download_count: 4200,
          }
        ]
      }
    ];
  }
}
