
// social.bsky

function identify() {
	sendRequest(site + "/xrpc/com.atproto.server.getSession")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		const identifier = jsonObject.handle;
		
		setIdentifier(identifier);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

// https://bsky.social/xrpc/app.bsky.feed.getTimeline?algorithm=reverse-chronological&limit=22

const uriPrefix = "https://bsky.app";

function load() {
	sendRequest(site + "/xrpc/app.bsky.feed.getTimeline?algorithm=reverse-chronological&limit=100")
	.then((text) => {
		const jsonObject = JSON.parse(text);

		const items = jsonObject.feed
		var results = [];
		for (const item of items) {
			const author = item.post.author;
			const authorUri = uriPrefix + "/profile/" + author.handle;
			const name = author.displayName;
			const creator = Creator.createWithUriName(authorUri, name);
			creator.avatar = author.avatar;
			
			const record = item.post.record;
			
			const date = new Date(record.createdAt);
			
			var content = record.text;
			
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

			var finalContent = "";
			const paragraphs = content.split("\n\n")
			for (const paragraph of paragraphs) {
				
				finalContent += "<p>" + paragraph.replaceAll("\n", "<br/>") + "</p>";
			}

			var attachments = null;
			if (item.post.embed != null) {
				const images = item.post.embed.images;
				if (images != null) {
					attachments = []
					let count = Math.min(4, images.length);
					for (let index = 0; index < count; index++) {
						let image = images[index];
						const media = image.fullsize;
						const attachment = Attachment.createWithMedia(media);
						attachment.text = image.alt;
						attachment.thumbnail = image.thumb;
						if (media.endsWith("@jpeg")) {
							attachment.mimeType = "image/jpeg";
						}
						else if (media.endsWith("@png")) {
							attachment.mimeType = "image/png";
						} 
						attachments.push(attachment);
					}
				}
			}
			
			// item.post.uri:	at://did:plc:aidmyvxy7lln7l5fzkv4gvxa/app.bsky.feed.post/3jvi6bseuzu2x
			// web url:			https://staging.bsky.app/profile/nanoraptor.danamania.com/post/3jvi6bseuzu2x 
			
			const itemIdentifier = item.post.uri.split("/").pop();
			const postUri = uriPrefix + "/profile/" + author.handle + "/post/" + itemIdentifier;
			
			const post = Post.createWithUriDateContent(postUri, date, finalContent);
			post.creator = creator;
			if (attachments != null) {
				post.attachments = attachments
			}
			results.push(post);
		}

		processResults(results);
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}

function stringToBytes(text) {
	// the encoded text is in UTF-8 with percent escapes for characters other than: A–Z a–z 0–9 - _ . ! ~ * ' ( )
	const encodedText = encodeURIComponent(text);

	var resultArray = [];

	for (var i = 0; i < encodedText.length; i++) {
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

