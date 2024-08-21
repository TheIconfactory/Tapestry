
// com.reddit

function verify() {
	sendRequest(`${site}/r/${subreddit}/hot.json?raw_json=1`, "HEAD")
	.then((dictionary) => {
		const jsonObject = JSON.parse(dictionary);
		
		if (jsonObject.status == 200) {
			const verification = {
				displayName: "/r/" + subreddit,
				icon: "https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-180x180.png"
			};	
			processVerification(verification);
		}
		else {
			processError(Error("Invalid Subreddit"));
		}
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function load() {
	sendRequest(`${site}/r/${subreddit}/hot.json?raw_json=1`, "GET")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		var results = [];
		
		for (const child of jsonObject.data.children) {
			let item = child.data;
			let resultItem = null;
			if (item["crosspost_parent_list"] != null && item["crosspost_parent_list"][0] != null) {
				resultItem = itemForData(item["crosspost_parent_list"][0]);
			}
			else {
				resultItem = itemForData(item);
			}
			
			if (resultItem != null) {	
				results.push(resultItem);
			}
		}
		
		processResults(results, true);
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}

function itemForData(item) {
	const author = item["author"];
	var identity = Identity.createWithName(author);
	identity.url = "https://www.reddit.com/user/" + author;
	identity.avatar = "https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-180x180.png";

	const date = new Date(item["created_utc"] * 1000);
	const uri = "https://www.reddit.com" + encodeURI(item["permalink"]);
	let title = item["title"];
	let content = "";

	if (item["selftext_html"] != null) {
		let rawContent = item["selftext_html"];
		// convert relative links to absolute links
		let processedContent = rawContent.replace(/href=\"\/r\//g, "href=\"https://www.reddit.com/r/");
		content = content + processedContent;
	}
	
	// TODO: Handle "crosspost_parent_list"

	var attachments = null;
	if (item["preview"] != null)  {
		const images = item["preview"].images;
		if (images.length > 0) {
			attachments = [];
			for (const image of images) {
				let url = image.source.url;
				let width = image.source.width;
				let height = image.source.height;
// 						let thumbnailUrl = null;
// 						for (const resolution of image.resolutions) {
// 							if (resolution.width > 300) {
// 								thumbnailUrl = resolution.url;
// 								break;
// 							}
// 						}
				if (url != null) {
					const attachment = MediaAttachment.createWithUrl(url);
					attachment.mimeType = "image";
					if (width != null && height != null) {
						attachment.aspectSize = { width: width, height: height };
					}
					attachments.push(attachment);
				}
			}
		}
	}
	else if (item["gallery_data"] != null) {
		attachments = [];
		const galleryItems = item["gallery_data"].items;
		for (const galleryItem of galleryItems) {
			const mediaId = galleryItem["media_id"];
			const mediaMetadata = item["media_metadata"];
			if (mediaMetadata != null) {
				const metadata = mediaMetadata[mediaId];
				if (metadata.status == "valid") {
					let width = null;
					if (metadata.s.x != null) {
						width = metadata.s.x;
					}
					let height = null;
					if (metadata.s.y != null) {
						height = metadata.s.y;
					}
					let mimeType = null;
					if (metadata.m != null) {
						mimeType = metadata.m;
					}
					const image = metadata.s.u;
					// TODO: Use the metadata.p.u URL as a thumbnail.
					// TODO: Use s.x and s.y to create aspect ratio
					if (image != null) {
						const attachment = MediaAttachment.createWithUrl(image);
						if (width != null && height != null) {
							attachment.aspectSize = { width: width, height: height };
						}
						if (mimeType != null) {
							attachment.mimeType = mimeType;
						}
						else {
							attachment.mimeType = "image";
						}
						attachments.push(attachment);
					}
					
				}
			}
			else {
				// NOTE: This might be an appropriate fallback: "https://i.redd.it/" + galleryItem["media_id"] + ".jpg";
			}
		}
	}
	else if (item["media_metadata"] != null) {
		attachments = [];
		const mediaMetadata = item["media_metadata"];
		for (let key in mediaMetadata) {
			const metadata = mediaMetadata[key];
			if (metadata.status == "valid") {
				let width = null;
				if (metadata.s.x != null) {
					width = metadata.s.x;
				}
				let height = null;
				if (metadata.s.y != null) {
					height = metadata.s.y;
				}
				let mimeType = null;
				if (metadata.m != null) {
					mimeType = metadata.m;
				}
				const image = metadata.s.u;
				// TODO: Use the metadata.p.u URL as a thumbnail.
				// TODO: Use s.x and s.y to create aspect ratio
				if (image != null) {
					const attachment = MediaAttachment.createWithUrl(image);
					if (width != null && height != null) {
						attachment.aspectSize = { width: width, height: height };
					}
					if (mimeType != null) {
						attachment.mimeType = mimeType;
					}
					else {
						attachment.mimeType = "image";
					}
					attachments.push(attachment);
				}			
			}
		}
	}
	else {
		const image = item["url"];
		if (image != null) {
			if (image.endsWith(".jpg") || image.endsWith(".jpeg")) {
				const attachment = MediaAttachment.createWithUrl(image);
				attachment.mimeType = "image/jpeg";
				attachments = [attachment];
			}
			else {
				const thumbnail = item["thumbnail"];
				if (thumbnail != null && (thumbnail.endsWith(".jpg") || thumbnail.endsWith(".jpeg"))) {
					const attachment = MediaAttachment.createWithUrl(thumbnail);
					attachment.mimeType = "image/jpeg";
					attachments = [attachment];
				}
			}
		}
	}

	if (item["secure_media"] != null) {
//		if (item["secure_media"].reddit_video != null && item["secure_media"].reddit_video.fallback_url != null) {
//			let videoUrl = item["secure_media"].reddit_video.fallback_url;
		if (item["secure_media"].reddit_video != null && item["secure_media"].reddit_video.hls_url != null) {
			let videoUrl = item["secure_media"].reddit_video.hls_url;
			let posterUrl = item.thumbnail;
			if (attachments.length > 0) {
				posterUrl = attachments[0].media;
			}
			
			const attachment = MediaAttachment.createWithUrl(videoUrl);
			attachment.thumbnail = posterUrl;
			attachment.mimeType = "video/mp4";
			
			// replace first attachment with video and poster image
			if (attachments.length > 0) {
				attachments[0] = attachment;
			}
			else {
				attachments.push(attachment);
			}
		}
		else if (item["secure_media_embed"].content != null) {
			content = content + `<p>${item["secure_media_embed"].content}</p>`;
		}
	}
	
	const resultItem = Item.createWithUriDate(uri, date);
	resultItem.title = title;
	resultItem.body = content;
	resultItem.author = identity;
	resultItem.attachments = attachments;

	return resultItem;
}

