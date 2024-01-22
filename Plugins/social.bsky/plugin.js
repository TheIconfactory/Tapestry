
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

const uriPrefix = "https://staging.bsky.app";

function load() {
	sendRequest(site + "/xrpc/app.bsky.feed.getTimeline?algorithm=reverse-chronological&limit=22")
	.then((text) => {
		const jsonObject = JSON.parse(text);

		const items = jsonObject.feed
		var results = [];
		for (const item of items) {
			const author = item.post.author;
			const authorUri = uriPrefix + "/profile/" + author.handle;
			const name = author.displayName
			const creator = Creator.createWithUriName(authorUri, name);
			creator.avatar = author.avatar;
			
			const record = item.post.record;
			
			const date = new Date(record.createdAt);
			
			const content = record.text;

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
						attachments.push(attachment);
					}
				}
			}
			
			// item.post.uri:	at://did:plc:aidmyvxy7lln7l5fzkv4gvxa/app.bsky.feed.post/3jvi6bseuzu2x
			// web url:			https://staging.bsky.app/profile/nanoraptor.danamania.com/post/3jvi6bseuzu2x 
			
			const itemIdentifier = item.post.uri.split("/").pop();
			const postUri = uriPrefix + "/profile/" + author.handle + "/post/" + itemIdentifier;
			
			const post = Post.createWithUriDateContent(postUri, date, content);
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
