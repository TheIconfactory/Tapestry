
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
		}
		else {
			icon = baseUrl + "/favicon.ico"
		}

		const verification = {
			displayName: displayName,
			icon: icon,
			baseUrl: baseUrl
		};
		processVerification(verification);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function load() {
	sendRequest(site)
	.then((text) => {
		const jsonObject = JSON.parse(text);

		const feedUrl = jsonObject["home_page_url"];
		
		const items = jsonObject["items"];
		var results = [];
		for (const item of items) {
			const url = item["url"];
			const date = new Date(item["date_published"]); // could also be "date_modified"
			const title = item['title'];
			const content = item['content_html'];
			const authors = item["authors"];
			
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
			resultItem.title = title;
			resultItem.body = content;
			resultItem.author = identity;
			
			results.push(resultItem);
		}

		processResults(results);
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}
