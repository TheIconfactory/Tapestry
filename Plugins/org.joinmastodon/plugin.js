
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

	var postDate;
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

	var attachments = null;
	const mediaAttachments = item["media_attachments"];
	if (mediaAttachments != null && mediaAttachments.length > 0) {
		attachments = []
		for (const mediaAttachment of mediaAttachments) {
			const media = mediaAttachment["url"]
			const attachment = Attachment.createWithMedia(media);
			attachment.thumbnail = mediaAttachment["preview_url"];
			attachment.text = mediaAttachment["description"];
			attachment.blurhash = mediaAttachment["blurhash"];
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
	post.attachments = attachments;

	return post;
}

function load() {
	sendRequest(site + "/api/v1/timelines/home?limit=40", "GET")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		var results = [];
		for (const item of jsonObject) {
			const date = new Date(item["created_at"]);
			
			var postItem = item;
			if (item["reblog"] != null) {
				postItem = item["reblog"];
			}
			
			const post = postForItem(postItem, date);
			
			results.push(post);
		}
		processResults(results, true);
	})
	.catch((requestError) => {
		processError(requestError);
	});	

	if (includeMentions == "on") {
		sendRequest(site + "/api/v1/notifications?types%5B%5D=mention&limit=30", "GET")
		.then((text) => {
			const jsonObject = JSON.parse(text);
			var results = [];
			for (const item of jsonObject) {
				var postItem = item["status"];
	
				const post = postForItem(postItem);
	
				results.push(post);
			}
			processResults(results, true);
		})
		.catch((requestError) => {
			processError(requestError);
		});
	}
	
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
			var results = [];
			for (const item of jsonObject) {
				var postItem = item;

				const post = postForItem(postItem);

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

function sendPost(parameters) {
	sendRequest(site + "/api/v1/statuses", "POST", parameters)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		processResults([jsonObject], true);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function sendAttachments(post) {
	const mediaEndpoint = site + "/api/v2/media";
	
	const file = post.attachments[0].media;
	uploadFile(file, mediaEndpoint)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const mediaId = jsonObject["id"];
		
		const status = post.content;
		
		const parameters = "status=" + status + "&" + "media_ids[]=" + mediaId;
		
		sendPost(parameters);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function send(post) {
	if (post.attachments != null && post.attachments.length > 0) {
		sendAttachments(post);
	}
	else {
		const status = post.content;
		const parameters = "status=" + status;
		
		sendPost(parameters);
	}
}

