
// com.youtube

const avatarRegex = /<link rel="image_src" href="([^"]*)">/;
const urlRegex = /(https?:[^\s]*)/g;

function verify() {
	sendRequest(site)
	.then((xml) => {	
		const jsonObject = xmlParse(xml);
		
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
			const feedName = jsonObject.feed.title;
			
			sendRequest(baseUrl)
			.then((html) => {
				const match = html.match(avatarRegex);
				const icon = match[1];

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
					icon: "https://www.youtube.com/s/desktop/905763c7/img/favicon_144x144.png",
					baseUrl: baseUrl
				};
				processVerification(verification);
				processError(requestError);
			});	
		}
		else if (jsonObject.rss != null) {
			// RSS 2.0
			processError(Error("Invalid feed format"));
		}
		else {
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
			else {
				if (feedAttributes.rel == "alternate") {
					feedUrl = feedAttributes.href;
				}
			}
			const feedName = jsonObject.feed.title;
			
// 			sendRequest(feedUrl)
// 			.then((html) => {
// 				const match = html.match(avatarRegex);
// 				const avatar = match[1];
// 
// 				var identity = Identity.createWithName(feedName);
// 				identity.uri = feedUrl;
// 				identity.avatar = avatar;
			
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
					}
					else {
						if (entryAttributes.rel == "alternate") {
							entryUrl = entryAttributes.href;
						}
					}

					const url = entryUrl;
					const date = new Date(entry.published); // could also be "entry.updated"
				
					// TODO: Use "media:content" to do content embed.
					// <media:content url="https://www.youtube.com/v/TstuOX6NldA?version=3" type="application/x-shockwave-flash" width="640" height="390"/>
					
					const mediaGroup = entry["media:group"];
				
					const thumbnail = mediaGroup["media:thumbnail$attrs"].url;
					const attachment = Attachment.createWithMedia(thumbnail);

					const title = mediaGroup["media:title"];
					let description = null;
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
					const resultItem = Item.createWithUriDate(url, date);
					resultItem.title = title;
					if (description != null) {
						resultItem.body = description;
					}
//					resultItem.author = identity;
					resultItem.attachments = [attachment];
				
					results.push(resultItem);
				}

				processResults(results);
// 			})
// 			.catch((requestError) => {
// 				processError(requestError);
// 			});	
		}
		else if (jsonObject.rss != null) {
			// RSS 2.0
			processError(Error("Invalid feed format"));
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
