
// com.tumblr

function verify() {
	sendRequest(site + "/v2/user/info")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const blogs = jsonObject.response.user.blogs;
		const blog = blogs[0];
		
		const verification = {
			displayName: blog.name,
			icon: "https://assets.tumblr.com/pop/manifest/apple-touch-icon-6d2aadd9.png"
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
			const creator = Creator.createWithUriName(blog["url"], blog["name"]);
			let avatar = "https://api.tumblr.com/v2/blog/" + blog["name"] + "/avatar/96";
			creator.avatar = avatar;

			const uri = item["post_url"];
			const date = new Date(item["timestamp"] * 1000); // timestamp is seconds since the epoch, convert to milliseconds
			
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
				const post = Post.createWithUriDateContent(uri, date, content);
				post.creator = creator;
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
