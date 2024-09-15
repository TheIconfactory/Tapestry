
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

function postForItem(item) {
	if (item.type != "blocks") {
		return null;
	}
	
	let isReblog = false;
	if (item.parent_post_url != null) {
		isReblog = true;
	}
	if (isReblog && includeReblogs != "on") {
		return null;
	}
	
	const date = new Date(item.timestamp * 1000); // timestamp is seconds since the epoch, convert to milliseconds

	let contentItem = item;
	let contentBlocks = item.content;
	let contentUrl = item.post_url;
	
	let annotation = null;
	if (isReblog) {
		if (item.trail != null && item.trail.length > 0) {
			let trailOrigin = item.trail[0];
			
			const itemBlog = item.blog;
			const userName = itemBlog.name;
			const text = "Reblogged by " + userName;
			annotation = Annotation.createWithText(text);
			annotation.icon = "https://api.tumblr.com/v2/blog/" + itemBlog.name + "/avatar/96";
			annotation.uri = item.post_url;
			
			contentItem = trailOrigin;
			contentBlocks = contentItem.content;
			
// 			if (contentItem.blog.url != null && contentItem.post.id != null) {
// 				contentUrl = contentItem.blog.url + "/" + contentItem.post.id;
// 			}
		}
	}
	
	const blog = contentItem.blog;
	identity = Identity.createWithName(blog.name);
	identity.uri = blog.url;
	identity.username = blog.title;
	identity.avatar = "https://api.tumblr.com/v2/blog/" + blog.name + "/avatar/96";
	
	
	let body = "";
	let attachments = [];
	console.log(`contentBlocks.length = ${contentBlocks.length}`);
	for (const contentBlock of contentBlocks) {
		console.log(`  contentBlock.type = ${contentBlock.type}`);
		switch (contentBlock.type) {
		case "text":
			body += `<p>${contentBlock.text}</p>`;
			break;
		case "image":
			if (contentBlock.media != null && contentBlock.media.length > 0) {
				const mediaProperties = contentBlock.media[0];
				const posterProperties = mediaProperties.poster;

				const attachment = MediaAttachment.createWithUrl(mediaProperties.url);
				attachment.text = contentBlock.alt_text;
				attachment.mimeType = mediaProperties.type;
				attachment.aspectSize = {width: mediaProperties.width, height: mediaProperties.height};
				if (posterProperties != null) {
					attachment.thumbnail = posterProperties.url;
				}
				attachments.push(attachment);
			}
			break;
		case "link":
			if (contentBlock.url != null) {
				let attachment = LinkAttachment.createWithUrl(contentBlock.url);
				if (contentBlock.title != null && contentBlock.title.length > 0) {
					attachment.title = contentBlock.title;
				}
				if (contentBlock.description != null && contentBlock.description.length > 0) {
					attachment.subtitle = contentBlock.description;
				}
				if (contentBlock.author != null && contentBlock.author.length > 0) {
					attachment.authorName = contentBlock.author;
				}
				if (contentBlock.poster != null && contentBlock.poster.length > 0) {
					let poster = contentBlock.poster[0];
					if (poster.url != null) {
						attachment.image = poster.url;
					}
					if (poster.width != null && poster.height != null) {
						attachment.aspectSize = {width : poster.width, height: poster.height};
					}
				}
				attachments.push(attachment);
			}
			break;
		case "audio":
			if (contentBlock.media != null) {
				const mediaProperties = contentBlock.media;
				const posterProperties = contentBlock.poster;

				// TODO: Check contentBlock.provider and use embed_html if not "tumblr"
				
				const attachment = MediaAttachment.createWithUrl(mediaProperties.url);
				attachment.mimeType = mediaProperties.type;
				attachment.aspectSize = {width: mediaProperties.width, height: mediaProperties.height};
				if (posterProperties != null && posterProperties.length > 0) {
					attachment.thumbnail = posterProperties[0].url;
				}
				attachments.push(attachment);
			}
			else if (contentBlock.url != null) {
				const attachment = MediaAttachment.createWithUrl(contentBlock.url);
				attachments.push(attachment);
			}
			break;
		case "video":
			if (contentBlock.media != null) {
				const mediaProperties = contentBlock.media;
				const posterProperties = contentBlock.poster;

				// TODO: Check contentBlock.provider and use embed_html if not "tumblr"
				
				const attachment = MediaAttachment.createWithUrl(mediaProperties.url);
				attachment.mimeType = mediaProperties.type;
				attachment.aspectSize = {width: mediaProperties.width, height: mediaProperties.height};
				if (posterProperties != null && posterProperties.length > 0) {
					attachment.thumbnail = posterProperties[0].url;
				}
				attachments.push(attachment);
			}
			else if (contentBlock.url != null) {
				const attachment = MediaAttachment.createWithUrl(contentBlock.url);
				attachments.push(attachment);
			}
			break;
// 		case "paywall":
// 			break;
		default:
			body += `Cannot display ${contentBlock.type} content.`;
		}
	}
	
	if (includeTags == "on") {
		if (contentItem.tags != null && contentItem.tags.length > 0) {
			body += "<div>";
			for (const tag of contentItem.tags) {
				body += `<a href="https://www.tumblr.com/tagged/${encodeURIComponent(tag)}">#${tag}</a> `;
			}
			body += "</div>";
		}
	}

	const post = Item.createWithUriDate(contentUrl, date);
	post.body = body;
	if (identity != null) {
		post.author = identity;
	}
	if (attachments.length != 0) {
		post.attachments = attachments
	}
	if (annotation != null) {
		post.annotations = [annotation];
	}
	return post;
}

