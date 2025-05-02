
// org.joinmastodon.list

if (require('mastodon-shared.js') === false) {
	throw new Error("Failed to load mastodon-shared.js");
}

function verify() {
	sendRequest(site + "/api/v1/accounts/verify_credentials")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const userName = "@" + jsonObject["username"];
		const icon = jsonObject["avatar"];

		const userId = jsonObject["id"];
		setItem("userId", userId);

		sendRequest(site + "/api/v1/lists")
		.then((text) => {
			const jsonObject = JSON.parse(text);
		
			const verifyList = normalizeList(list)
			let found = false;
			let displayName = userName;
			for (const listItem of jsonObject) {
				if (listItem.id == verifyList || listItem.title == verifyList) {
					setItem("listId", listItem.id);
					displayName = `${listItem.title} - ${userName}`;
					found = true;
				}
			}
			
			if (found) {
				const verification = {
					displayName: displayName,
					icon: icon
				};
				processVerification(verification);
			}
			else {
				processError(Error("Invalid List Identifier"));
			}
		})
		.catch((requestError) => {
			processError(requestError);
		});
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function load() {
	var listId = getItem("listId");

	if (listId != null) {
		queryStatusesForList(listId)
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
		sendRequest(site + "/api/v1/lists")
		.then((text) => {
			const jsonObject = JSON.parse(text);
		
			const loadList = normalizeList(list)
			let found = false;
			for (const listItem of jsonObject) {
				if (listItem.id == loadList || listItem.title == loadList) {
					setItem("listId", listItem.id);
					listId = listItem.id;
					found = true;
				}
			}
			
			if (found) {
				queryStatusesForList(listId)
				.then((results) =>  {
					console.log(`finished feed`);
					processResults(results, true);
				})
				.catch((requestError) => {
					console.log(`error feed`);
					processError(requestError);
				});	
			}
			else {
				processError(Error("Invalid List Identifier"));
			}
		})
		.catch((requestError) => {
			processError(requestError);
		});
	}
}

/*
function normalizeList(list) {
	return list.trim();
}
*/

function queryStatusesForList(listId) {

	return new Promise((resolve, reject) => {
		sendRequest(site + "/api/v1/timelines/list/" + listId + "?limit=40")
		.then((text) => {
			const jsonObject = JSON.parse(text);
			let results = [];
			for (const item of jsonObject) {
				let showItem = true;

				let post = null;
				let annotation = null;
				let shortcodes = {};

				if (item.reblog != null) {
					const account = item["account"];
					const displayName = account["display_name"];
					const userName = account["username"];
					const accountName = (displayName ? displayName : userName);
					annotation = Annotation.createWithText(`${accountName} Boosted`);
					annotation.uri = account["url"];
					annotation.icon = account["avatar"];

					const accountEmojis = account["emojis"];
					if (accountEmojis != null && accountEmojis.length > 0) {
						for (const emoji of accountEmojis) {
							shortcodes[emoji.shortcode] = emoji.static_url;
						}
					}
						
					post = postForItem(item.reblog, null, shortcodes);
/*
					//if (includeBoosts == "on") {
						post = postForItem(item.reblog);

						const accountName = (displayName ? displayName : userName);
						annotation = Annotation.createWithText(`${accountName} Boosted`);
						annotation.uri = account["url"];
						annotation.icon = account["avatar"];
						
						annotation = Annotation.createWithText("Boosted");
						annotation.uri = item.account["url"];
					//}
					*/
				}
				else if (item.in_reply_to_account_id != null) {
					let visibility = item["visibility"] ?? "public";
				
					if (visibility == "public" || visibility == "unlisted") {
						if (item.mentions != null && item.mentions.length > 0) {
							const mentions = item.mentions;
							const account = mentions[0];
							const userName = account["username"];
							let text = "Replying to @" + userName;
							if (mentions.length > 1) {
								text += " and others";
							}
							annotation = Annotation.createWithText(text);
							annotation.uri = account["url"];
		
							const accountEmojis = account["emojis"];
							if (accountEmojis != null && accountEmojis.length > 0) {
								for (const emoji of accountEmojis) {
									shortcodes[emoji.shortcode] = emoji.static_url;
								}
							}
						}
						else {
							const account = item.account;
							const userName = account["username"];
							let text = "Replying to self";
							annotation = Annotation.createWithText(text);
							annotation.uri = account["url"];
		
							const accountEmojis = account["emojis"];
							if (accountEmojis != null && accountEmojis.length > 0) {
								for (const emoji of accountEmojis) {
									shortcodes[emoji.shortcode] = emoji.static_url;
								}
							}
						}
					}
					else if (visibility == "private") {
						annotation = Annotation.createWithText(`FOLLOWERS ONLY`);
					}
					else if (visibility == "direct") {
						annotation = Annotation.createWithText(`PRIVATE MENTION`);
					}	
	
					post = postForItem(item, null, shortcodes);
/*
					//if (includeReplies == "on") {
						post = postForItem(item);

						annotation = Annotation.createWithText("Reply");
						annotation.uri = item.account["url"];
					//}
*/
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

/*
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

*/