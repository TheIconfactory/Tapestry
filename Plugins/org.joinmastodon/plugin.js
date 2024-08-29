
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
		};
		processVerification(verification);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function postForItem(item, date = null, shortcodes = {}) {
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
	
	const uri = item["url"];
	const content = item["content"];
	const post = Item.createWithUriDate(uri, postDate);
	post.body = content;
	post.author = identity;

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

function queryHomeTimeline(doIncrementalLoad) {

	return new Promise((resolve, reject) => {

		// this function is called recursively to load & process batches of posts into a single list of results
		function requestToId(id, doIncrementalLoad, resolve, reject, limit = 5, results = []) {
			let url = null
			if (id == null) {
				url = `${site}/api/v1/timelines/home?limit=40`;
			}
			else {
				url = `${site}/api/v1/timelines/home?limit=40&since_id=1&max_id=${id}`;
			}
			
			console.log(`doIncrementalLoad = ${doIncrementalLoad}, id = ${id}`);
			
			sendRequest(url, "GET")
			.then((text) => {
				//console.log(text);
				let lastId = null;
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
						
					const post = postForItem(postItem, date, shortcodes);
					if (annotation != null) {
						post.annotations = [annotation];
					}
						
					results.push(post);
		
					lastId = item["id"];
				}
				
				const newLimit = limit - 1;
				
				if (lastId != null && newLimit > 0 && doIncrementalLoad == false) {
					requestToId(lastId, doIncrementalLoad, resolve, reject, newLimit, results);
				}
				else {
					resolve(results);
				}
			})
			.catch((error) => {
				reject(error);
			});	
		}

		requestToId(null, doIncrementalLoad, resolve, reject);

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

				let annotation = null;
				let shortcodes = {};
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
	
				const post = postForItem(postItem, null, shortcodes);
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
			resolve(results);
		})
		.catch((error) => {
			reject(error);
		});
	});
	
}

var doIncrementalLoad = false;

// NOTE: There needs to be something like the Web Storage API where data (like the account id) can be persisted
// across launches of the app. Having to verify the credentials each time to get information that doesn't change
// doesn't make sense.
var userId = null;

// NOTE: This reference counter tracks loading so we can let the app know when all async loading work is complete.
var loadCounter = 0;

function load() {
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
				
	if (includeHome == "on") {
		queryHomeTimeline(doIncrementalLoad)
  		.then((results) =>  {
  			loadCounter -= 1;
  			console.log(`finished home timeline, loadCounter = ${loadCounter}`);
			processResults(results, loadCounter == 0);
			doIncrementalLoad = true;
 		})
		.catch((requestError) => {
  			loadCounter -= 1;
  			console.log(`error home timeline, loadCounter = ${loadCounter}`);
			processError(requestError);
			doIncrementalLoad = false;
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

