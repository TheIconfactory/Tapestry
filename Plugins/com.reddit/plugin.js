
// com.reddit

// API Documentation:
// https://www.reddit.com/dev/api/
// https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki

// NOTE: There is no identify() function at present. A user's private API Keys are their own, so there doesn't
// appear to be a need for ownership.

function load() {
	sendRequest("https://oauth.reddit.com/r/weirdwheels/hot.json?raw_json=1", "GET")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		var results = [];
		
		for (const child of jsonObject.data.children) {
			const item = child.data;
			
			const author = item["author"];
			const avatar = "https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-180x180.png";
			const creatorUri = "https://www.reddit.com/user/" + author;
			var creator = Creator.createWithUriName(creatorUri, author)
			creator.avatar = avatar

			const date = new Date(item["created_utc"] * 1000);
			const uri = "https://www.reddit.com" + encodeURI(item["permalink"]);
			const content = item["title"];

			var attachments = null;
			if (item["gallery_data"] != null) {
				attachments = [];
				const galleryItems = item["gallery_data"].items;
				for (const galleryItem of galleryItems) {
					const mediaId = galleryItem["media_id"];
					const mediaMetadata = item["media_metadata"];
					if (mediaMetadata != null) {
						const metadata = mediaMetadata[mediaId];
						const image = metadata.s.u;
						// TODO: Use the metadata.p.u URL as a thumbnail.
						if (image != null) {
							const attachment = Attachment.createWithMedia(image);
							attachments.push(attachment);
						}
					}
					else {
						// NOTE: This might be an appropriate fallback: "https://i.redd.it/" + galleryItem["media_id"] + ".jpg";
					}
				}
			}
			else {
				const image = item["url"];
				if (image != null) {
					if (image.endsWith(".jpg") || image.endsWith(".jpeg")) {
						const attachment = Attachment.createWithMedia(image);
						attachments = [attachment];
					}
					else {
						const thumbnail = item["thumbnail"];
						if (thumbnail != null) {
							const attachment = Attachment.createWithMedia(thumbnail);
							attachments = [attachment];
						}
					}
				}
			}
			
			const post = Post.createWithUriDateContent(uri, date, content);
			post.creator = creator;
			post.attachments = attachments;
			
			results.push(post);			
		}
		
		processResults(results, true);
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}
