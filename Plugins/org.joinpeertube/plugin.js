// org.joinpeertube

// Helper function to parse the full channel URL (simplified manual parsing)
function getChannelInfo(fullUrl) {
	try {
		let protocolEnd = fullUrl.indexOf("://");
		if (protocolEnd === -1) return null; // No protocol found

		let hostAndPath = fullUrl.substring(protocolEnd + 3);
		let firstSlashAfterHost = hostAndPath.indexOf('/');
		
		let parsedHost = "";
		let path = "";

		if (firstSlashAfterHost === -1) {
			parsedHost = hostAndPath; // URL is like https://example.com (no path)
			path = "";
		} else {
			parsedHost = hostAndPath.substring(0, firstSlashAfterHost);
			path = hostAndPath.substring(firstSlashAfterHost); // Path includes leading slash
		}

		if (!parsedHost) return null;

		const instanceBaseUrl = fullUrl.substring(0, protocolEnd + 3 + parsedHost.length);
		
		// Clean path: remove leading/trailing slashes for consistent splitting
		const cleanedPath = path.replace(/^\/+|\/+$/g, '');
		const pathParts = cleanedPath.split('/');

		if (pathParts.length === 2 && (pathParts[0] === 'c' || pathParts[0] === 'a')) {
			const channelIdentifier = pathParts[1];
			if (channelIdentifier) {
				// Return instanceBaseUrl, the channelIdentifier, and the parsedHost
				return { instanceBaseUrl, channelIdentifier, host: parsedHost };
			}
		}
	} catch (e) {
		// console.warn("Manual parsing error: " + fullUrl + ", Error: " + e.message);
	}
	return null;
}

function identify() {
	const info = getChannelInfo(site);
	if (info) {
		setIdentifier(info.channelIdentifier);
	}
}

function load() {
	const info = getChannelInfo(site);
	if (!info || !info.host) { // Ensure info and info.host are available
		processError(new Error("Invalid PeerTube Channel URL format or could not parse host. Expected format: https://instance.com/c/channel_name"));
		return;
	}

	// Construct fully qualified channel name for the API query
	const fullyQualifiedChannelName = info.channelIdentifier + "@" + info.host;
	
	// Use the more specific endpoint for fetching videos for a channel
	sendRequest(info.instanceBaseUrl + "/api/v1/video-channels/" + fullyQualifiedChannelName + "/videos?perPage=20&page=1&sort=-publishedAt")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const videos = jsonObject["data"];
		var results = [];
		
		for (const video of videos) {
			const url = video.url;
			const title = video.name;
			const date = new Date(video.publishedAt);
			const content = video.description;
			
			const displayName = video.channel.displayName;
			const channelURL = video.channel.url;
			
			const creatorAvatar = video.channel.avatars[1].path;

			var item = Item.createWithUriDate(url, date);
			item.title = title;
			item.body = content;
			
			// Add preview image as an attachment using MediaAttachment API
			const previewImageUrl = info.instanceBaseUrl + video.previewPath;
			const attachment = MediaAttachment.createWithUrl(previewImageUrl);
			attachment.text = video.name; // Use video title for accessibility description
			item.attachments = [attachment];

			const identity = Identity.createWithName(displayName);
			identity.uri = channelURL;
			identity.avatar = creatorAvatar;

			item.author = identity;
			
			results.push(item);
		}
		
		processResults(results);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function verify() {
	const info = getChannelInfo(site);
	if (!info) {
		processError(new Error("Invalid PeerTube Channel URL format. Expected format: https://instance.com/c/channel_name"));
		return;
	}

	sendRequest(info.instanceBaseUrl + "/api/v1/video-channels/" + info.channelIdentifier)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		const channel = jsonObject;
		
		const verification = {
			displayName: channel.displayName,
			icon: "https://" + channel.host + channel.avatars[1].path,
			baseUrl: info.instanceBaseUrl // Set baseUrl to the parsed instance base
		};
		
		processVerification(verification);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}
