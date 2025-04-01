
// org.joinmastodon.account

function verify() {
	const verifyAccount = normalizeAccount(account);
	const url = `${site}/api/v1/accounts/lookup?acct=${verifyAccount}`
	sendRequest(url)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		let displayName = "";
		if (jsonObject.display_name != null && jsonObject.display_name.length > 0) {
			displayName = jsonObject.display_name;
		}
		else {
			displayName = "@" + jsonObject.username;
		}

		const id = jsonObject.id;
		setItem("id", id);
		
		if (jsonObject.avatar != null) {
			const icon = jsonObject.avatar
			const verification = {
				displayName: displayName,
				icon: icon
			};
			processVerification(verification);
		}
		else {
			processVerification(displayName);
		}
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function load() {
	var id = getItem("id");

	if (id != null) {
		queryStatusesForUser(id)
		.then((results) =>  {
			console.log(`finished (cached) feed`);
			processResults(results, true);
		})
		.catch((requestError) => {
			console.log(`error (cached) feed`);
			processError(requestError);
		});	
	}
	else {
		const loadAccount = normalizeAccount(account);
		const url = `${site}/api/v1/accounts/lookup?acct=${loadAccount}`
		sendRequest(url)
		.then((text) => {
			const jsonObject = JSON.parse(text);
		
			const id = jsonObject.id;
			setItem("id", id);
		
			queryStatusesForUser(id)
			.then((results) =>  {
				console.log(`finished feed`);
				processResults(results, true);
			})
			.catch((requestError) => {
				console.log(`error feed`);
				processError(requestError);
			});	
		})
		.catch((requestError) => {
			processError(requestError);
		});
	}
}

function normalizeAccount(account) {
	let result = account.trim();
	if (result.length > 1 && result.startsWith("@")) {
		result = result.slice(1);
	}
	return result;
}

function queryStatusesForUser(id) {

	return new Promise((resolve, reject) => {
		sendRequest(site + "/api/v1/accounts/" + id + "/statuses?limit=40")
		.then((text) => {
			const jsonObject = JSON.parse(text);
			let results = [];
			for (const item of jsonObject) {
				let showItem = true;

				let post = null;
				let annotation = null;

				if (item.reblog != null) {
					if (includeBoosts == "on") {
						post = postForItem(item.reblog);
						
						annotation = Annotation.createWithText("BOOSTED");
						annotation.uri = item.account["url"];
					}
				}
				else if (item.in_reply_to_account_id != null) {
					if (includeReplies == "on") {
						post = postForItem(item);

						annotation = Annotation.createWithText("REPLY");
						annotation.uri = item.account["url"];
					}
				}
				else {
					post = postForItem(item);
				}

				if (post != null) {
					if (annotation != null) {
						post.annotations = [annotation];
					}
	
					results.push(post);
				}
			}
			resolve(results);
		})
		.catch((error) => {
			reject(error);
		});
	});
	
}

function postForItem(item, date = null, shortcodes = {}) {
	const account = item["account"];
	const displayName = account["display_name"];
	const userName = account["username"];
	const accountName = (displayName ? displayName : userName);
	const fullAccountName = account["acct"];
	const identity = Identity.createWithName(accountName);
	identity.username = "@" + fullAccountName;
	identity.uri = account["url"];
	identity.avatar = account["avatar"];

	let content = item["content"];
	if (item["poll"] != null) {
		if (item["poll"].options != null) {
			let multiple = (item["poll"]?.multiple ?? false) ? "(Multiple Choice)" : "";
			content += "<p><ul>";
			for (const option of item["poll"].options) {
				content += `<li>${option.title}</li>`;
			}
			content += `</ul>${multiple}</p>`;
		}			
	}

	let contentWarning = null;
	const spoilerText = item["spoiler_text"];
	if (spoilerText != null && spoilerText.length > 0) {
		contentWarning = spoilerText;
	}
	
	let postDate;
	if (date == null) {
		postDate = new Date(item["created_at"]);
	}
	else {
		postDate = date;
	}
	
	const uri = item["url"];
	const post = Item.createWithUriDate(uri, postDate);

	post.author = identity;
	post.body = content;

	if (contentWarning != null) {
		post.contentWarning = contentWarning;
	}
	
	const itemEmojis = item["emojis"];
	if (itemEmojis != null && itemEmojis.length > 0) {
		for (const emoji of itemEmojis) {
			shortcodes[emoji.shortcode] = emoji.static_url;
		}
	}
	const accountEmojis = account["emojis"];
	if (accountEmojis != null && accountEmojis.length > 0) {
		for (const emoji of accountEmojis) {
			shortcodes[emoji.shortcode] = emoji.static_url;
		}
	}
	if (Object.keys(shortcodes).length > 0) {
		post.shortcodes = shortcodes;
		//console.log(JSON.stringify(shortcodes));
	}
	
	let attachments = [];
	const mediaAttachments = item["media_attachments"];
	if (mediaAttachments != null && mediaAttachments.length > 0) {
		for (const mediaAttachment of mediaAttachments) {
			const media = mediaAttachment["url"]
			const attachment = MediaAttachment.createWithUrl(media);
			if (mediaAttachment["preview_url"] != null) {
				attachment.thumbnail = mediaAttachment["preview_url"];
			}
			if (mediaAttachment["description"] != null) {
				attachment.text = mediaAttachment["description"];
			}
			if (mediaAttachment["blurhash"] != null) {
				attachment.blurhash = mediaAttachment["blurhash"];
			}
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
	else {
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
	}
	
	if (attachments.length > 0) {
		post.attachments = attachments;
	}
	
	return post;
}
