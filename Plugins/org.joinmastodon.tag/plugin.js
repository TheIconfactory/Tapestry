
// org.joinmastodon.tag

if (require('mastodon-shared.js') === false) {
	throw new Error("Failed to load mastodon-shared.js");
}

function verify() {
	const verifyTag = normalizeTag(tag);
	const url = `${site}/api/v1/timelines/tag/${verifyTag}`;
	sendRequest(url)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		if (jsonObject.length > 0) {
			const displayName = "#" + verifyTag;
			processVerification(displayName);
		}
		else {
			processError(Error("No items for tag."));
		}
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function load() {
	const loadTag = normalizeTag(tag);
	queryStatusesForTag(loadTag)
	.then((results) =>  {
		console.log(`finished (cached) feed`);
		processResults(results, true);
	})
	.catch((requestError) => {
		console.log(`error (cached) feed`);
		processError(requestError);
	});	
}

function queryStatusesForTag(tag) {

	return new Promise((resolve, reject) => {
		const url = `${site}/api/v1/timelines/tag/${tag}`;
		sendRequest(url)
		.then((text) => {
			const jsonObject = JSON.parse(text);
			let results = [];
			for (const item of jsonObject) {
				if (item.quote != null && includeQuotes != "on") {
					continue;
				}
				let post = postForItem(item);
				if (post != null) {
					let annotation = Annotation.createWithText(`#${tag.toUpperCase()}`);
					annotation.uri = `${site}/tags/${tag}`;
					post.annotations = [annotation].concat(post.annotations ?? []);

					results.push(post);
				}
			}
			resolve(results);
		})
		.catch((error) => {
			reject(error);
		});
	});
	
}
