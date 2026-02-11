
// org.joinmastodon

if (require('mastodon-shared.js') === false) {
	throw new Error("Failed to load mastodon-shared.js");
}

function verify() {
	sendRequest(site + "/api/v1/accounts/verify_credentials")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const instance = site.split("/")[2] ?? "";
		const accountName = jsonObject["display_name"];
		const fullUsername = "@" + jsonObject["username"] + "@" + instance;
		const icon = jsonObject["avatar"];

		const userId = jsonObject["id"];
		setItem("userId", userId);

		const verification = {
			displayName: fullUsername,
			accountIdentity: Identity.create(accountName, fullUsername, icon)
		};
		processVerification(verification);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

var userId = getItem("userId");

async function load() {
	// NOTE: The home timeline will be filled up to the endDate, if possible.
	let endDate = null;
	let endDateTimestamp = getItem("endDateTimestamp");
	if (endDateTimestamp != null) {
		endDate = new Date(parseInt(endDateTimestamp));
	}
	
	if (includeHome == "on") {
		const parameters = await queryHomeTimeline(endDate);
  		const results = parameters[0];
  		const newestItemDate = parameters[1];
		processResults(results, false);
		if (newestItemDate) {
			setItem("endDateTimestamp", String(newestItemDate.getTime()));
		}
	}
	
	if (includeMentions == "on") {
		const results = await queryMentions();
		processResults(results, false);
	}

	if (includeStatuses == "on") {
		if (userId != null) {
			const results = await queryStatusesForUser(userId);
			processResults(results, false);
		}
		else {
			const text = await sendRequest(site + "/api/v1/accounts/verify_credentials");
			const jsonObject = JSON.parse(text);
			
			userId = jsonObject["id"];
			setItem("userId", userId);

			const results = await queryStatusesForUser(userId);
			processResults(results, false);
		}
	}

	// All done.
	processResults([], true);
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

					let post = null;
					if (item.reblog != null && includeBoosts != "on") {
						// skip boosts
					}
					else if (item.quote != null && includeQuotes != "on") {
						// skip quotes
					}
					else {
						post = postForItem(item);
					}

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
					
					if (post != null) {
						results.push(post);
					}
		
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

async function queryMentions() {
	const text = await sendRequest(site + "/api/v1/notifications?types%5B%5D=mention&limit=80", "GET");
	const jsonObject = JSON.parse(text);
	let results = [];
	for (const item of jsonObject) {
		const postItem = item["status"];
		// NOTE: Not sure why this happens, but sometimes a mention payload doesn't have a status. If that happens, we just skip it.
		if (postItem != null) {
			results.push(postForItem(postItem));
		}
	}
	return results;
}

async function queryStatusesForUser(id) {
	const text = await sendRequest(site + "/api/v1/accounts/" + id + "/statuses?limit=40", "GET");
	const jsonObject = JSON.parse(text);
	let results = [];
	for (const item of jsonObject) {
		if (item.reblog != null && includeBoosts != "on") {
			continue;
		}
		if (item.quote != null && includeQuotes != "on") {
			continue;
		}
		results.push(postForItem(item));
	}
	return results;
}
