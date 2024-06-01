
// org.jsonfeed

function verify() {
	sendRequest(site)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const identifier = jsonObject["title"];
		const icon = jsonObject["icon"];
		const baseUrl = jsonObject["home_page_url"];
		const verification = {
			displayName: identifier,
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
		const feedName = jsonObject["title"];
		const feedAvatar = jsonObject["icon"];
		var creator = Creator.createWithUriName(feedUrl, feedName)
		if (feedAvatar != null) {
			creator.avatar = feedAvatar
		}
		else {
			const homePage = jsonObject["home_page_url"];
			creator.avatar = homePage + "/apple-touch-icon.png"
		}
		
		const items = jsonObject["items"];
		var results = [];
		for (const item of items) {
			const url = item["url"];
			const date = new Date(item["date_published"]); // could also be "date_modified"
			const content = item['content_html'];
			const post = Post.createWithUriDateContent(url, date, content);
			post.creator = creator;
			
			results.push(post);
		}
		processResults(results);
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}
