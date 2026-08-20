package services

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type releaseCacheEntry struct {
	data      []map[string]any
	expiresAt time.Time
}

var (
	releaseCache   = make(map[string]releaseCacheEntry)
	releaseCacheMu sync.Mutex
)

type atomFeed struct {
	XMLName xml.Name    `xml:"feed"`
	Entries []atomEntry `xml:"entry"`
}

type atomEntry struct {
	ID      string `xml:"id"`
	Updated string `xml:"updated"`
	Title   string `xml:"title"`
	Link    struct {
		Href string `xml:"href,attr"`
	} `xml:"link"`
}

// FetchGitHubReleases fetches authentic live releases from GitHub via Atom feed (bypassing GitHub API rate limits).
func (d *Downloader) FetchGitHubReleases(repo string, includePrerelease bool) ([]map[string]any, error) {
	cacheKey := fmt.Sprintf("%s:%v", repo, includePrerelease)

	releaseCacheMu.Lock()
	if entry, ok := releaseCache[cacheKey]; ok && time.Now().Before(entry.expiresAt) {
		releaseCacheMu.Unlock()
		return entry.data, nil
	}
	releaseCacheMu.Unlock()

	atomURL := fmt.Sprintf("https://github.com/%s/releases.atom", repo)
	req, err := http.NewRequest("GET", atomURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error fetching GitHub feed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub returned status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var feed atomFeed
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil, fmt.Errorf("error parsing releases: %w", err)
	}

	repoLower := strings.ToLower(repo)
	var results []map[string]any

	for _, entry := range feed.Entries {
		parts := strings.Split(entry.Link.Href, "/tag/")
		tag := entry.Title
		if len(parts) > 1 {
			tag = parts[1]
			if unescaped, err := url.PathUnescape(tag); err == nil {
				tag = unescaped
			}
		}

		// For Hysteria, only process executable app releases (skip core/ and extras/ libraries)
		if strings.Contains(repoLower, "hysteria") && !strings.HasPrefix(tag, "app/") {
			continue
		}

		tagLower := strings.ToLower(tag)
		isPrerelease := strings.Contains(tagLower, "alpha") ||
			strings.Contains(tagLower, "beta") ||
			strings.Contains(tagLower, "rc") ||
			strings.Contains(tagLower, "pre")

		if !includePrerelease && isPrerelease {
			continue
		}

		downloadURL := buildAssetURL(repo, tag)
		displayName := tag
		if strings.Contains(repoLower, "hysteria") {
			displayName = strings.TrimPrefix(tag, "app/")
		}

		results = append(results, map[string]any{
			"version":       displayName,
			"tag":           tag,
			"name":          entry.Title,
			"is_prerelease": isPrerelease,
			"download_url":  downloadURL,
		})
	}

	releaseCacheMu.Lock()
	releaseCache[cacheKey] = releaseCacheEntry{
		data:      results,
		expiresAt: time.Now().Add(5 * time.Minute),
	}
	releaseCacheMu.Unlock()

	return results, nil
}

func buildAssetURL(repo, tag string) string {
	repoLower := strings.ToLower(repo)
	cleanVer := strings.TrimPrefix(tag, "v")

	if strings.Contains(repoLower, "sing-box") {
		return fmt.Sprintf("https://github.com/SagerNet/sing-box/releases/download/%s/sing-box-%s-windows-amd64.zip", tag, cleanVer)
	}
	if strings.Contains(repoLower, "xray") {
		return fmt.Sprintf("https://github.com/XTLS/Xray-core/releases/download/%s/Xray-windows-64.zip", tag)
	}
	if strings.Contains(repoLower, "hysteria") {
		escapedTag := strings.ReplaceAll(tag, "/", "%2F")
		return fmt.Sprintf("https://github.com/apernet/hysteria/releases/download/%s/hysteria-windows-amd64.exe", escapedTag)
	}
	if strings.Contains(repoLower, "sentinel") {
		return fmt.Sprintf("https://github.com/%s/releases/download/%s/sentinel-core-windows-amd64.dll", repo, tag)
	}
	return ""
}
