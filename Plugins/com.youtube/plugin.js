
// com.youtube

const avatarRegex = /<link rel="image_src" href="([^"]*)">/;
const urlRegex = /(https?:[^\s]*)/g;
const defaultIcon = "https://www.youtube.com/s/desktop/905763c7/img/favicon_144x144.png";
const extraHeaders = {"user-agent": "WhatsApp/2"}; // avoid EU cookie nonsense

// ---------------------------------------------------------------------------
// URL resolution: accept any YouTube URL → RSS feed URL
// ---------------------------------------------------------------------------

// Normalizes any YouTube URL into a full https://www.youtube.com/... URL.
function normalizeYouTubeUrl(input) {
	let url = input.trim();

	// Already a feed URL — return as-is.
	if (url.includes("/feeds/videos.xml")) {
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		return url;
	}

	// Add scheme if missing.
	if (!url.startsWith("http")) {
		url = "https://" + url;
	}

	// m.youtube.com → www.youtube.com
	url = url.replace(/\/\/m\.youtube\.com/, "//www.youtube.com");

	// youtu.be/xxxxx → youtube.com/watch?v=xxxxx
	const shortMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
	if (shortMatch) {
		url = "https://www.youtube.com/watch?v=" + shortMatch[1];
	}

	return url;
}

// Resolves a normalized YouTube URL to a UCxxxxxx channel ID.
async function resolveChannelId(url) {
	// Fast path: /channel/UCxxxxxx — extract directly.
	const channelMatch = url.match(/\/channel\/(UC[A-Za-z0-9_-]+)/);
	if (channelMatch) {
		return channelMatch[1];
	}

	// Fast path: feed URL with channel_id param.
	const feedMatch = url.match(/channel_id=(UC[A-Za-z0-9_-]+)/);
	if (feedMatch) {
		return feedMatch[1];
	}

	// Slow path: fetch the page and look for the channel ID.
	const html = await sendRequest(url, "GET", null, extraHeaders);

	// Try RSS <link> tag first (most reliable for channel pages).
	const rssMatch = html.match(/channel_id=(UC[A-Za-z0-9_-]+)/);
	if (rssMatch) {
		return rssMatch[1];
	}

	// Try "channelId":"UCxxxxxx" in embedded JSON (works for video pages).
	const jsonMatch = html.match(/"channelId"\s*:\s*"(UC[A-Za-z0-9_-]+)"/);
	if (jsonMatch) {
		return jsonMatch[1];
	}

	// Try "externalChannelId":"UCxxxxxx" as a fallback.
	const extMatch = html.match(/"externalChannelId"\s*:\s*"(UC[A-Za-z0-9_-]+)"/);
	if (extMatch) {
		return extMatch[1];
	}

	throw new Error("Could not find a YouTube channel for this URL");
}

// Returns the RSS feed URL, using a setItem cache to avoid repeated resolution.
async function getFeedUrl() {
	const cached = getItem("feedUrl");
	if (cached != null && cached.length > 0) {
		return cached;
	}

	const url = normalizeYouTubeUrl(site);

	// If it's already a feed URL, cache and return.
	if (url.includes("/feeds/videos.xml")) {
		setItem("feedUrl", url);
		return url;
	}

	// Check for playlist URLs (not supported — they don't map to a channel feed).
	if (url.includes("/playlist?") || url.includes("&list=")) {
		throw new Error("Playlist URLs are not supported. Please use a channel URL or handle instead.");
	}

	const channelId = await resolveChannelId(url);
	const feedUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=" + channelId;
	setItem("feedUrl", feedUrl);
	return feedUrl;
}

async function verify() {
	const feedUrl = await getFeedUrl();
	const xml = await sendRequest(feedUrl);
	const jsonObject = await xmlParse(xml);

	if (jsonObject.feed == null) {
		if (jsonObject.rss != null) {
			processError(Error("Invalid feed format"));
		}
		else {
			processError(Error("Unknown feed format"));
		}
		return;
	}

	// Atom 1.0
	const feedAttributes = jsonObject.feed.link$attrs;
	let baseUrl = null;
	if (feedAttributes instanceof Array) {
		for (const feedAttribute of feedAttributes) {
			if (feedAttribute.rel == "alternate") {
				baseUrl = feedAttribute.href;
				break;
			}
		}
	}
	else {
		if (feedAttributes.rel == "alternate") {
			baseUrl = feedAttributes.href;
		}
	}
	const feedName = jsonObject.feed.title;

	sendRequest(baseUrl, "GET", null, extraHeaders)
	.then((html) => {
		const match = html.match(avatarRegex);
		const icon = match ? match[1] : defaultIcon;

		const verification = {
			displayName: feedName,
			icon: icon,
			baseUrl: baseUrl
		};
		processVerification(verification);
	})
	.catch((requestError) => {
		const verification = {
			displayName: feedName,
			icon: defaultIcon,
			baseUrl: baseUrl
		};
		processVerification(verification);
		processError(requestError);
	});
}


