
// xml.feed

function verify() {
	sendRequest(site)
	.then((xml) => {	
		let jsonObject = xmlParse(xml);
		
		if (jsonObject.feed != null) {
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
			const displayName = jsonObject.feed.title;
			let icon = null;
			if (jsonObject.feed.icon != null) {
				icon = jsonObject.feed.icon;
				const verification = {
					displayName: displayName,
					icon: icon,
					baseUrl: baseUrl
				};
				processVerification(verification);
			}
			if (baseUrl != null && icon === null) {
				let siteUrl = baseUrl.split("/").splice(0,3).join("/");
				lookupIcon(siteUrl).then((icon) => {
					const verification = {
						displayName: displayName,
						icon: icon,
						baseUrl: baseUrl
					};
					processVerification(verification);
				});
			}
			else {
				// try to get icon from the feed
				let feedUrl = null;
				if (feedAttributes instanceof Array) {
					for (const feedAttribute of feedAttributes) {
						if (feedAttribute.rel == "self") {
							feedUrl = feedAttribute.href;
							break;
						}
					}
				}
				else {
					if (feedAttributes.rel == "self") {
						feedUrl = feedAttributes.href;
					}
				}
				if (feedUrl != null) {
					let siteUrl = feedUrl.split("/").splice(0,3).join("/");
					lookupIcon(siteUrl).then((icon) => {
						const verification = {
							displayName: displayName,
							icon: icon,
							baseUrl: baseUrl
						};
						processVerification(verification);
					});
				}
				else {
					const verification = {
						displayName: displayName,
						icon: null,
						baseUrl: baseUrl
					};
					processVerification(verification);
				}
			}
			
		}
		else if (jsonObject.rss != null) {
			// RSS 2.0
			const baseUrl = jsonObject.rss.channel.link;
			const displayName = jsonObject.rss.channel.title;

// NOTE: In theory, the channel image could be used to get an icon for the feed. But some
// use non-square images that look bad when squished. For example, the New York Times feed
// uses a 240x40 image.
//			if (jsonObject.rss.channel.image != null) {
//				icon = jsonObject.rss.channel.image.url;
//				const verification = {
//					displayName: displayName,
//					icon: icon,
//					baseUrl: baseUrl
//				};
//				processVerification(verification);
//			}
			let feedUrl = baseUrl.split("/").splice(0,3).join("/");
			lookupIcon(feedUrl).then((icon) => {
				const verification = {
					displayName: displayName,
					icon: icon,
					baseUrl: baseUrl
				};
				processVerification(verification);
			});
		}
		else if (jsonObject["rdf:RDF"] != null) {
			// RSS 1.0
			const baseUrl = jsonObject["rdf:RDF"].channel.link;
			const displayName = jsonObject["rdf:RDF"].channel.title;

// NOTE: In theory, you can get the icon from the RDF channel. In practice, places like
// Slashdot haven't updated this image since the beginning of this century.
// 			if (jsonObject["rdf:RDF"].channel.image$attrs != null) {
// 				icon = jsonObject["rdf:RDF"].channel.image$attrs["rdf:resource"];
// 				const verification = {
// 					displayName: displayName,
// 					icon: icon,
// 					baseUrl: baseUrl
// 				};
// 				processVerification(verification);
// 			}
			let feedUrl = baseUrl.split("/").splice(0,3).join("/");
			lookupIcon(feedUrl).then((icon) => {
				const verification = {
					displayName: displayName,
					icon: icon,
					baseUrl: baseUrl
				};
				processVerification(verification);
			});
		}
		else {
			// Unknown
			processError(Error("Unknown feed format"));
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
					if (entryAttributes.rel == "alternate" || entryAttributes.rel == null) {
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
				const title = entry.title?.trim();
				const content = entry.content ?? entry.summary;
				
				var identity = null;
				const authorName = entry.author.name;
				if (authorName != null) {
					identity = Identity.createWithName(authorName);
					if (entry.author.uri != null) {
						identity.uri = entry.author.uri;
					}
				}

				const resultItem = Item.createWithUriDate(url, date);
				if (title != null) {
					resultItem.title = title;
				}
				if (content != null) {
					resultItem.body = content;
				}
				if (identity != null) {
					resultItem.author = identity;
				}
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
					.map(link => {
						const attachment = MediaAttachment.createWithUrl(link.href);
						attachment.text = link.title || link.text;
						attachment.mimeType = "image";
						return attachment;
					})
					if (attachments.length > 0) {
						resultItem.attachments = attachments;
					}
				}
				else {
					// extract any media from RSS: https://www.rssboard.org/media-rss
					if (entry["media:group"] != null) {
						const mediaGroup = entry["media:group"];

						const mediaAttributes = mediaGroup["media:thumbnail$attrs"];
						let attachment = attachmentForAttributes(mediaAttributes);
						if (attachment != null) {
							resultItem.attachments = [attachment];
						}
					}
					else if (entry["media:thumbnail$attrs"] != null) {
						const mediaAttributes = entry["media:thumbnail$attrs"];
						let attachment = attachmentForAttributes(mediaAttributes);
						if (attachment != null) {
							resultItem.attachments = [attachment];
						}
					}
					else if (entry["media:content$attrs"] != null) {
						const mediaAttributes = entry["media:content$attrs"];
						let attachment = attachmentForAttributes(mediaAttributes);
						if (attachment != null) {
							resultItem.attachments = [attachment];
						}
					}
				}

				results.push(resultItem);
			}

			processResults(results);
		}
		else if (jsonObject.rss != null) {
			// RSS 2.0
			const feedUrl = jsonObject.rss.channel.link;
			const feedName = jsonObject.rss.channel.title;

			const items = jsonObject.rss.channel.item;
			var results = [];
			for (const item of items) {
				const url = item.link;
				const date = new Date(item.pubDate);
				let title = item.title?.trim();
				let content = item["content:encoded"] ?? item.description;

				let identity = null;
				let authorName = item["dc:creator"];
				if (authorName != null) {
					if (authorName instanceof Array) {
						authorName = authorName.join(", ");
					}
					identity = Identity.createWithName(authorName);
					identity.uri = feedUrl;
				}
				
				const resultItem = Item.createWithUriDate(url, date);
				if (title != null) {
					resultItem.title = title;
				}
				if (content != null) {
					resultItem.body = content;
				}
				if (identity != null) {
					resultItem.author = identity;
				}
			
				let attachments = []
				
				// extract any media from RSS: https://www.rssboard.org/media-rss
				if (item["media:group"] != null) {
					const mediaGroup = item["media:group"];

					const mediaAttributes = mediaGroup["media:thumbnail$attrs"];
					let attachment = attachmentForAttributes(mediaAttributes);
					if (attachment != null) {
						attachments.push(attachment);
					}
				}
				else if (item["media:thumbnail$attrs"] != null) {
					const mediaAttributes = item["media:thumbnail$attrs"];
					let attachment = attachmentForAttributes(mediaAttributes);
					if (attachment != null) {
						attachments.push(attachment);
					}
				}
				else if (item["media:content$attrs"] != null) {
					const mediaAttributes = item["media:content$attrs"];
					let attachment = attachmentForAttributes(mediaAttributes);
					if (attachment != null) {
						attachments.push(attachment);
					}
				}
				else if (item["enclosure$attrs"] != null) {
					let enclosure = item["enclosure$attrs"];
					if (enclosure.url != null) {
						let attachment = MediaAttachment.createWithUrl(enclosure.url);
						attachments.push(attachment);
					}
				}
				
				// add link attachment for link that isn't on this site (e.g. a link blog)
				{
					let linkPrefix = url.split("/").splice(0,3).join("/");
					let feedPrefix = feedUrl.split("/").splice(0,3).join("/");
					if (linkPrefix != feedPrefix) {
						let attachment = LinkAttachment.createWithUrl(item["link"]);
						attachments.push(attachment);
					}
				}
				
				if (attachments.length > 0) {
					resultItem.attachments = attachments;
				}
				
				results.push(resultItem);
			}

			processResults(results);
		}
		else if (jsonObject["rdf:RDF"] != null) {
			// RSS 1.0
			const feedUrl = jsonObject["rdf:RDF"].channel.link;
			const feedName = jsonObject["rdf:RDF"].channel.title;

			const items = jsonObject["rdf:RDF"].item;
			var results = [];
			for (const item of items) {
				if (item["dc:date"] == null) {
					continue;
				}
				const url = item.link;
				const date = new Date(item["dc:date"]);
				let title = item.title?.trim();
				let content = item.description;

				let identity = null;
				let authorName = item["dc:creator"];
				if (authorName != null) {
					if (authorName instanceof Array) {
						authorName = authorName.join(", ");
					}
					identity = Identity.createWithName(authorName);
					identity.uri = feedUrl;
				}
				
				const resultItem = Item.createWithUriDate(url, date);
				if (title != null) {
					resultItem.title = title;
				}
				if (content != null) {
					resultItem.body = content;
				}
				if (identity != null) {
					resultItem.author = identity;
				}
					
				results.push(resultItem);
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

function attachmentForAttributes(mediaAttributes) {
	let attachment = null;
	if (mediaAttributes.url != null) {
		attachment = MediaAttachment.createWithUrl(mediaAttributes.url);
		if (mediaAttributes.width != null && mediaAttributes.height != null) {
			let width = mediaAttributes.width;
			let height = mediaAttributes.height;
			attachment.aspectSize = { width: width, height: height };
		}
		attachment.mimeType = "image";
	}
	return attachment;
}
