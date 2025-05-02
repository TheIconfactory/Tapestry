
// social.bsky.feed

// Copy link to list:
// https://bsky.app/profile/did:plc:7foutw3hvd7nqwwng5gsmuez/lists/3lml2frpysk2j
// https://bsky.app/profile/gnitsetgnitset.bsky.social/lists/3lml2frpysk2j
//
// ->
//
// API request:
// https://api.bsky.app/xrpc/app.bsky.feed.getListFeed?list=at%3A%2F%2Fdid%3Aplc%3A7foutw3hvd7nqwwng5gsmuez%2Fapp.bsky.graph.list%2F3lml2frpysk2j

function verify() {
	sendRequest(`${site}/xrpc/app.bsky.actor.getProfile?actor=${account}`)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const did = jsonObject.did;
		setItem("did", did);
		
		const profileHandle = "@" + jsonObject.handle;

		sendRequest(`${site}/xrpc/app.bsky.graph.getList?list=at://${did}/app.bsky.graph.list/${listId}`)
		.then((text) => {
			const jsonObject = JSON.parse(text);
		
			const avatar = jsonObject?.list?.avatar ?? jsonObject?.list?.creator?.avatar;
			const listName = jsonObject.list.name;
			const displayName = `${listName} by ${profileHandle}`;
			if (avatar != null) {
				const verification = {
					displayName: displayName,
					icon: avatar
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
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

const uriPrefix = "https://bsky.app";
const uriPrefixContent = "https://cdn.bsky.app";
const uriPrefixVideo = "https://video.bsky.app";


function load() {
	var did = getItem("did");

	if (did != null) {
		queryList(did, listId)
		.then((results) =>  {
			console.log(`finished (cached) feed`);
			processResults(results, true);
		})
		.catch((requestError) => {
			loadCounter -= 1;
			console.log(`error (cached) feed`);
			processError(requestError);
		});	
	}
	else {
		sendRequest(`${site}/xrpc/app.bsky.actor.getProfile?actor=${account}`)
		.then((text) => {
			const jsonObject = JSON.parse(text);
		
			did = jsonObject.did;
			setItem("did", did);
		
			queryList(did, listId)
			.then((results) =>  {
				console.log(`finished feed`);
				processResults(results, true);
			})
			.catch((requestError) => {
				loadCounter -= 1;
				console.log(`error feed`);
				processError(requestError);
			});	
		})
		.catch((requestError) => {
			processError(requestError);
		});
	}
}

function queryList(did, listId) {

	return new Promise((resolve, reject) => {
		sendRequest(`${site}/xrpc/app.bsky.feed.getListFeed?list=at://${did}/app.bsky.graph.list/${listId}`)
		.then((text) => {
			const jsonObject = JSON.parse(text);
			
			let results = [];
			for (const item of jsonObject.feed) { 
				let annotation = null;
				
				let post = null;
				if (item.reblog != null) {
					post = postForItem(item.reblog);
					annotation = Annotation.createWithText("REPOST");
					annotation.uri = item.account["url"];
				}
				else {
					post = postForItem(item);
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

function postForItem(item) {
	let date = new Date(item.post.indexedAt);
	
	const author = item.post.author;
	
	const identity = identityForAccount(author);
	
	const inReplyToRecord = item.reply && item.reply.record
	const reason = item.reason
	const record = item.post.record;
	
				
	let content = contentForRecord(item.post.record);
	
	let contentWarning = null;
	if (item.post.labels != null && item.post.labels.length > 0) {
		const labels = item.post.labels.map((label) => { return label?.val ?? "" }).join(", ");
		contentWarning = `Labeled: ${labels}`;
	}
	
	let annotation = null;
	
	const replyContent = contentForReply(item.reply);
	if (replyContent != null) {
		annotation = annotationForReply(item.reply);
		content = replyContent + content;
	}

	const repostContent = contentForRepost(item.reason);
	if (repostContent != null) {
		if (item.reason.indexedAt != null) {
			date = new Date(item.reason.indexedAt);
		}
		annotation = annotationForRepost(item.reason);
		content = repostContent + content;
	}

	let showItem = true;
	
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
		if (contentWarning != null) {
			post.contentWarning = contentWarning;
		}
		
		return post;
	}
	
	return null;
}

function identityForAccount(account) {
	const name = nameForAccount(account);
	if (name == null) {
		return null;
	}
	
	const authorUri = uriPrefix + "/profile/" + account.handle;
	const identity = Identity.createWithName(name);
	identity.username = "@" + account.handle;
	identity.uri = authorUri;
	if (account.avatar != null) {
		identity.avatar = account.avatar;
	}
	
	return identity;
}

function contentForAccount(account, prefix = "") {
	const name = nameForAccount(account);
	if (name == null) {
		return "";
	}

	const authorUri = uriPrefix + "/profile/" + account.handle;
	
	return `<p>${prefix}<a href="${authorUri}">${name}</a></p>`;
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
	if (account == null || account.handle == null) {
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
		const replyName = nameForAccount(reply.parent.author);
		if (replyName != null) {
			content = `<blockquote><p>${replyName} said:</p><p>${replyContent}</p></blockquote>`;
		}
		else {
			content = `<blockquote><p>${replyContent}</p></blockquote>`;
		}
	}
	
	return content;
}

function attachmentsForEmbed(embed, did = null) {
	let attachments = null;
	
	if (embed != null) {
		if (embed.$type.startsWith("app.bsky.embed.images")) {
			const images = embed.images;
			if (images != null) {
				attachments = []
				let count = images.length;
				for (let index = 0; index < count; index++) {
					let image = images[index];
					const isBlob = (image.image?.$type == "blob");
					let media = null;
					if (isBlob) {
						if (did != null && image.image?.ref?.$link != null) {
							const ref = image.image.ref.$link;
							const suffix = image.image.mimeType.split("/")[1] ?? "";
							media = `${uriPrefixContent}/img/feed_fullsize/plain/${did}/${ref}@${suffix}`;
						}
					}
					else {
						media = image.fullsize;
					}
					if (media != null) {
						const attachment = MediaAttachment.createWithUrl(media);
						if (image.aspectRatio != null) {
							attachment.aspectSize = image.aspectRatio;
						}
						if (image.alt != null && image.alt.length != 0) {
							attachment.text = image.alt;
						}
						if (isBlob) {
							if (did != null && image.image?.ref?.$link != null) {
								const ref = image.image.ref.$link;
								const suffix = image.image.mimeType.split("/")[1] ?? "";
								attachment.thumbnail = `${uriPrefixContent}/img/feed_thumbnail/plain/${did}/${ref}@${suffix}`;
							}
						}
						else {
							if (image.thumb) {
								attachment.thumbnail = image.thumb;
							}
						}
						attachment.mimeType = "image";
						attachments.push(attachment);
					}
				}
			}
		}
		else if (embed.$type.startsWith("app.bsky.embed.video")) {
			const isBlob = (embed.video?.$type == "blob");
			if (isBlob) {
				if (did != null && embed.video?.ref?.$link != null) {
					const ref = embed.video?.ref?.$link;
					const media = `${uriPrefixVideo}/watch/${did}/${ref}/playlist.m3u8`;
					const thumbnail = `${uriPrefixVideo}/watch/${did}/${ref}/thumbnail.jpg`;
					const attachment = MediaAttachment.createWithUrl(media);
					if (embed.aspectRatio != null) {
						attachment.aspectSize = embed.aspectRatio;
					}
					if (embed.alt != null && embed.alt.length != 0) {
						attachment.text = embed.alt;
					}
					attachment.thumbnail = thumbnail;
					attachment.mimeType = "video/mp4";
					attachments = [attachment];
				}				
			}
			else {
				if (embed.playlist != null) {
					const media = embed.playlist;
					const attachment = MediaAttachment.createWithUrl(media);
					if (embed.aspectRatio != null) {
						attachment.aspectSize = embed.aspectRatio;
					}
					if (embed.alt != null && embed.alt.length != 0) {
						attachment.text = embed.alt;
					}
					if (embed.thumbnail != null) {
						attachment.thumbnail = embed.thumbnail;
					}
					attachment.mimeType = "video/mp4";
					attachments = [attachment];
				}
			}
		}
		else if (embed.$type.startsWith("app.bsky.embed.external")) {
			if (embed.external != null && embed.external.uri != null) {
				const isBlob = (embed.external?.thumb?.$type == "blob");
				
				const external = embed.external;
				let attachment = LinkAttachment.createWithUrl(external.uri);
				if (external.title != null && external.title.length > 0) {
					attachment.title = external.title;
				}
				if (external.description != null && external.description.length > 0) {
					attachment.subtitle = external.description;
				}
				if (isBlob) {
					if (did != null && embed.external?.thumb?.ref?.$link != null) {
						const ref = embed.external?.thumb?.ref?.$link;
						const suffix = embed.external?.thumb?.mimeType.split("/")[1] ?? "";
						attachment.image = `${uriPrefixContent}/img/feed_thumbnail/plain/${did}/${ref}@${suffix}`;
					}
				}
				else {
					if (external.thumb != null && external.thumb.length > 0) {
						attachment.image = external.thumb;
					}
				}
				attachments = [attachment];
			}
		}
		else if (embed.$type.startsWith("app.bsky.embed.recordWithMedia")) {
			if (embed.record != null && embed.media != null) {
				const media = embed.media;
				
				attachments = attachmentsForEmbed(media);
				
				const record = embed.record.record;
				if (record != null) {
					const handle = record.author?.handle;
					const title = nameForAccount(record.author);
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
							if (firstRecordEmbed.$type.startsWith("app.bsky.embed.images")) {
								if (firstRecordEmbed.images != null && firstRecordEmbed.images.length > 0) {
									const image = firstRecordEmbed.images[0];
									attachment.image = image.thumb;
									if (image.aspectRatio != null) {
										attachment.aspectSize = image.aspectRatio;
									}
								}
							}
							else if (firstRecordEmbed.$type.startsWith("app.bsky.embed.video")) {
								if (firstRecordEmbed.thumbnail != null) {
									attachment.image = firstRecordEmbed.thumbnail;
									if (firstRecordEmbed.aspectRatio != null) {
										attachment.aspectSize = firstRecordEmbed.aspectRatio;
									}
								}
							}
							else if (firstRecordEmbed.$type.startsWith("app.bsky.embed.recordWithMedia")) {
								if (firstRecordEmbed.media != null) {
									const firsRecordEmbedMedia = firstRecordEmbed.media;
									if (firsRecordEmbedMedia.$type.startsWith("app.bsky.embed.images")) {
										if (firsRecordEmbedMedia.images != null && firsRecordEmbedMedia.images.length > 0) {
											const image = firsRecordEmbedMedia.images[0];
											attachment.image = image.thumb;
											if (image.aspectRatio != null) {
												attachment.aspectSize = image.aspectRatio;
											}
										}
									}
									else if (firsRecordEmbedMedia.$type.startsWith("app.bsky.embed.video")) {
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
		else if (embed.$type.startsWith("app.bsky.embed.record")) { // NOTE: This one needs to be after app.bsky.embed.recordWithMedia because of the lazy match
			if (embed.record != null) {
				const record = embed.record;
				
				const authorHandle = record.author?.handle;
				const authorName = nameForAccount(record.author);
				const recordText = record.value?.text;
				
				const embedUrl = record.uri.split("/").pop();
				if (authorHandle != null) {
					const postUri = uriPrefix + "/profile/" + authorHandle + "/post/" + embedUrl;
	
					let attachment = LinkAttachment.createWithUrl(postUri);
					if (authorName != null && authorName.length > 0) {
						attachment.title = authorName;
					}
					if (recordText != null && recordText.length > 0) {
						attachment.subtitle = recordText;
					}
					
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
	
	try {
		if (record.facets != null) {
			// NOTE: Facets are processed in reverse order determined by the starting index. This is because the output string
			// is being modified in place.
			const sortedFacets = record.facets.toSorted((a,b) => {return b?.index?.byteStart - a?.index?.byteStart})
			for (const facet of sortedFacets) {
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
						const link = `<a href="${feature.uri}">${text}</a>`;
						content = prefix + link + suffix;
					}
					else if (feature.$type == "app.bsky.richtext.facet#mention") {
						const link = `<a href="${uriPrefix}/profile/${feature.did}">${text}</a>`;
						content = prefix + link + suffix;
					}
					else if (feature.$type == "app.bsky.richtext.facet#tag") {
						//console.log(`tag feature = ${JSON.stringify(feature)}`);
						const link = `<a href="${uriPrefix}/hashtag/${feature.tag}">${text}</a>`;
						content = prefix + link + suffix;
					}
					else {
						console.log(`skipped feature.$type = ${feature.$type}`);
					}
				}
			}
		}
	}
	catch (error) {
		console.log(`facet conversion error = ${error}`);
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

