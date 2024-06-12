
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

// https://bsky.social/xrpc/app.bsky.feed.getTimeline?algorithm=reverse-chronological&limit=22

// site: "https://bsky.social"

const uriPrefix = "https://bsky.app";

function load() {
	sendRequest(site + "/xrpc/app.bsky.feed.getTimeline?algorithm=reverse-chronological&limit=100")
	.then((text) => {
		const jsonObject = JSON.parse(text);

		const items = jsonObject.feed
		let results = [];
		for (const item of items) {
			const date = new Date(item.post.indexedAt);

			const author = item.post.author;
			
			const identity = identityForAccount(author);
			
			const inReplyToRecord = item.reply && item.reply.record
			const reason = item.reason
			const record = item.post.record;
			
			// reply is: item.post
			// reply content/author is: item.post.record / item.post.author
			// reply parent content/author is: item.reply.parent.record / item.reply.parent.author
			
			// repost is: item.reason.$type == "app.bsky.feed.defs#reasonRepost"
			// repost account is: item.reason.by
			// repost date is: item.reason.indexedAt
			
			// embed is: item.post.embed.$type == "app.bsky.embed.record#view"
			// embed content/author: item.post.embed.record
			
			// account info ("by" or "author"):
				// did: for profile link
				// displayName: account name
				// handle: @name (without the @)
				
			// content info ("record"):
				// indexedAt: date created
				// author: account info
				// value:
					// $type == "app.bsky.feed.post"
					// text: post text

/*
	POST
	
	item
		post
			author : account
			record : content

		
	REPOST

	item
		post
			author : account
			record : content
		reason
			$type == "app.bsky.feed.defs#reasonRepost"
			by : account
		reply (the post being replied to)
			parent
				author: account
				record: content
			root
				author: account
				record: content
					
	REPLY

	item
		post (the reply)
			author : account
			record : content
		reply (the post being replied to)
			parent
				author: account
				record: content
			root
				author: account
				record: content

	EMBED
	
	item
		post
			author: account
			record: content
			embed
				$type == "app.bsky.embed.record#view"
				record : content
			
				$type == "app.bsky.embed.images#view"
				images
					fullsize
					alt
					thumb
*/				
			
			
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
			
			const embedContent = contentForEmbed(item.post.embed);
			if (embedContent != null) {
				content = content + embedContent;
			}
			let attachments = attachmentsForEmbed(item.post.embed);
			
			// item.post.uri:	at://did:plc:aidmyvxy7lln7l5fzkv4gvxa/app.bsky.feed.post/3jvi6bseuzu2x
			// web url:			https://staging.bsky.app/profile/nanoraptor.danamania.com/post/3jvi6bseuzu2x 
			
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
			
			results.push(post);
		}

		processResults(results);
	})
	.catch((requestError) => {
		processError(requestError);
	});	
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
		content = `<blockquote>${replyContent}</blockquote>`;
	}
	
	return content;
}

function contentForEmbed(embed) {
	let content = null;

	if (embed != null && embed.$type == "app.bsky.embed.record#view") {
		if (embed.record != null) {
			const embedAccount = contentForAccount(embed.record.author);
			const embedContent = contentForRecord(embed.record);
			content = `<blockquote>${embedAccount}${embedContent}</blockquote>`;
		}
	}
	
	return content;
}

function attachmentsForEmbed(embed) {
	let attachments = null;
	
	if (embed != null && embed.$type == "app.bsky.embed.images#view") {
		const images = embed.images;
		if (images != null) {
			attachments = []
			let count = Math.min(4, images.length);
			for (let index = 0; index < count; index++) {
				let image = images[index];
				const media = image.fullsize;
				const attachment = MediaAttachment.createWithUrl(media);
				if (image.aspectRatio != null) {
					attachment.aspectSize = image.aspectRatio;
				}
				attachment.text = image.alt;
				attachment.thumbnail = image.thumb;
				attachment.mimeType = "image";
				attachments.push(attachment);
			}
		}
	}
	
	return attachments;
}

function contentForRecord(record) {
	if (record == null) {
		return "<p>Deleted post</p>";
	}
	if (record.text == null && record.value.text == null) {
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

