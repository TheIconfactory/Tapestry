// org.joinpeertube

function identify() {
	setIdentifier(channelID);
}

function load() {
	sendRequest(site + "/api/v1/videos?channelId=" + channelID + "&perPage=2&page=1")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const videos = jsonObject["data"];
		var results = [];
		
		for (const video of videos) {
			const url = video.url;
			const date = new Date(video.createdAt);
			const content = video.name + "\n\n" + video.description;
			
			const displayName = video.account.displayName;
			const accountURL = video.account.url;
			
			const creator = Creator.createWithUriName(accountURL, displayName);
			creator.avatar = "https://" + video.account.host + video.account.avatars[1].path;
			
			var post = Post.createWithUriDateContent(url, date, content);
			
			post.creator = creator;
			
			results.push(post);
		}
		
		processResults(results);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}