function queryDashboard(doIncrementalLoad) {

	return new Promise((resolve, reject) => {

		// this function is called recursively to load & process batches of posts into a single list of results
		function requestToId(id, doIncrementalLoad, resolve, reject, limit = 5, results = []) {
			let url = null
			if (id == null) {
				console.log("offset = none");
				url = `${site}/v2/user/dashboard?npf=true&reblog_info=true&notes_info=true&limit=20`;
			}
			else {
				const offset = (requestLimit - limit) * 20;
				console.log(`offset = ${offset}`);
				url = `${site}/v2/user/dashboard?npf=true&reblog_info=true&notes_info=true&limit=20&offset=${offset}`;
			}
			
			console.log(`doIncrementalLoad = ${doIncrementalLoad}, id = ${id}`);
			
			sendRequest(url, "GET")
			.then((text) => {
				//console.log(text);
				let lastId = null;
				
				const jsonObject = JSON.parse(text);
				const items = jsonObject.response.posts;
				for (const item of items) {
					const post = postForItem(item);
					if (post != null) {
						results.push(post);
						lastId = item["id"];
					}
				}
				
				const newLimit = limit - 1;
				
				if (lastId != null && newLimit > 0 && doIncrementalLoad == false) {
					requestToId(lastId, doIncrementalLoad, resolve, reject, newLimit, results);
				}
				else {
					resolve(results);
				}
			})
			.catch((error) => {
				reject(error);
			});	
		}

		const requestLimit = 10;
		requestToId(null, doIncrementalLoad, resolve, reject, requestLimit);

	});
	
}

//var doIncrementalLoad = false;
var doIncrementalLoad = true;

function load() {
	queryDashboard(doIncrementalLoad)
	.then((results) =>  {
		console.log(`finished dashboard`);
		processResults(results, true);
		doIncrementalLoad = true;
	})
	.catch((requestError) => {
		console.log(`error dashboard`);
		processError(requestError);
		doIncrementalLoad = false;
	});	
}

// returns the number of Unicode code points in a JavaScript string
// derived from: https://coolaj86.com/articles/how-to-count-unicode-characters-in-javascript/
function countCodePoints(str) {
	let len = 0;
	let index = 0;
	while (index < str.length) {
		let point = str.codePointAt(index);
      	let width = 0;
		while (point) {
			width += 1;
			point = point >> 8;
		}
		index += Math.round(width/2);
		len += 1;
	}
	return len;
}