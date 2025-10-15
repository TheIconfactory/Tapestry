
// social.bsky

if (require('bluesky-shared.js') === false) {
    throw new Error("Failed to load bluesky-shared.js");
}

function verify() {
	sendRequest(site + "/xrpc/com.atproto.server.getSession")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		const displayName = "@" + jsonObject.handle;
		const did = jsonObject.did;

		setItem("did", did);
		setItem("didSelf", did);
		
		sendRequest(site + `/xrpc/app.bsky.actor.getProfile?actor=${did}`)
		.then((text) => {
			const jsonObject = JSON.parse(text);
			
			if (jsonObject.avatar != null) {
				const icon = jsonObject.avatar
				const verification = {
					displayName: displayName,
					icon: icon
				};
				processVerification(verification);
			}
			else {
				processVerification(displayName);
			}
		})
		.catch((requestError) => {
			processError(requestError);
		});
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

// NOTE: This reference counter tracks loading so we can let the app know when all async loading work is complete.
var loadCounter = 0;

async function load() {
	// NOTE: The timeline will be filled up to the endDate, if possible.
	let endDate = null;
	let endDateTimestamp = getItem("endDateTimestamp");
	if (endDateTimestamp != null) {
		endDate = new Date(parseInt(endDateTimestamp));
	}

	let didSelf = getItem("didSelf");
	if (didSelf == null) {
		didSelf = await getSessionDid();
		setItem("didSelf", didSelf);
	}

	loadCounter = 0;
	if (includeHome == "on") {
		loadCounter += 1;
	}
	if (includeMentions == "on") {
		loadCounter += 1;
	}
	if (loadCounter == 0) {
		processResults([]);
		return;
	}
	
	if (includeHome == "on") {
		let startTimestamp = (new Date()).getTime();
	
		queryTimeline(endDate)
		.then((parameters) =>  {
			results = parameters[0];
			newestItemDate = parameters[1];
  			loadCounter -= 1;
			processResults(results, loadCounter == 0);
			setItem("endDateTimestamp", String(newestItemDate.getTime()));
			let endTimestamp = (new Date()).getTime();
			console.log(`finished timeline: ${results.length} items in ${(endTimestamp - startTimestamp) / 1000} seconds`);
		})
		.catch((requestError) => {
			console.log(`error timeline`);
			processError(requestError);
		});
	}
	
	if (includeMentions == "on") {
		queryMentions()
		.then((results) =>  {
			loadCounter -= 1;
			console.log(`finished mentions, loadCounter = ${loadCounter}`);
			processResults(results, loadCounter == 0);
		})
		.catch((requestError) => {
			loadCounter -= 1;
			console.log(`error mentions, loadCounter = ${loadCounter}`);
			processError(requestError);
		});	
	}
}

function queryTimeline(endDate) {

	// NOTE: These constants are related to the feed limits within Tapestry - it doesn't store more than
	// 3,000 items or things older than 30 days.
	// The Bluesky API is fast and can return the maximum number of items with 30 seconds, but a week's
	// worth of content feels like a good amount to backfill.
	const maxInterval = 7 * 24 * 60 * 60 * 1000; // days in milliseconds (approximately)
	const maxItems = 1000;

	let newestItemDate = null;
	let oldestItemDate = null;

	return new Promise((resolve, reject) => {

		// this function is called recursively to load & process batches of posts into a single list of results
		function requestToCursor(cursor, endDate, resolve, reject, results = []) {
			let url = null
			if (cursor == null) {
				//console.log("cursor = none");
				url = `${site}/xrpc/app.bsky.feed.getTimeline?algorithm=reverse-chronological&limit=50`;
			}
			else {
				//console.log(`cursor = ${cursor}`);
				url = `${site}/xrpc/app.bsky.feed.getTimeline?algorithm=reverse-chronological&limit=50&cursor=${cursor}`;
			}
			
			console.log(`==== REQUEST cursor = ${cursor}`);
			
			sendRequest(url, "GET")
			.then((text) => {
				//console.log(text);
				let firstId = null;
				let firstDate = null;
				let lastId = null;
				let lastDate = null;
				let endUpdate = false;

				const jsonObject = JSON.parse(text);
				const items = jsonObject.feed
				for (const item of items) {
					const post = postForItem(item, true, null, false);
					if (post != null) {
						results.push(post);
						
						let date = new Date(item.post.indexedAt); // date of the post
						if (item.reason != null && item.reason.$type == "app.bsky.feed.defs#reasonRepost") {
							date = new Date(item.reason.indexedAt); // date of the repost
						}

						const currentId = item.post.uri.split("/").pop();

						if (firstId == null) {
							firstId = currentId;
							firstDate = date;
						}
						lastId = currentId;						
						lastDate = date;
						
						if (!endUpdate && date < endDate) {
							console.log(`>>>> END date = ${date}`);
							endUpdate = true;
						}
						if (date > newestItemDate) {
							console.log(`>>>> NEW date = ${date}`);
							newestItemDate = date;
						}
						if (date < oldestItemDate) {
							console.log(`>>>> OLD date = ${date}`);
							endUpdate = true;
						}

					}
				}
				if (results.length > maxItems) {
					console.log(`>>>> MAX`);
					endUpdate = true;
				}
				
				console.log(`>>>> BATCH results = ${results.length}, lastId = ${lastId}, endUpdate = ${endUpdate}`);
				console.log(`>>>>       first  = ${firstDate}`);
				console.log(`>>>>       last   = ${lastDate}`);
				console.log(`>>>>       newest = ${newestItemDate}`);
				
				const cursor = jsonObject.cursor;			

				if (!endUpdate && cursor != null) {
					requestToCursor(cursor, endDate, resolve, reject, results);
				}
				else {
					resolve([results, newestItemDate]);
				}
			})
			.catch((error) => {
				reject(error);
			});	
		}

		console.log(`>>>> START endDate = ${endDate}`);
		
		let nowTimestamp = (new Date()).getTime();
		let pastTimestamp = (nowTimestamp - maxInterval);
		oldestItemDate = new Date(pastTimestamp);
		console.log(`>>>> OLD date = ${oldestItemDate}`);

		requestToCursor(null, endDate, resolve, reject);
	});
	
}

function queryMentions() {

	return new Promise((resolve, reject) => {
		const url = `${site}/xrpc/app.bsky.notification.listNotifications?limit=100`;
		sendRequest(url)
		.then((text) => {
			const jsonObject = JSON.parse(text);

			let results = [];
			
			if (jsonObject.notifications != null) {
				for (const notification of jsonObject.notifications) {
					if (notification.reason != null && notification.reason == "mention") {
						const post = postForNotification(notification);
						results.push(post);
					}
				}
			}
			
			resolve(results);
		})
		.catch((error) => {
			reject(error);
		});
	});
	
}
