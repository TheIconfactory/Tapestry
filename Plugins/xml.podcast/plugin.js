
// xml.podcast

// Apple requirements: https://podcasters.apple.com/support/823-podcast-requirements

function verify() {
	sendRequest(site)
	.then((xml) => {	
		let jsonObject = xmlParse(xml);
		
		if (jsonObject.feed != null) {
			// Atom 1.0
			processError(Error("Invalid feed format"));
		}
		else if (jsonObject.rss != null) {
			// RSS 2.0
			const feedUrl = jsonObject.rss.channel.link;
			const feedName = jsonObject.rss.channel.title;
			
			let feedAvatar = null;
			if (jsonObject.rss.channel.image != null) {
				feedAvatar = jsonObject.rss.channel.image.url;
			}
			if (feedAvatar === null) {
				let baseUrl = feedUrl.split("/").splice(0,3).join("/");
				feedAvatar = baseUrl + "/favicon.ico";
			}

			const verification = {
				displayName: feedName,
				icon: feedAvatar,
				baseUrl: feedUrl
			};
			processVerification(verification);
		}
		else {
			// Unknown
			processError(Error("Unknown feed format"));
		}
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function load() {	
	console.log("load")
	sendRequest(site)
	.then((xml) => {
		
		let jsonObject = xmlParse(xml);
				
		if (jsonObject.feed != null) {
			// Atom 1.0
			processError(new Error("Invalid feed format"));
		}
		else if (jsonObject.rss != null) {
			// RSS 2.0
			const feedUrl = jsonObject.rss.channel.link;
			const feedName = jsonObject.rss.channel.title;
			var creator = Creator.createWithUriName(feedUrl, feedName);
			creator.avatar = jsonObject.rss.channel["itunes:image$attrs"].href;

			const items = jsonObject.rss.channel.item;
			var results = [];
			for (const item of items) {
				const url = item.link;
				const date = new Date(item.pubDate);
				
				const enclosureUrl = item["enclosure$attrs"].url;
				const attachment = Attachment.createWithMedia(enclosureUrl);

				var title = "";
				var subtitle = "";
				var duration = "";
				
				if (item["itunes:title"] != null) {
					title = item["itunes:title"];
				}
				else {
					title = item["title"];
				}
				if (item["itunes:subtitle"] != null) {
					subtitle = item["itunes:subtitle"];
				}
				if (item["itunes:duration"] != null) {
					duration = item["itunes:duration"];
				}
				var description = item["description"];
				if (title != "" && subtitle != "") {
					description = "<em>" + title + "</em>: " + subtitle
				}
				var content = "<p>";
				content += description;
				if (duration != "") {
					content += "<br/>Duration: " + duration;
				}
				content += "</p>";
				
				const post = Post.createWithUriDateContent(url, date, content);
				post.creator = creator;
				post.attachments = [attachment];
			
				results.push(post);
			}

			processResults(results);
		}
		else {
			// Unknown
			processResults([]);
		}
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}