// Builds the list of feed URLs to fetch based on content type toggles.
// When all types are included (the default), uses the standard channel feed.
// Otherwise, fetches only the specific playlist feeds for the selected types.
function feedUrlsForContentTypes(feedUrl) {
	const wantVideos = includeVideos != "off";
	const wantShorts = includeShorts != "off";
	const wantLive = includeLiveStreams != "off";

	// If everything is on, use the standard feed URL as-is (single request, current behavior).
	if (wantVideos && wantShorts && wantLive) {
		return [feedUrl];
	}

	// Extract the channel ID suffix from the feed URL to build playlist URLs.
	// Standard feed URLs look like: .../videos.xml?channel_id=UCxxxxxx
	const match = feedUrl.match(/channel_id=UC([A-Za-z0-9_-]+)/);
	if (!match) {
		// Can't parse the channel ID — fall back to the standard feed.
		return [feedUrl];
	}
	const channelSuffix = match[1];
	const base = "https://www.youtube.com/feeds/videos.xml?playlist_id=";
	const urls = [];
	if (wantVideos) urls.push(base + "UULF" + channelSuffix);
	if (wantShorts) urls.push(base + "UUSH" + channelSuffix);
	if (wantLive) urls.push(base + "UULV" + channelSuffix);
	return urls;
}

// Parses entries from a YouTube Atom feed response.
function entriesFromFeed(jsonObject) {
	if (jsonObject.feed == null || jsonObject.feed.entry == null) {
		return [];
	}
	const entry = jsonObject.feed.entry;
	return entry instanceof Array ? entry : [entry];
}

async function load() {
	const feedUrl = await getFeedUrl();
	const urls = feedUrlsForContentTypes(feedUrl);

	// Fetch all needed feeds (often just one).
	let allEntries = [];
	for (const url of urls) {
		try {
			const xml = await sendRequest(url);
			const jsonObject = await xmlParse(xml);
			const entries = entriesFromFeed(jsonObject);
			allEntries = allEntries.concat(entries);
		}
		catch (e) {
			// A playlist feed 404s if the channel has no content of that type — that's fine, skip it.
			continue;
		}
	}

	// Sort all entries by date, newest first.
	allEntries.sort((a, b) => new Date(b.published) - new Date(a.published));

	var results = [];
	for (const entry of allEntries) {
		const entryAttributes = entry.link$attrs;
		let entryUrl = null;
		if (entryAttributes instanceof Array) {
			for (const entryAttribute of entryAttributes) {
				if (entryAttribute.rel == "alternate") {
					entryUrl = entryAttribute.href;
					break;
				}
			}
		}
		else {
			if (entryAttributes.rel == "alternate") {
				entryUrl = entryAttributes.href;
			}
		}

		const url = entryUrl;
		const date = new Date(entry.published); // could also be "entry.updated"

		const videoId = entry["yt:videoId"];
		const embed = `<iframe id="player" type="text/html" width="640" height="390" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`

		const linkUrl = `https://www.youtube.com/watch?v=${videoId}`;
		const linkAttachment = LinkAttachment.createWithUrl(linkUrl);

		const mediaGroup = entry["media:group"];

		const title = mediaGroup["media:title"];
		let description = null;
		if (includeDescription == "on") {
			if (mediaGroup["media:description"] != null) {
				// NOTE: YouTube shorts do not have a description.
				let rawDescription = mediaGroup["media:description"];
				let linkedDescription = rawDescription.replace(urlRegex, "<a href=\"$1\">$1</a>");
				let paragraphs = linkedDescription.split("\n\n");
				description = paragraphs.map((paragraph) => {
					let lines = paragraph.split("\n");
					let breakLines = lines.join("<br/>");
					return `<p>${breakLines}</p>`
				}).join("\n")
			}
		}
		const resultItem = Item.createWithUriDate(url, date);
		resultItem.title = title;
		if (description != null) {
			resultItem.body = embed + description;
		}
		else {
			resultItem.body = embed;
		}
		resultItem.attachments = [linkAttachment];

		results.push(resultItem);
	}

	processResults(results);
}
