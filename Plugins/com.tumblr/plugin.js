
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
	const blog = item.blog;
	const identity = Identity.createWithName(blog.name);
	identity.uri = blog.url;
	identity.username = blog.title;
	identity.avatar = "https://api.tumblr.com/v2/blog/" + blog.name + "/avatar/96";

	const uri = item.post_url;
	const date = new Date(item.timestamp * 1000); // timestamp is seconds since the epoch, convert to milliseconds
	
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
		console.log(`ignored item.type = ${item.type}`);
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
		return post;
	}
	else {
		return null;
	}
}

function queryDashboard(doIncrementalLoad) {

	return new Promise((resolve, reject) => {

		// this function is called recursively to load & process batches of posts into a single list of results
		function requestToId(id, doIncrementalLoad, resolve, reject, limit = 5, results = []) {
			let url = null
			if (id == null) {
				console.log("offset = none");
				url = `${site}/v2/user/dashboard?limit=20`;
			}
			else {
				const offset = (requestLimit - limit) * 20;
				console.log(`offset = ${offset}`);
				url = `${site}/v2/user/dashboard?limit=20&offset=${offset}`;
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

// NOTE: The connector does incremental loads (only most recent items in dashboard) until 6 hours have
// elapsed since the last full load (200 items in dashboard). The idea here is that this covers cases where
// this script is still in memory, but hasn't been accessed while the device/user is sleeping.
var lastFullUpdate = null;
const fullUpdateInterval = 6 * 60 * 60;

function load() {
	let doIncrementalLoad = false;
	if (lastFullUpdate != null) {
		// check the interval provided by the user
		console.log(`fullUpdateInterval = ${fullUpdateInterval}`);
		let delta = fullUpdateInterval * 1000; // seconds → milliseconds
		let future = (lastFullUpdate.getTime() + delta);
		console.log(`future = ${new Date(future)}`);
		let now = (new Date()).getTime();
		if (now < future) {
			// time has not elapsed, do an incremental load
			console.log(`time until next update = ${(future - now) / 1000} sec.`);
			doIncrementalLoad = true;
		}
	}
	if (!doIncrementalLoad) {
		lastFullUpdate = new Date();
	}

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

/*
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
*/
}
