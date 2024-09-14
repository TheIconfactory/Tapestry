
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
	let isReblog = false;
	if (item.parent_post_url != null) {
		isReblog = true;
	}

	let identity = null;
	let annotation = null;
	if (isReblog) {
		if (item.trail != null && item.trail.length > 0) {
			let lastTrail = item.trail[0];
			
			const blog = lastTrail.blog;
			identity = Identity.createWithName(blog.name);
			identity.uri = blog.url;
			identity.username = blog.title;
			identity.avatar = "https://api.tumblr.com/v2/blog/" + blog.name + "/avatar/96";
			
			const itemBlog = item.blog;
			const userName = itemBlog.name;
			const text = "Reblogged by " + userName;
			annotation = Annotation.createWithText(text);
			annotation.icon = "https://api.tumblr.com/v2/blog/" + itemBlog.name + "/avatar/96";
			annotation.uri = item.post_url;
		}
	}
	else {
		const blog = item.blog;
		identity = Identity.createWithName(blog.name);
		identity.uri = blog.url;
		identity.username = blog.title;
		identity.avatar = "https://api.tumblr.com/v2/blog/" + blog.name + "/avatar/96";
	}
	
	const uri = item.post_url;
	const date = new Date(item.timestamp * 1000); // timestamp is seconds since the epoch, convert to milliseconds
	
	// item.tags = ["tweets", "white people twitter", "funny tweets"]
	// linked as: https://www.tumblr.com/tagged/white%20people%20twitter
	
	// parent_post_url != null if a reblog

// 	let lastTrail = null;
// 	if (item.parent_post_url != null) {
// 		// this is a reblog
// 		if (item.trail != null && item.trail.length > 0) {
// 			lastTrail = item.trail[0];
// 		}
// 	}
	
// 	let annotation = null;
// 	if (lastTrail != null) {
// 		const userName = lastTrail.blog.name;
// 		const text = "Reblogged " + userName;
// 		annotation = Annotation.createWithText(text);
// 		annotation.uri = item.parent_post_url;
// 	}
	
	let text = "";
	let attachments = [];
	if (item.type == "blocks") {
		//text = item.summary;
		console.log(`item.summary = ${item.summary}`);
		console.log(`item.content.length = ${item.content.length}`);
		for (const itemContent of item.content) {
			switch (itemContent.type) {
			case "text":
				console.log(`itemContent.text = ${itemContent.text}`);
				text += itemContent.text;
				break;
			case "image":
				if (itemContent.media != null && itemContent.media.length > 0) {
					const mediaProperties = itemContent.media[0];

					const attachment = MediaAttachment.createWithUrl(mediaProperties.url);
					attachment.text = itemContent.alt_text;
					attachment.mimeType = mediaProperties.type;
					attachment.aspectSize = {width: mediaProperties.width, height: mediaProperties.height};
					if (mediaProperties.poster != null) {
						attachment.thumbnail = mediaProperties.poster.url;
					}
					attachments.push(attachment);
				}
				break;
// 			case "link":
// 				break;
// 			case "audio":
// 				break;
// 			case "video":
// 				break;
// 			case "paywall":
// 				break;
			default:
				text += `*** ${itemContent.type} not handled ***`;
			}
		}
	}
// 	else if (item.type == "photo") {
// 		if (lastTrail != null) {
// 			text = lastTrail.content;
// 		}
// 		else {
// 			text = item.caption;
// 		}
// 					
// 		attachments = [];
// 		let photos = item.photos;
// 		let count = photos.length;
// 		for (let index = 0; index < count; index++) {
// 			let photo = photos[index];
// 			const media = photo.original_size.url;
// 			const attachment = MediaAttachment.createWithUrl(media);
// 			attachment.text = item.summary;
// 			attachment.mimeType = "image";
// 			attachments.push(attachment);
// 		}
// 	}
// 	else if (item.type == "video") {
// 		if (lastTrail != null) {
// 			text = lastTrail.content;
// 		}
// 		else {
// 			text = item.body;
// 		}
// 	}
// 	else if (item.type == "text") {
// 		if (lastTrail != null) {
// 			text = lastTrail.content;
// 		}
// 		else {
// 			text = item.body;
// 		}
// 	}
// 	else {
// 		console.log(`ignored item.type = ${item.type}`);
// 	}
	
	//if (text.length != 0) {
		const post = Item.createWithUriDate(uri, date);
		post.body = text;
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
	//}
	//else {
	//	return null;
	//}
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