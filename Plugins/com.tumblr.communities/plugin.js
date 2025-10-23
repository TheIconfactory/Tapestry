
// com.tumblr.communities

if (require('tumblr-shared.js') === false) {
    throw new Error("Failed to load tumblr-shared.js");
}

async function verify() {
	try {
		const response = await sendRequest(`${site}/v2/communities/${communityHandle}`);
		const json = JSON.parse(response);

		if (json.response.is_member == false) {
			throw new Error("You are not a member of this community. Join it on Tumblr.");
		}
		
		const displayName = json.response.title ?? communityHandle;
		let icon = null
		if (json.response.avatar_image != null && json.response.avatar_image.length > 0) {
			icon = json.response.avatar_image[0].url;
		}
		
		const verification = {
			displayName: displayName,
			icon: icon
		};
		processVerification(verification);
	}
	catch (error) {
		processError(error);
	}
}

async function load() {
	let nowTimestamp = (new Date()).getTime();

	try {		
		// NOTE: The timeline will be filled up to the endDate, if possible.
		let endDate = null;
		let endDateTimestamp = getItem("endDateTimestamp");
		if (endDateTimestamp != null) {
			endDate = new Date(parseInt(endDateTimestamp));
		}
	
		let startTimestamp = (new Date()).getTime();
		
		const parameters = await queryTimeline(endDate);
		const results = parameters[0];
		const newestItemDate = parameters[1];
		processResults(results, true);
		setItem("endDateTimestamp", String(newestItemDate.getTime()));
		let endTimestamp = (new Date()).getTime();
		console.log(`finished dashboard: ${results.length} items in ${(endTimestamp - startTimestamp) / 1000} seconds`);
	}
	catch (error) {
		console.log(`error timeline`);
		processError(error);
	}
}

async function queryTimeline(endDate) {

	// NOTE: These constants are related to the feed limits within Tapestry - it doesn't store more than
	// 3,000 items or things older than 30 days.
	// In use, the Tumblr API returns a limited number of items (300-ish) over a shorter timespan. Paging back
	// through results (using offset) is fairly slow, and these requests have a 30 second timeout, so the
	// the maxInterval is shorter than on other platforms.
	const maxInterval = 2 * 24 * 60 * 60 * 1000; // days in milliseconds (approximately)
	const maxItems = 300;


	// this function is called recursively to load & process batches of posts into a single list of results
	async function requestBatch(endDate, href, newestItemDate, oldestItemDate, results = []) {
		let url = null
		if (href == null) {
			console.log("href = none");
			url = `${site}/v2/communities/${communityHandle}/timeline`;
		}
		else {
			console.log(`href = ${href}`);
			url = `${site}${href}`;
		}

		console.log(`==== REQUEST communityHandle = ${communityHandle}`);
		
		const text = await sendRequest(url, "GET");

		//console.log(text);
		let firstDate = null;
		let lastDate = null;
		let endUpdate = false;

		
		const jsonObject = JSON.parse(text);
		const timeline = jsonObject.response.timeline;
		const elements = timeline.elements;
		const nextHref = timeline._links.next.href;

		for (const element of elements) {
			const post = await postForElement(element);
			if (post != null) {
				results.push(post);
				
				if (element.is_pinned) {
					// ignore pinned posts since their date is often far in the past and will mess up endUpdate calculation
					continue;
				}
				
				const date = post.date;

				if (href == null) {
					firstDate = date;
				}
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
		
		console.log(`>>>> BATCH results = ${results.length}, endUpdate = ${endUpdate}`);
		console.log(`>>>>       first  = ${firstDate}`);
		console.log(`>>>>       last   = ${lastDate}`);
		console.log(`>>>>       newest = ${newestItemDate}`);
		
		if (!endUpdate && nextHref != null) {
			return await requestBatch(endDate, nextHref, newestItemDate, oldestItemDate, results);
		}
		else {
			return([results, newestItemDate]);
		}
	}

	console.log(`>>>> START endDate = ${endDate}`);
	
	const nowTimestamp = (new Date()).getTime();
	const pastTimestamp = (nowTimestamp - maxInterval);
	const oldestItemDate = new Date(pastTimestamp);
	console.log(`>>>> OLDEST date = ${oldestItemDate}`);
	
	const parameters = await requestBatch(endDate, null, null, oldestItemDate);
	const results = parameters[0];
	const newestItemDate = parameters[1];
	return([results, newestItemDate]);	
}

