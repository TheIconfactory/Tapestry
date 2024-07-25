
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

const imageRegex = /<img src="([^"]*)/;

function load() {
	sendRequest(site + "/v2/user/dashboard")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		const items = jsonObject.response.posts
		var results = [];
		for (const item of items) {
			const blog = item.blog;
			const identity = Identity.createWithName(blog.name);
			identity.uri = blog.url;
			identity.username = blog.title;
			identity.avatar = "https://api.tumblr.com/v2/blog/" + blog.name + "/avatar/96";

			const uri = item.post_url;
			const date = new Date(item.timestamp * 1000); // timestamp is seconds since the epoch, convert to milliseconds
			
			// TODO: Add an annotation for reblogging.

			// item.tags = ["tweets", "white people twitter", "funny tweets"]
			// linked as: https://www.tumblr.com/tagged/white%20people%20twitter
			
			// parent_post_url != null if a reblog

			let lastTrail = null;
			if (item.parent_post_url != null) {
				// this is a reblog
				if (item.trail != null && item.trail.length > 0) {
					lastTrail = item.trail[0];
				}
			}
			
			let annotation = null;
			if (lastTrail != null) {
				const userName = lastTrail.blog.name;
				const text = "Reblogged " + userName;
				annotation = Annotation.createWithText(text);
				annotation.uri = item.parent_post_url;
			}
			
			let content = null;
			let attachments = null;
			if (item.type == "photo") {
				if (lastTrail != null) {
					content = lastTrail.content;
				}
				else {
					content = item.caption;
				}
							
				attachments = [];
				let photos = item.photos;
				let count = photos.length;
				for (let index = 0; index < count; index++) {
					let photo = photos[index];
					const media = photo.original_size.url;
					const attachment = MediaAttachment.createWithUrl(media);
					attachment.text = item.summary;
					attachment.mimeType = "image";
					attachments.push(attachment);
				}
			}
			else if (item.type == "video") {
				if (lastTrail != null) {
					content = lastTrail.content;
				}
				else {
					content = item.body;
				}
			}
			else if (item.type == "text") {
				if (lastTrail != null) {
					content = lastTrail.content;
				}
				else {
					content = item.body;
				}
			}
			else {
				console.log(`ignored ${item.type}`);
			}
			
			if (content != null) {
				const post = Item.createWithUriDate(uri, date);
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
		}
		processResults(results);
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}
