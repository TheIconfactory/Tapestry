
// org.joinmastodon

function verify() {
	sendRequest(site + "/api/v1/accounts/verify_credentials")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const displayName = "@" + jsonObject["username"];
		const icon = jsonObject["avatar"];
		
		const verification = {
			displayName: displayName,
			icon: icon
		}
		processVerification(verification);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function postForItem(item, date = null) {
	const account = item["account"];
	const displayName = account["display_name"];
	const userName = account["username"];
	const accountName = (displayName ? displayName : userName);
	const identity = Identity.createWithName(accountName);
	identity.username = "@" + userName;
	identity.uri = account["url"];
	identity.avatar = account["avatar"];

	let postDate;
	if (date == null) {
		postDate = new Date(item["created_at"]);
	}
	else {
		postDate = date;
	}
	
	const uri = item["uri"];
	const content = item["content"];
	const post = Item.createWithUriDate(uri, postDate);
	post.body = content;
	post.author = identity;

	let attachments = [];
	const mediaAttachments = item["media_attachments"];
	if (mediaAttachments != null && mediaAttachments.length > 0) {
		for (const mediaAttachment of mediaAttachments) {
			const media = mediaAttachment["url"]
			const attachment = MediaAttachment.createWithUrl(media);
			attachment.thumbnail = mediaAttachment["preview_url"];
			attachment.text = mediaAttachment["description"];
			attachment.blurhash = mediaAttachment["blurhash"];
			if (mediaAttachment["meta"] != null) {
				const metadata = mediaAttachment["meta"];
				if (metadata["focus"] != null) {
					const focus = metadata["focus"];
					if (focus["x"] != null && focus["y"] != null) {
						attachment.focalPoint = {x : focus["x"], y: focus["y"]};
					}
				}
				if (metadata["original"] != null) {
					const original = metadata["original"];
					if (original["width"] != null && original["height"] != null) {
						attachment.aspectSize = {width : original["width"], height: original["height"]};
					}
				}
			}
			let mimeType = "application/octet-stream";
			const mediaType = mediaAttachment["type"];
			if (mediaType == "video" || mediaType == "gifv") {
				mimeType = "video/mp4";
			}
			else if (mediaType == "audio") {
				if (media.endsWith(".aac")) {
					mimeType = "audio/aac";
				}
				else if (media.endsWith(".mp3")) {
					mimeType = "audio/mpeg";
				}
				else {
					mimeType = "audio/*";
				}
			}
			else if (mediaType == "image") {
				if (media.endsWith(".png")) {
					mimeType = "image/png";
				}
				else if (media.endsWith(".jpg") || media.endsWith(".jpeg")) {
					mimeType = "image/jpeg";
				}
				else {
					mimeType = "image/*";
				}
			}
			attachment.mimeType = mimeType;
			attachments.push(attachment);
		}
	}
	const card = item["card"];
	if (card != null && card.url != null) {
		let attachment = LinkAttachment.createWithUrl(card.url);
		if (card.type != null && card.type.length > 0) {
			attachment.type = card.type;
		}
		if (card.title != null && card.title.length > 0) {
			attachment.title = card.title;
		}
		if (card.description != null && card.description.length > 0) {
			attachment.subtitle = card.description;
		}
		if (card.author_name != null && card.author_name.length > 0) {
			attachment.authorName = card.author_name;
		}
		if (card.author_url != null && card.author_url.length > 0) {
			attachment.authorProfile = card.author_url;
		}
		if (card.image != null && card.image.length > 0) {
			attachment.image = card.image;
		}
		if (card.blurhash != null && card.blurhash.length > 0) {
			attachment.blurhash = card.blurhash;
		}
		if (card.width != null && card.height != null) {
			attachment.aspectSize = {width : card.width, height: card.height};
		}
		attachments.push(attachment);
	}
	
	if (attachments.length > 0) {
		post.attachments = attachments;
	}
	
	return post;
}

function load() {
	if (includeHome == "on") {
		sendRequest(site + "/api/v1/timelines/home?limit=40", "GET")
		.then((text) => {
			//console.log(text);
			const jsonObject = JSON.parse(text);
			let results = [];
			for (const item of jsonObject) {
				const date = new Date(item["created_at"]);
				
				let annotation = null;
				let postItem = item;
				if (item["reblog"] != null) {
					const account = item["account"];
					const displayName = account["display_name"];
					const userName = account["username"];
					const accountName = (displayName ? displayName : userName);
					annotation = Annotation.createWithText(`${accountName} Boosted`);
					annotation.uri = account["url"];
					annotation.icon = account["avatar"];
					
					postItem = item["reblog"];
				}
				
				const post = postForItem(postItem, date);
				if (annotation != null) {
					post.annotations = [annotation];
				}
				
				results.push(post);
			}
			processResults(results, true);
		})
		.catch((requestError) => {
			processError(requestError);
		});	
	}
	
	if (includeMentions == "on") {
		sendRequest(site + "/api/v1/notifications?types%5B%5D=mention&limit=30", "GET")
		.then((text) => {
			const jsonObject = JSON.parse(text);
			let results = [];
			for (const item of jsonObject) {
				let postItem = item["status"];

				let annotation = null;
				if (postItem.mentions != null && postItem.mentions.length > 0) {
					const mentions = postItem.mentions;
					const account = mentions[0];
					const userName = account["username"];
					let text = "Replying to @" + userName;
					if (mentions.length > 1) {
						text += " and others";
					}
					annotation = Annotation.createWithText(text);
					annotation.uri = account["url"];
				}
	
				const post = postForItem(postItem);
				if (annotation != null) {
					post.annotations = [annotation];
				}
	
				results.push(post);
			}
			processResults(results, true);
		})
		.catch((requestError) => {
			processError(requestError);
		});
	}

	if (includeStatuses == "on") {
		// NOTE: There needs to be something like the Web Storage API where data (like the account id) can be persisted
		// across launches of the app. Having to verify the credentials each time to get information that doesn't change
		// doesn't make sense. This local storage may also be useful for timeline backfills (e.g. to track last ID returned).
		
		sendRequest(site + "/api/v1/accounts/verify_credentials")
		.then((text) => {
			const jsonObject = JSON.parse(text);
			
			const userId = jsonObject["id"];
	
			sendRequest(site + "/api/v1/accounts/" + userId + "/statuses?limit=30", "GET")
			.then((text) => {
				const jsonObject = JSON.parse(text);
				let results = [];
				for (const item of jsonObject) {
					let post = null;
					if (item.reblog != null) {
						post = postForItem(item.reblog);
						annotation = Annotation.createWithText("Boosted by you");
						annotation.uri = item.account["url"];
						post.annotations = [annotation];
					}
					else {
						post = postForItem(item);
					}
					
					results.push(post);
				}
				processResults(results, true);
			})
			.catch((requestError) => {
				processError(requestError);
			});
	
		})
		.catch((requestError) => {
			processError(requestError);
		});
	}
}

