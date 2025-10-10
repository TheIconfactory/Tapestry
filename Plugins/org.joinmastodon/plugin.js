
// org.joinmastodon

if (require('mastodon-shared.js') === false) {
	throw new Error("Failed to load mastodon-shared.js");
}

function verify() {
	sendRequest(site + "/api/v1/accounts/verify_credentials")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const instance = site.split("/")[2] ?? "";
		const displayName = "@" + jsonObject["username"] + "@" + instance;
		const icon = jsonObject["avatar"];

		const userId = jsonObject["id"];
		setItem("userId", userId);
		
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

var userId = getItem("userId");

// NOTE: This reference counter tracks loading so we can let the app know when all async loading work is complete.
var loadCounter = 0;

function load() {
	// NOTE: The home timeline will be filled up to the endDate, if possible.
	let endDate = null;
	let endDateTimestamp = getItem("endDateTimestamp");
	if (endDateTimestamp != null) {
		endDate = new Date(parseInt(endDateTimestamp));
	}
	
	loadCounter = 0;
	if (includeHome == "on") {
		loadCounter += 1;
	}
	if (includeMentions == "on") {
		loadCounter += 1;
	}
	if (includeStatuses == "on") {
		loadCounter += 1;
	}
	if (loadCounter == 0) {
		processResults([]);
		return;
	}
				
	if (includeHome == "on") {
		let startTimestamp = (new Date()).getTime();

		queryHomeTimeline(endDate)
  		.then((parameters) =>  {
  			results = parameters[0];
  			newestItemDate = parameters[1];
  			loadCounter -= 1;
			processResults(results, loadCounter == 0);
			setItem("endDateTimestamp", String(newestItemDate.getTime()));
			let endTimestamp = (new Date()).getTime();
 			console.log(`finished home timeline, loadCounter = ${loadCounter}: ${results.length} items in ${(endTimestamp - startTimestamp) / 1000} seconds`);
		})
		.catch((requestError) => {
  			loadCounter -= 1;
  			console.log(`error home timeline, loadCounter = ${loadCounter}`);
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

	if (includeStatuses == "on") {
		if (userId != null) {
			queryStatusesForUser(userId)
			.then((results) =>  {
				loadCounter -= 1;
  				console.log(`finished (cached) user statuses, loadCounter = ${loadCounter}`);
				processResults(results, loadCounter == 0);
			})
			.catch((requestError) => {
  				loadCounter -= 1;
  				console.log(`error (cached) user statuses, loadCounter = ${loadCounter}`);
				processError(requestError);
			});	
		}
		else {
			sendRequest(site + "/api/v1/accounts/verify_credentials")
			.then((text) => {
				const jsonObject = JSON.parse(text);
				
				userId = jsonObject["id"];
				setItem("userId", userId);

				queryStatusesForUser(userId)
				.then((results) =>  {
					loadCounter -= 1;
	  				console.log(`finished user statuses, loadCounter = ${loadCounter}`);
					processResults(results, loadCounter == 0);
				})
				.catch((requestError) => {
					loadCounter -= 1;
  					console.log(`error user statuses, loadCounter = ${loadCounter}`);
					processError(requestError);
				});	
			})
			.catch((requestError) => {
				processError(requestError);
			});
		}
	}
}

function queryHomeTimeline(endDate) {

	// NOTE: These constants are related to the feed limits within Tapestry - it doesn't store more than
	// 3,000 items or things older than 30 days.
	// In use, the Mastodon API returns a limited number of items (800-ish) over a shorter timespan.
	const maxInterval = 3 * 24 * 60 * 60 * 1000; // days in milliseconds (approximately)
	const maxItems = 800;

	let newestItemDate = null;
	let oldestItemDate = null;
	
	return new Promise((resolve, reject) => {

		// this function is called recursively to load & process batches of posts into a single list of results
		function requestToId(id, endDate, resolve, reject, results = []) {
			let url = null
			if (id == null) {
				url = `${site}/api/v1/timelines/home?limit=40`;
			}
			else {
				url = `${site}/api/v1/timelines/home?limit=40&since_id=1&max_id=${id}`;
			}
			
			console.log(`==== REQUEST id = ${id}`);
			
			sendRequest(url, "GET")
			.then((text) => {
				//console.log(text);
				let lastId = null;
				let lastDate = null;
				let endUpdate = false;
				const jsonObject = JSON.parse(text);
				for (const item of jsonObject) {
					const date = new Date(item["created_at"]);

					const post = postForItem(item);

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
					
					results.push(post);
		
					lastId = item["id"];
					lastDate = date;
				}

				if (results.length > maxItems) {
					console.log(`>>>> MAX`);
					endUpdate = true;
				}
				
				console.log(`>>>> BATCH results = ${results.length}, lastId = ${lastId}, endUpdate = ${endUpdate}`);
				console.log(`>>>>       last   = ${lastDate}`);
				console.log(`>>>>       newest = ${newestItemDate}`);
				
				// NOTE: endUpdate signifies a date or count threshold has been reached, lastId indicates the API returned no items.
				if (!endUpdate && lastId != null) {
					requestToId(lastId, endDate, resolve, reject, results);
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
			
		requestToId(null, endDate, resolve, reject);

	});
	
}

function queryMentions() {

	return new Promise((resolve, reject) => {
		sendRequest(site + "/api/v1/notifications?types%5B%5D=mention&limit=80", "GET")
		.then((text) => {
			const jsonObject = JSON.parse(text);
			let results = [];
			for (const item of jsonObject) {
				const postItem = item["status"];
				// NOTE: Not sure why this happens, but sometimes a mention payload doesn't have a status. If that happens, we just skip it.
				if (postItem != null) {
					results.push(postForItem(postItem));
				}
			}
			resolve(results);
		})
		.catch((error) => {
			reject(error);
		});
	});
	
}

function queryStatusesForUser(id) {

	return new Promise((resolve, reject) => {
		sendRequest(site + "/api/v1/accounts/" + id + "/statuses?limit=40", "GET")
		.then((text) => {
			const jsonObject = JSON.parse(text);
			let results = [];
			for (const item of jsonObject) {
				results.push(postForItem(item));
			}
			resolve(results);
		})
		.catch((error) => {
			reject(error);
		});
	});
	
}


