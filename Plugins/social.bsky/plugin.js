
// social.bsky

function verify() {
	sendRequest(site + "/xrpc/com.atproto.server.getSession")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		const displayName = "@" + jsonObject.handle;
		
		// TODO: Use getProfile to get avatar: https://docs.bsky.app/docs/api/app-bsky-actor-get-profile
		
		processVerification(displayName);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

const uriPrefix = "https://bsky.app";

function queryTimeline(doIncrementalLoad) {

	return new Promise((resolve, reject) => {

		// this function is called recursively to load & process batches of posts into a single list of results
		function requestToCursor(cursor, doIncrementalLoad, resolve, reject, limit = 5, results = []) {
			let url = null
			if (cursor == null) {
				console.log("cursor = none");
				url = `${site}/xrpc/app.bsky.feed.getTimeline?algorithm=reverse-chronological&limit=50`;
			}
			else {
				const offset = (requestLimit - limit) * 20;
				console.log(`cursor = ${cursor}`);
				url = `${site}/xrpc/app.bsky.feed.getTimeline?algorithm=reverse-chronological&limit=50&cursor=${cursor}`;
			}
			
			console.log(`doIncrementalLoad = ${doIncrementalLoad}, cursor = ${cursor}`);
			
			sendRequest(url, "GET")
			.then((text) => {
				//console.log(text);
				const jsonObject = JSON.parse(text);
				const items = jsonObject.feed
				for (const item of items) {
					const post = postForItem(item);
					if (post != null) {
						results.push(post);
					}
				}

				const cursor = jsonObject.cursor;				
				const newLimit = limit - 1;

				if (cursor != null && newLimit > 0 && doIncrementalLoad == false) {
					requestToCursor(cursor, doIncrementalLoad, resolve, reject, newLimit, results);
				}
				else {
					resolve(results);
				}
			})
			.catch((error) => {
				reject(error);
			});	
		}

		const requestLimit = 4;
		requestToCursor(null, doIncrementalLoad, resolve, reject, requestLimit);

	});
	
}

// NOTE: The connector does incremental loads (only most recent items in dashboard) until 6 hours have
// elapsed since the last full load (200 items in dashboard). The idea here is that this covers cases where
// this script is still in memory, but hasn't been accessed while the device/user is sleeping.
var lastFullUpdate = null;
const fullUpdateInterval = 6 * 60 * 60;

function load() {
	let doIncrementalLoad = false;
	if (lastFullUpdate != null) {
		console.log(`fullUpdateInterval = ${fullUpdateInterval}`);
		let delta = fullUpdateInterval * 1000; // seconds → milliseconds
		let future = (lastFullUpdate.getTime() + delta);
		console.log(`future = ${new Date(future)}`);
		let now = (new Date()).getTime();
		if (now < future) {
			// time has not elapsed, do an incremental load
			console.log(`time until next update = ${(future - now) / 1000} sec.`);
			doIncrementalLoad = true;
		}
	}
	if (!doIncrementalLoad) {
		lastFullUpdate = new Date();
	}

	queryTimeline(doIncrementalLoad)
	.then((results) =>  {
		console.log(`finished timeline`);
		processResults(results, true);
		doIncrementalLoad = true;
	})
	.catch((requestError) => {
		console.log(`error timeline`);
		processError(requestError);
		doIncrementalLoad = false;
	});
}

function postForItem(item) {
	const date = new Date(item.post.indexedAt);

	const author = item.post.author;
	
	const identity = identityForAccount(author);
	
	const inReplyToRecord = item.reply && item.reply.record
	const reason = item.reason
	const record = item.post.record;
	
				
	let content = contentForRecord(item.post.record);
	
	let annotation = null;
	
	const replyContent = contentForReply(item.reply);
	if (replyContent != null) {
		annotation = annotationForReply(item.reply);
		content = replyContent + content;
	}

	const repostContent = contentForRepost(item.reason);
	if (repostContent != null) {
		annotation = annotationForRepost(item.reason);
		content = repostContent + content;
	}

	let showItem = true;
	if (includeReposts != "on") {
		if (repostContent != null) {
			showItem = false;
		}
	}
	if (includeReplies != "on") {
		if (repostContent == null && replyContent != null) { // filter out replies only if they are not reposted
			showItem = false;
		}
	}
	
	if (showItem) {
		let attachments = attachmentsForEmbed(item.post.embed);
				
		const itemIdentifier = item.post.uri.split("/").pop();
		const postUri = uriPrefix + "/profile/" + author.handle + "/post/" + itemIdentifier;
		
		const post = Item.createWithUriDate(postUri, date);
		post.body = content;
		post.author = identity;
		if (attachments != null) {
			post.attachments = attachments
		}
		if (annotation != null) {
			post.annotations = [annotation];
		}
		
		return post;
	}
	
	return null;
}

function identityForAccount(account) {
	if (account == null || account.handle == null || account.displayName == null) {
		return null;
	}
	
	const authorUri = uriPrefix + "/profile/" + account.handle;
	const name = account.displayName;
	const identity = Identity.createWithName(name);
	identity.username = "@" + account.handle;
	identity.uri = authorUri;
	identity.avatar = account.avatar;
	
	return identity;
}

function contentForAccount(account, prefix = "") {
	if (account == null || account.handle == null || account.displayName == null) {
		return "";
	}

	const authorUri = uriPrefix + "/profile/" + account.handle;
	const name = account.displayName;
	
	const content = `<p>${prefix}<a href="${authorUri}">${name}</a></p>`;
	return content;
}

function nameForAccount(account) {
	if (account == null || account.handle == null) {
		return null;
	}

	if (account.displayName != null && account.displayName.length > 0) {
		return account.displayName;
	}
	else {
		return account.handle;
	}
}

function handleForAccount(account) {
	if (account == null || account.handle == null) {
		return null;
	}

	return "@" + account.handle;
}

function uriForAccount(account) {
	if (account == null || account.handle == null || account.displayName == null) {
		return null;
	}

	return uriPrefix + "/profile/" + account.handle;

}

function annotationForRepost(reason) {
	let annotation = null;

	if (reason != null && reason.$type == "app.bsky.feed.defs#reasonRepost") {
		let name = nameForAccount(reason.by);
		if (name != null) {
			const text = `Reposted by ${name}`;
			annotation = Annotation.createWithText(text);
			annotation.uri = uriForAccount(reason.by);
		}
	}
	
	return annotation;
}

function contentForRepost(reason) {
	let content = null;

	if (reason != null && reason.$type == "app.bsky.feed.defs#reasonRepost") {
		content = "";
	}
	
	return content;
}

function annotationForReply(reply) {
	let annotation = null;

	if (reply != null && reply.parent != null) {
		let name = nameForAccount(reply.parent.author);
		if (name != null) {
			const text = `In reply to ${name}`;
			annotation = Annotation.createWithText(text);
			annotation.uri = uriForAccount(reply.parent.author);
		}
	}
	
	return annotation;
}

function contentForReply(reply) {
	let content = null;

	if (reply != null && reply.parent != null) {
		const replyContent = contentForRecord(reply.parent.record);
		const replyAuthor = reply.parent.author?.displayName
		if (replyAuthor != null) {
			content = `<blockquote><p>${replyAuthor} said:</p><p>${replyContent}</p></blockquote>`;
		}
		else {
			content = `<blockquote><p>${replyContent}</p></blockquote>`;
		}
	}
	
	return content;
}

function attachmentsForEmbed(embed) {
	let attachments = null;
	
	if (embed != null) {
		if (embed.$type == "app.bsky.embed.images#view") {
			const images = embed.images;
			if (images != null) {
				attachments = []
				let count = images.length;
				for (let index = 0; index < count; index++) {
					let image = images[index];
					const media = image.fullsize;
					const attachment = MediaAttachment.createWithUrl(media);
					if (image.aspectRatio != null) {
						attachment.aspectSize = image.aspectRatio;
					}
					if (image.alt != null) {
						attachment.text = image.alt;
					}
					if (image.thumb) {
						attachment.thumbnail = image.thumb;
					}
					attachment.mimeType = "image";
					attachments.push(attachment);
				}
			}
		}
		else if (embed.$type == "app.bsky.embed.video#view") {
			if (embed.playlist != null) {
				const media = embed.playlist;
				const attachment = MediaAttachment.createWithUrl(media);
				if (embed.aspectRatio != null) {
					attachment.aspectSize = embed.aspectRatio;
				}
				if (embed.alt != null) {
					attachment.text = embed.alt;
				}
				if (embed.thumbnail != null) {
					attachment.thumbnail = embed.thumbnail;
				}
				attachment.mimeType = "video/mp4";
				attachments = [attachment];
			}
		}
		else if (embed.$type == "app.bsky.embed.external#view") {
			if (embed.external != null && embed.external.uri != null) {
				const external = embed.external;
				let attachment = LinkAttachment.createWithUrl(external.uri);
				if (external.title != null && external.title.length > 0) {
					attachment.title = external.title;
				}
				if (external.description != null && external.description.length > 0) {
					attachment.subtitle = external.description;
				}
				if (external.thumb != null && external.thumb.length > 0) {
					attachment.image = external.thumb;
				}
				attachments = [attachment];
			}
		}
		else if (embed.$type == "app.bsky.embed.record#view") {
			if (embed.record != null) {
				const record = embed.record;
				
				const authorHandle = record.author?.handle;
				const authorDisplayName = record.author?.displayName;
				const recordText = record.value?.text;
				
				const embedUrl = record.uri.split("/").pop();
				if (authorHandle != null) {
					const postUri = uriPrefix + "/profile/" + authorHandle + "/post/" + embedUrl;
	
					let attachment = LinkAttachment.createWithUrl(postUri);
					if (authorDisplayName != null && authorDisplayName.length > 0) {
						attachment.title = authorDisplayName;
					}
					if (recordText != null && recordText.length > 0) {
						attachment.subtitle = recordText;
					}
// 					if (authorDisplayName != null && authorDisplayName.length > 0) {
// 						attachment.authorName = authorDisplayName;
// 					}
// 					attachment.authorProfile = uriPrefix + "/profile/" + authorHandle;
					
					if (record.embeds != null && record.embeds.length > 0) {
						if (record.embeds[0].images != null && record.embeds[0].images.length > 0) {
							const image = record.embeds[0].images[0];
							attachment.image = image.thumb;
							if (image.aspectRatio != null) {
								attachment.aspectSize = image.aspectRatio;
							}
						}
					}
					
					attachments = [attachment];
				}
			}
		}
		else if (embed.$type == "app.bsky.embed.recordWithMedia#view") {
			if (embed.record != null && embed.media != null) {
				const media = embed.media;
				
				attachments = attachmentsForEmbed(media);
				
				const record = embed.record.record;
				if (record != null) {
					const handle = record.author?.handle;
					const title = record.author?.displayName;
					const description = record.value?.text;
					
					const embedUrl = record.uri.split("/").pop();
					if (handle != null) {
						const postUri = uriPrefix + "/profile/" + handle + "/post/" + embedUrl;
		
						let attachment = LinkAttachment.createWithUrl(postUri);
						if (title != null && title.length > 0) {
							attachment.title = title;
						}
						if (description != null && description.length > 0) {
							attachment.subtitle = description;
						}
						
						if (record.embeds != null && record.embeds.length > 0) {
							const firstRecordEmbed = record.embeds[0];
							if (firstRecordEmbed.$type == "app.bsky.embed.images#view") {
								if (firstRecordEmbed.images != null && firstRecordEmbed.images.length > 0) {
									const image = firstRecordEmbed.images[0];
									attachment.image = image.thumb;
									if (image.aspectRatio != null) {
										attachment.aspectSize = image.aspectRatio;
									}
								}
							}
							else if (firstRecordEmbed.$type == "app.bsky.embed.video#view") {
								if (firstRecordEmbed.thumbnail != null) {
									attachment.image = firstRecordEmbed.thumbnail;
									if (firstRecordEmbed.aspectRatio != null) {
										attachment.aspectSize = firstRecordEmbed.aspectRatio;
									}
								}
							}
							else if (firstRecordEmbed.$type == "app.bsky.embed.recordWithMedia#view") {
								if (firstRecordEmbed.media != null) {
									const firsRecordEmbedMedia = firstRecordEmbed.media;
									if (firsRecordEmbedMedia.$type == "app.bsky.embed.images#view") {
										if (firsRecordEmbedMedia.images != null && firsRecordEmbedMedia.images.length > 0) {
											const image = firsRecordEmbedMedia.images[0];
											attachment.image = image.thumb;
											if (image.aspectRatio != null) {
												attachment.aspectSize = image.aspectRatio;
											}
										}
									}
									else if (firsRecordEmbedMedia.$type == "app.bsky.embed.video#view") {
										if (firsRecordEmbedMedia.thumbnail != null) {
											attachment.image = firsRecordEmbedMedia.thumbnail;
											if (firsRecordEmbedMedia.aspectRatio != null) {
												attachment.aspectSize = firsRecordEmbedMedia.aspectRatio;
											}
										}
									}
								}
							}
						}
						if (attachments == null) {
							attachments = [attachment];
						}
						else {
							attachments.push(attachment);
						}
					}
				}
			}
		}

	}
	
	return attachments;
}

function contentForRecord(record) {
	if (record == null) {
		return "<p>Deleted post</p>";
	}
	// TODO: This logic is fragile...
	if (record.text == null && record?.value == null) { //record?.value.text == null) {
		return "";
	}
	
	let content = record.text ?? record.value.text;
	
	// NOTE: Facets are a pain in the butt since they use byte positions in UTF-8. The JSON parser generates UTF-16
	// so we have to convert it back to bytes, find what we need, and then make a new UTF-16 string.
	
	if (record.facets != null) {
		// NOTE: Done in reverse order because we're modifying string in place.
		for (const facet of record.facets.reverse()) {
			if (facet.features.length > 0) {
				const bytes = stringToBytes(content);
				
				const prefixBytes = bytes.slice(0, facet.index.byteStart);
				const suffixBytes = bytes.slice(facet.index.byteEnd);
				const textBytes = bytes.slice(facet.index.byteStart, facet.index.byteEnd);

				const prefix = bytesToString(prefixBytes);
				const suffix = bytesToString(suffixBytes);
				const text = bytesToString(textBytes);

				const feature = facet.features[0];

				if (feature.$type == "app.bsky.richtext.facet#link") {
					const link = "<a href=\"" + feature.uri + "\">" + text + "</a>";
					content = prefix + link + suffix;
				}
				else if (feature.$type == "app.bsky.richtext.facet#mention") {
					const link = "<a href=\"" + uriPrefix + "/profile/" + feature.did + "\">" + text + "</a>";
					content = prefix + link + suffix;
				}
			}
		}
	}

	let finalContent = "";
	const paragraphs = content.split("\n\n")
	for (const paragraph of paragraphs) {
		finalContent += "<p>" + paragraph.replaceAll("\n", "<br/>") + "</p>";
	}
	
	return finalContent;
}

function stringToBytes(text) {
	// the encoded text is in UTF-8 with percent escapes for characters other than: A–Z a–z 0–9 - _ . ! ~ * ' ( )
	const encodedText = encodeURIComponent(text);

	let resultArray = [];

	for (let i = 0; i < encodedText.length; i++) {
		const character = encodedText[i];
		if (character == "%") {
			// convert the hex encoding to an integer value
			const hex = encodedText.substring(i+1, i+3);
			const byte = parseInt(hex, 16);
			resultArray.push(byte);
			
			// skip over the characters we just consumed
			i += 2;
	  	}
	  	else {
	  		// convert the unencoded character to an integer value
			const byte = character.charCodeAt(0);
			resultArray.push(byte);
	  	}
	}

	return resultArray;
}

function bytesToString(bytes) {
	// map all integer bytes to their percent escape equivalents
	const hexes = bytes.map((element) => {
		return "%" + element.toString(16).padStart(2, "0").toUpperCase();
	});
	const text = hexes.join("");

	// convert the percent escaped UTF-8 to UTF-16
	const resultString = decodeURIComponent(text);
	
	return resultString;
}

