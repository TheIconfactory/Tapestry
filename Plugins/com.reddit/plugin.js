
// com.reddit

function verify() {
	if (subreddit != null && subreddit.length > 0) {
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
	else {
		processError(Error("Invalid Subreddit"));
	}
}

function load() {
	sendRequest(`${site}/r/${subreddit}/hot.json?raw_json=1`, "GET")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		var results = [];
		
		for (const child of jsonObject.data.children) {
			const item = child.data;
			
			const author = item["author"];
			const avatar = "https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-180x180.png";
			const creatorUri = "https://www.reddit.com/user/" + author;
			var creator = Creator.createWithUriName(creatorUri, author)
			creator.avatar = avatar

			const date = new Date(item["created_utc"] * 1000);
			const uri = "https://www.reddit.com" + encodeURI(item["permalink"]);
			let content = `<p><strong>${item["title"]}</strong> <a href="${item["url"]}">Link</a></p>`;

			if (item["selftext_html"] != null) {
				let rawContent = item["selftext_html"];
				// convert relative links to absolute links
				let processedContent = rawContent.replace(/href=\"\/r\//g, "href=\"https://www.reddit.com/r/");
				content = content + processedContent;
			}
			
			var attachments = null;
			if (item["preview"] != null)  {
				const images = item["preview"].images;
				if (images.length > 0) {
					attachments = [];
					for (const image of images) {
						let selectedUrl = image.source.url;
						for (const resolution of image.resolutions) {
							if (resolution.width > 900) {
								selectedUrl = resolution.url;
								break;
							}
						}
						const attachment = Attachment.createWithMedia(selectedUrl);
						attachments.push(attachment);
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
						const image = metadata.s.u;
						// TODO: Use the metadata.p.u URL as a thumbnail.
						if (image != null && attachments.length < 4) {
							const attachment = Attachment.createWithMedia(image);
							attachments.push(attachment);
						}
					}
					else {
						// NOTE: This might be an appropriate fallback: "https://i.redd.it/" + galleryItem["media_id"] + ".jpg";
					}
				}
			}
			else {
				const image = item["url"];
				if (image != null) {
					if (image.endsWith(".jpg") || image.endsWith(".jpeg")) {
						const attachment = Attachment.createWithMedia(image);
						attachments = [attachment];
					}
					else {
						const thumbnail = item["thumbnail"];
						if (thumbnail != null && (thumbnail.endsWith(".jpg") || thumbnail.endsWith(".jpeg"))) {
							const attachment = Attachment.createWithMedia(thumbnail);
							attachments = [attachment];
						}
					}
				}
			}

			if (item["secure_media"] != null) {
//				if (item["secure_media"].reddit_video != null && item["secure_media"].reddit_video.fallback_url != null) {
//					let videoUrl = item["secure_media"].reddit_video.fallback_url;
				if (item["secure_media"].reddit_video != null && item["secure_media"].reddit_video.hls_url != null) {
					let videoUrl = item["secure_media"].reddit_video.hls_url;
					let posterUrl = item.thumbnail;
					if (attachments.length > 0) {
						posterUrl = attachments[0].media;
					}
					
					const attachment = Attachment.createWithMedia(videoUrl);
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
			
			const post = Post.createWithUriDateContent(uri, date, content);
			post.creator = creator;
			post.attachments = attachments;
			
			results.push(post);			
		}
		
		processResults(results, true);
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}
