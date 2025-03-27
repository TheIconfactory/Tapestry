
// org.jsonfeed

function verify() {
	sendRequest(site)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const displayName = jsonObject["title"];
		const baseUrl = jsonObject["home_page_url"];
		
		var icon = null;
		if (jsonObject["icon"] != null) {
			icon = jsonObject["icon"];
			const verification = {
				displayName: displayName,
				icon: icon,
				baseUrl: baseUrl
			};
			processVerification(verification);
		}
		else {
			lookupIcon(baseUrl).then((icon) => {
				const verification = {
					displayName: displayName,
					icon: icon,
					baseUrl: baseUrl
				};
				processVerification(verification);
			});
		}

	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function load() {
	let extraHeaders = [];	
	let lastModified = getItem("lastModified");
	if (lastModified != null) {
		console.log(`lastModified = ${lastModified}`);
		extraHeaders["if-modified-since"] = lastModified;
	}
	let eTag = getItem("eTag");
	if (eTag != null) {
		console.log(`eTag = ${eTag}`);
		extraHeaders["if-none-match"] = eTag;
	}
	extraHeaders["accept-encoding"] = "gzip,deflate";
	
	sendRequest(site, "GET", null, extraHeaders, true)
	.then((text) => {
		const response = JSON.parse(text);
		console.log(`response.status = ${response.status}`);

		if (response.status != 200) {
			// 304, 500 and other non-200 responses return no results 
			processResults([]);
			return;
		}
		
		const headers = response.headers;
		if (headers["last-modified"] != null) {
			console.log(`headers["last-modified"] = ${headers["last-modified"]}`);
			setItem("lastModified", headers["last-modified"]);
		}
		if (headers["etag"] != null) {
			console.log(`headers["etag"] = ${headers["etag"]}`);
			let eTag = headers["etag"];
			if (eTag.startsWith("W/")) {
				eTag = eTag.substring(2);
				//eTag = eTag.slice(3, -1);
			}
			if (eTag.endsWith("-gzip\"")) {
				eTag = eTag.slice(0, -6) + "\"";
			}
			setItem("eTag", eTag);
		}

		const jsonObject = JSON.parse(response.body);
		//console.log(JSON.stringify(jsonObject, null, "  "));
		
		const feedUrl = jsonObject["home_page_url"];
		
		const items = jsonObject["items"];
		var results = [];
		for (const item of items) {
			let url = item["url"];
			if (true) { // NOTE: If this causes problems, we can put it behind a setting.
				const urlClean = url.split("?").splice(0,1).join();
				const urlParameters = url.split("?").splice(1).join("?");
				if (urlParameters.includes("utm_id") || urlParameters.includes("utm_source") || urlParameters.includes("utm_medium") || urlParameters.includes("utm_campaign")) {
					console.log(`removed parameters: ${urlParameters}`);
					url = urlClean;
				}
			}

			const date = new Date(item["date_published"]); // could also be "date_modified"
			const title = item['title'];
			let content = ""
			if (item['content_html'] != null) {
				content = item['content_html'];
			}
			else if (item['content_text'] != null) {
				content = item['content_text'].replaceAll("\n", "<br/>")
			}
			const authors = item["authors"];
			
			let linkAttachment = null;
			if (item["external_url"] != null) {
				linkAttachment = LinkAttachment.createWithUrl(item["external_url"]);
			}
			
			let identity = null;
			if (authors != null && authors.length > 0) {
				const authorName = authors[0].name;
				identity = Identity.createWithName(authorName);
				if (authors[0].url != null) {
					identity.uri = authors[0].url;
				}
				if (authors[0].avatar != null) {
					identity.avatar = authors[0].avatar;
				}
			}
			
			const resultItem = Item.createWithUriDate(url, date);
			if (title != null) {
				resultItem.title = title;
			}
			resultItem.body = content;
			resultItem.author = identity;
			if (linkAttachment != null) {
				resultItem.attachments = [linkAttachment];
			}
			
			results.push(resultItem);
		}

		processResults(results);
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}
