
// com.tumblr

if (require('tumblr-shared.js') === false) {
    throw new Error("Failed to load tumblr-shared.js");
}

async function verify() {
	try {
		const blogName = await getBlogName();
		setItem("blogName", blogName);
		
		const displayName = blogName;
		const icon = "https://api.tumblr.com/v2/blog/" + blogName + "/avatar/96";

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
		let blogName = getItem("blogName");
		if (blogName == null) {
			blogName = await getBlogName();
			setItem("blogName", blogName);
		}
	
		// NOTE: The dashboard will be filled up to the endDate, if possible.
		let endDate = null;
		let endDateTimestamp = getItem("endDateTimestamp");
		if (endDateTimestamp != null) {
			endDate = new Date(parseInt(endDateTimestamp));
		}
	
		let startTimestamp = (new Date()).getTime();
		
		const parameters = await queryDashboard(endDate);
		const results = parameters[0];
		const newestItemDate = parameters[1];
		processResults(results, true);
		setItem("endDateTimestamp", String(newestItemDate.getTime()));
		let endTimestamp = (new Date()).getTime();
		console.log(`finished dashboard: ${results.length} items in ${(endTimestamp - startTimestamp) / 1000} seconds`);
	}
	catch (error) {
		console.log(`error dashboard`);
		processError(error);
	}
}

async function queryDashboard(endDate) {

	// NOTE: These constants are related to the feed limits within Tapestry - it doesn't store more than
	// 3,000 items or things older than 30 days.
	// In use, the Tumblr API returns a limited number of items (300-ish) over a shorter timespan. Paging back
	// through results (using offset) is fairly slow, and these requests have a 30 second timeout, so the
	// the maxInterval is shorter than on other platforms.
	const maxInterval = 1.5 * 24 * 60 * 60 * 1000; // days in milliseconds (approximately)
	const maxItems = 300;

	let newestItemDate = null;
	let oldestItemDate = null;
	
	return new Promise((resolve, reject) => {

		// this function is called recursively to load & process batches of posts into a single list of results
		function requestBatch(id, endDate, pass, resolve, reject, results = []) {
			let url = null
			if (id == null) {
				//console.log("offset = none");
				url = `${site}/v2/user/dashboard?npf=true&reblog_info=true&notes_info=true&limit=20`;
			}
			else {
				const offset = pass * 20;
				//console.log(`offset = ${offset}`);
				url = `${site}/v2/user/dashboard?npf=true&reblog_info=true&notes_info=true&limit=20&offset=${offset}`;
			}
			
			console.log(`==== REQUEST id = ${id}, pass = ${pass}`);
			
			sendRequest(url, "GET")
			.then((text) => {
				//console.log(text);
				let firstId = null;
				let firstDate = null;
				let lastId = null;
				let lastDate = null;
				let endUpdate = false;
				
				const jsonObject = JSON.parse(text);
				const items = jsonObject.response.posts;
				for (const item of items) {
					const post = postForItem(item, true);
					if (post != null) {
						results.push(post);

						const date = post.date;

						const currentId = item["id"];
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
				
				if (id == lastId) {
					console.log(`>>>> ID MATCH`);
					endUpdate = true;
				}
				if (pass >= 20) {
					console.log(`>>>> PASS OVERFLOW`);
					endUpdate = true;
				}
				if (results.length > maxItems) {
					console.log(`>>>> MAX`);
					endUpdate = true;
				}
				
				console.log(`>>>> BATCH results = ${results.length}, lastId = ${lastId}, endUpdate = ${endUpdate}`);
				console.log(`>>>>       first  = ${firstDate}`);
				console.log(`>>>>       last   = ${lastDate}`);
				console.log(`>>>>       newest = ${newestItemDate}`);
				
				if (!endUpdate && lastId != null) {
					requestBatch(lastId, endDate, pass + 1, resolve, reject, results);
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
			
		requestBatch(null, endDate, 0, resolve, reject);
	});
	
}
