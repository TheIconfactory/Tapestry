
// xml.feed

function identify() {
	sendRequest(site)
	.then((xml) => {	
		let jsonObject = xmlParse(xml);
		
		if (jsonObject.feed != null) {
			// Atom 1.0
			const feedAttributes = jsonObject.feed.link$attrs;
			let feedUrl = null;
			if (feedAttributes instanceof Array) {
				for (const feedAttribute of feedAttributes) {
					if (feedAttribute.rel == "alternate") {
						feedUrl = feedAttribute.href;
						break;
					}
				}
			}
			else {
				if (feedAttributes.rel == "alternate") {
					feedUrl = feedAttributes.href;
				}
			}
			const feedName = jsonObject.feed.title;

			const dictionary = {
				identifier: feedName,
				baseUrl: feedUrl
			};
			setIdentifier(dictionary);
		}
		else if (jsonObject.rss != null) {
			// RSS 2.0
			const feedUrl = jsonObject.rss.channel.link;
			const feedName = jsonObject.rss.channel.title;

			const dictionary = {
				identifier: feedName,
				baseUrl: feedUrl
			};
			setIdentifier(dictionary);
		}
		else {
			// Unknown
			setIdentifier(null);
		}
	})
	.catch((requestError) => {
		processError(requestError);
	});
}


function load() {	
	sendRequest(site)
	.then((xml) => {
		
		let jsonObject = xmlParse(xml);
				
		if (jsonObject.feed != null) {
			// Atom 1.0
			const feedAttributes = jsonObject.feed.link$attrs;
			let feedUrl = null;
			if (feedAttributes instanceof Array) {
				for (const feedAttribute of feedAttributes) {
					if (feedAttribute.rel == "alternate") {
						feedUrl = feedAttribute.href;
						break;
					}
				}
			}
			else if (feedAttributes.rel == "alternate") {
				feedUrl = feedAttributes.href;
			} else if (
				jsonObject.feed.id.startsWith("http://") ||
				jsonObject.feed.id.startsWith("https://")
			) {
				feedUrl = jsonObject.feed.id
			}
			const feedName = jsonObject.feed.title;
			var creator = Creator.createWithUriName(feedUrl, feedName)
			const feedAvatar = jsonObject.feed.icon;
			if (feedAvatar != null) {
				creator.avatar = feedAvatar;
			}
			else {
				let baseUrl = feedUrl.split("/").splice(0,3).join("/");
				creator.avatar = baseUrl + "/favicon.ico";
			}
		
			const entries = jsonObject.feed.entry;
			var results = [];
			for (const entry of entries) {
				const entryAttributes = entry.link$attrs;
				let entryUrl = null;
				if (entryAttributes instanceof Array) {
					for (const entryAttribute of entryAttributes) {
						if (entryAttribute.rel == "alternate") {
							entryUrl = entryAttribute.href;
							break;
						}
					}
					// Posts need to have a link and if we didn't find one
					// with rel == "alternate" then we'll use the first link.
					if (!entryUrl && entryAttributes.length > 0) {
						entryUrl = entryAttributes[0].href;
					}
				}
				else {
					if (entryAttributes.rel == "alternate") {
						entryUrl = entryAttributes.href;
					}
				}

				const url = entryUrl;
				let date = null;
				if (entry.published) {
					date =  new Date(entry.published);
				}
				else if (entry.updated) {
					date =  new Date(entry.updated);
				}
				const content = entry.content;
				const post = Post.createWithUriDateContent(url, date, content);
				post.creator = creator;
				if (entryAttributes instanceof Array) {
					const attachments = entryAttributes
					.filter(e => {
						if (e.type) {
							// Check for a MIME type that suggests this is an image, e.g. image/jpeg.
							return e.type.startsWith("image/");
						} else {
							return false;
						}
					})
					// Tapestry supports at most four images.
					.slice(0, 4)
					.map(link => {
						const attachment = Attachment.createWithMedia(link.href)
						attachment.text = link.title || link.text
						return attachment
					})
					if (attachments.length > 0) {
						post.attachments = attachments;
					}
				}
				results.push(post);
			}

			processResults(results);
		}
		else if (jsonObject.rss != null) {
			// RSS 2.0
			const feedUrl = jsonObject.rss.channel.link;
			const feedName = jsonObject.rss.channel.title;
			var creator = Creator.createWithUriName(feedUrl, feedName);
			var feedAvatar = null;
			if (jsonObject.rss.channel.image != null) {
				feedAvatar = jsonObject.rss.channel.image.url;
			}
			if (feedAvatar != null) {
				creator.avatar = feedAvatar;
			}
			else {
				let baseUrl = feedUrl.split("/").splice(0,3).join("/");
				creator.avatar = baseUrl + "/favicon.ico";
			}

			const items = jsonObject.rss.channel.item;
			var results = [];
			for (const item of items) {
				const url = item.link;
				const date = new Date(item.pubDate);
				let content = item["content:encoded"];
				if (content == null) {
					content = item.description;
				}
				const post = Post.createWithUriDateContent(url, date, content);
				post.creator = creator;
			
				results.push(post);
			}

			processResults(results);
		}
		else {
			// Unknown
			processResults([]);
		}
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}
