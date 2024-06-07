
// com.tumblr

function verify() {
	sendRequest(site + "/v2/user/info")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const blogs = jsonObject.response.user.blogs;
		const blog = blogs[0];
		
		const displayName = blog.name;
		const icon = "https://api.tumblr.com/v2/blog/" + blog.name + "/avatar/96";

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

function load() {
	sendRequest(site + "/v2/user/dashboard")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		const items = jsonObject.response.posts
		var results = [];
		for (const item of items) {
			const blog = item.blog;
			const identity = Identity.createWithName(blog["name"]);
			identity.uri = blog["url"];
			identity.avatar = "https://api.tumblr.com/v2/blog/" + blog["name"] + "/avatar/96";

			const uri = item["post_url"];
			const date = new Date(item["timestamp"] * 1000); // timestamp is seconds since the epoch, convert to milliseconds
			
			// TODO: Add an annotation for reblogging.
			
			let content = null;
			let attachments = null;
			if (item["type"] == "photo") {
				content = item["caption"];
				
				attachments = [];
				let photos = item.photos;
				let count = Math.min(4, photos.length);
				for (let index = 0; index < count; index++) {
					let photo = photos[index];
					const media = photo.original_size.url;
					const attachment = Attachment.createWithMedia(media);
					attachment.text = item["summary"];
					attachments.push(attachment);
				}
			}
			else if (item["type"] == "text") {
				content = item["body"];
			}
			
			if (content != null) {
				const post = Item.createWithUriDate(uri, date);
				post.body = content;
				post.author = identity;
				if (attachments != null) {
					post.attachments = attachments
				}
				results.push(post);
			}
		}
		processResults(results);
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}
