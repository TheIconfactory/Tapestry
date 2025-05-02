
// org.joinmastodon

if (require('mastodon-shared.js') === false) {
	throw new Error("Failed to load mastodon-shared.js");
}

function verify() {
	sendRequest(site + "/api/v1/accounts/verify_credentials")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const instance = site.split("/")[2] ?? "";
		const displayName = "@" + jsonObject["username"] + "@" + instance;
		const icon = jsonObject["avatar"];

		const userId = jsonObject["id"];
		setItem("userId", userId);
		
		const verification = {
			displayName: displayName,
			icon: icon
		};
		processVerification(verification);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

var userId = getItem("userId");

// NOTE: This reference counter tracks loading so we can let the app know when all async loading work is complete.
var loadCounter = 0;

function load() {
	// NOTE: The home timeline will be filled up to the endDate, if possible.
	let endDate = null;
	let endDateTimestamp = getItem("endDateTimestamp");
	if (endDateTimestamp != null) {
		endDate = new Date(parseInt(endDateTimestamp));
	}
	
	loadCounter = 0;
	if (includeHome == "on") {
		loadCounter += 1;
	}
	if (includeMentions == "on") {
		loadCounter += 1;
	}
	if (includeStatuses == "on") {
		loadCounter += 1;
	}
	if (loadCounter == 0) {
		processResults([]);
		return;
	}
				
	if (includeHome == "on") {
		let startTimestamp = (new Date()).getTime();

		queryHomeTimeline(endDate)
  		.then((parameters) =>  {
  			results = parameters[0];
  			newestItemDate = parameters[1];
  			loadCounter -= 1;
			processResults(results, loadCounter == 0);
			setItem("endDateTimestamp", String(newestItemDate.getTime()));
			let endTimestamp = (new Date()).getTime();
 			console.log(`finished home timeline, loadCounter = ${loadCounter}: ${results.length} items in ${(endTimestamp - startTimestamp) / 1000} seconds`);
		})
		.catch((requestError) => {
  			loadCounter -= 1;
  			console.log(`error home timeline, loadCounter = ${loadCounter}`);
			processError(requestError);
		});	
	}
	
	if (includeMentions == "on") {
		queryMentions()
		.then((results) =>  {
			loadCounter -= 1;
			console.log(`finished mentions, loadCounter = ${loadCounter}`);
			processResults(results, loadCounter == 0);
		})
		.catch((requestError) => {
			loadCounter -= 1;
			console.log(`error mentions, loadCounter = ${loadCounter}`);
			processError(requestError);
		});	
	}

	if (includeStatuses == "on") {
		if (userId != null) {
			queryStatusesForUser(userId)
			.then((results) =>  {
				loadCounter -= 1;
  				console.log(`finished (cached) user statuses, loadCounter = ${loadCounter}`);
				processResults(results, loadCounter == 0);
			})
			.catch((requestError) => {
  				loadCounter -= 1;
  				console.log(`error (cached) user statuses, loadCounter = ${loadCounter}`);
				processError(requestError);
			});	
		}
		else {
			sendRequest(site + "/api/v1/accounts/verify_credentials")
			.then((text) => {
				const jsonObject = JSON.parse(text);
				
				userId = jsonObject["id"];
				setItem("userId", userId);

				queryStatusesForUser(userId)
				.then((results) =>  {
					loadCounter -= 1;
	  				console.log(`finished user statuses, loadCounter = ${loadCounter}`);
					processResults(results, loadCounter == 0);
				})
				.catch((requestError) => {
					loadCounter -= 1;
  					console.log(`error user statuses, loadCounter = ${loadCounter}`);
					processError(requestError);
				});	
			})
			.catch((requestError) => {
				processError(requestError);
			});
		}
	}
}

function performAction(actionId, actionValue, item) {
	let actions = item.actions;
	
	if (actionId == "favorite") {
		const url = `${site}/api/v1/statuses/${actionValue}/favourite`;
		sendRequest(url, "POST")
		.then((text) => {
			const jsonObject = JSON.parse(text);
			
			delete actions["favorite"];
			actions["unfavorite"] = actionValue;
			item.actions = actions;
			actionComplete(item, null);
		})
		.catch((requestError) => {
			actionComplete(null, requestError);
		});	
	}
	else if (actionId == "unfavorite") {
		const url = `${site}/api/v1/statuses/${actionValue}/unfavourite`;
		sendRequest(url, "POST")
		.then((text) => {
			delete actions["unfavorite"];
			actions["favorite"] = actionValue;
			item.actions = actions;
			actionComplete(item, null);
		})
		.catch((requestError) => {
			actionComplete(null, requestError);
		});	
	}
	else if (actionId == "boost") {
		const url = `${site}/api/v1/statuses/${actionValue}/reblog`;
		sendRequest(url, "POST")
		.then((text) => {
			delete actions["boost"];
			actions["unboost"] = actionValue;
			item.actions = actions;
			actionComplete(item, null);
		})
		.catch((requestError) => {
			actionComplete(null, requestError);
		});	
	}
	else if (actionId == "unboost") {
		const url = `${site}/api/v1/statuses/${actionValue}/unreblog`;
		sendRequest(url, "POST")
		.then((text) => {
			delete actions["unboost"];
			actions["boost"] = actionValue;
			item.actions = actions;
			actionComplete(item, null);
		})
		.catch((requestError) => {
			actionComplete(null, requestError);
		});	
	}
	else if (actionId == "bookmark") {
		const url = `${site}/api/v1/statuses/${actionValue}/bookmark`;
		sendRequest(url, "POST")
		.then((text) => {
			delete actions["bookmark"];
			actions["unbookmark"] = actionValue;
			item.actions = actions;
			actionComplete(item, null);
		})
		.catch((requestError) => {
			actionComplete(null, requestError);
		});	
	}
	else if (actionId == "unbookmark") {
		const url = `${site}/api/v1/statuses/${actionValue}/unbookmark`;
		sendRequest(url, "POST")
		.then((text) => {
			delete actions["unbookmark"];
			actions["bookmark"] = actionValue;
			item.actions = actions;
			actionComplete(item, null);
		})
		.catch((requestError) => {
			actionComplete(null, requestError);
		});	
	}
	else {
		let error = new Error(`actionId "${actionId}" not implemented`);
		actionComplete(null, error);
	}
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

	let actions = {};
	if (item?.favourited) {
		actions["unfavorite"] = item.id;
	}
	else {
		actions["favorite"] = item.id;
	}
	if (item?.reblogged) {
		actions["unboost"] = item.id;
	}
	else {
		actions["boost"] = item.id;
	}
	if (item?.bookmarked) {
		actions["unbookmark"] = item.id;
	}
	else {
		actions["bookmark"] = item.id;
	}
	post.actions = actions;

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

function queryHomeTimeline(endDate) {

	// NOTE: These constants are related to the feed limits within Tapestry - it doesn't store more than
	// 3,000 items or things older than 30 days.
	// In use, the Mastodon API returns a limited number of items (800-ish) over a shorter timespan.
	const maxInterval = 3 * 24 * 60 * 60 * 1000; // days in milliseconds (approximately)
	const maxItems = 800;

	let newestItemDate = null;
	let oldestItemDate = null;
	
	return new Promise((resolve, reject) => {

		// this function is called recursively to load & process batches of posts into a single list of results
		function requestToId(id, endDate, resolve, reject, results = []) {
			let url = null
			if (id == null) {
				url = `${site}/api/v1/timelines/home?limit=40`;
			}
			else {
				url = `${site}/api/v1/timelines/home?limit=40&since_id=1&max_id=${id}`;
			}
			
			console.log(`==== REQUEST id = ${id}`);
			
			sendRequest(url, "GET")
			.then((text) => {
				//console.log(text);
				let lastId = null;
				let lastDate = null;
				let endUpdate = false;
				const jsonObject = JSON.parse(text);
				for (const item of jsonObject) {
					const date = new Date(item["created_at"]);
					
					let annotation = null;
					let shortcodes = {};
					let postItem = item;
					if (item["reblog"] != null) {
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
							
						postItem = item["reblog"];
					}

					if (annotation == null) {
						let visibility = item["visibility"] ?? "public";
						if (visibility == "private") {
							annotation = Annotation.createWithText(`FOLLOWERS ONLY`);
						}
						else if (visibility == "direct") {
							annotation = Annotation.createWithText(`PRIVATE MENTION`);
						}
					}
					
					if (!endUpdate && date < endDate) {
						console.log(`>>>> END date = ${date}`);
						endUpdate = true;
					}
					if (date > newestItemDate) {
						console.log(`>>>> NEW date = ${date}`);
						newestItemDate = date;
					}
					if (date < oldestItemDate) {
						console.log(`>>>> OLD date = ${date}`);
						endUpdate = true;
					}
					
					const post = postForItem(postItem, true, date, shortcodes);
					if (annotation != null) {
						post.annotations = [annotation];
					}
						
					results.push(post);
		
					lastId = item["id"];
					lastDate = date;
				}

				if (results.length > maxItems) {
					console.log(`>>>> MAX`);
					endUpdate = true;
				}
				
				console.log(`>>>> BATCH results = ${results.length}, lastId = ${lastId}, endUpdate = ${endUpdate}`);
				console.log(`>>>>       last   = ${lastDate}`);
				console.log(`>>>>       newest = ${newestItemDate}`);
				
				// NOTE: endUpdate signifies a date or count threshold has been reached, lastId indicates the API returned no items.
				if (!endUpdate && lastId != null) {
					requestToId(lastId, endDate, resolve, reject, results);
				}
				else {
					resolve([results, newestItemDate]);
				}
			})
			.catch((error) => {
				reject(error);
			});	
		}

		console.log(`>>>> START endDate = ${endDate}`);
		
		let nowTimestamp = (new Date()).getTime();
		let pastTimestamp = (nowTimestamp - maxInterval);
		oldestItemDate = new Date(pastTimestamp);
		console.log(`>>>> OLD date = ${oldestItemDate}`);
			
		requestToId(null, endDate, resolve, reject);

	});
	
}

function queryMentions() {

	return new Promise((resolve, reject) => {
		sendRequest(site + "/api/v1/notifications?types%5B%5D=mention&limit=80", "GET")
		.then((text) => {
			const jsonObject = JSON.parse(text);
			let results = [];
			for (const item of jsonObject) {
				let postItem = item["status"];

				if (postItem == null) {
					// NOTE: Not sure why this happens, but sometimes a mention payload doesn't have a status. If that happens, we just skip it.
					continue;
				}
				
				let visibility = postItem["visibility"] ?? "public";

				let annotation = null;
				let shortcodes = {};
				
				if (visibility == "public" || visibility == "unlisted") {
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
	
				const post = postForItem(postItem, true, null, shortcodes);
				if (annotation != null) {
					post.annotations = [annotation];
				}
	
				results.push(post);
			}
			resolve(results);
		})
		.catch((error) => {
			reject(error);
		});
	});
	
}

function queryStatusesForUser(id) {

	return new Promise((resolve, reject) => {
		sendRequest(site + "/api/v1/accounts/" + id + "/statuses?limit=40", "GET")
		.then((text) => {
			const jsonObject = JSON.parse(text);
			let results = [];
			for (const item of jsonObject) {
				let annotation = null;
				
				let post = null;
				if (item.reblog != null) {
					const date = new Date(item["created_at"]);
					post = postForItem(item.reblog, true, date);
					annotation = Annotation.createWithText("Boosted by you");
					annotation.uri = item.account["url"];
				}
				else {
					post = postForItem(item, true);
				}

				if (annotation == null) {
					let visibility = item["visibility"] ?? "public";
					if (visibility == "private") {
						annotation = Annotation.createWithText(`FOLLOWERS ONLY`);
					}
					else if (visibility == "direct") {
						annotation = Annotation.createWithText(`PRIVATE MENTION`);
					}	
				}
				
				if (annotation != null) {
					post.annotations = [annotation];
				}

				results.push(post);
			}
			resolve(results);
		})
		.catch((error) => {
			reject(error);
		});
	});
	
}


