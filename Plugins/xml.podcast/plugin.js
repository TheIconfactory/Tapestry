
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
			const baseUrl = jsonObject.rss.channel.link;
			const displayName = jsonObject.rss.channel.title;
			
			let icon = null;
			if (jsonObject.rss.channel["itunes:image$attrs"] != null) {
				icon = jsonObject.rss.channel["itunes:image$attrs"].href;
			}
			else {
				if (jsonObject.rss.channel.image != null) {
					icon = jsonObject.rss.channel.image.url;
				}
				if (icon === null) {
					let baseUrl = baseUrl.split("/").splice(0,3).join("/");
					icon = baseUrl + "/favicon.ico";
				}
			}
			
			const verification = {
				displayName: displayName,
				icon: icon,
				baseUrl: baseUrl
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
			const items = jsonObject.rss.channel.item;
			var results = [];
			for (const item of items) {
				const url = item.link;
				const date = new Date(item.pubDate);
				
				const enclosureUrl = item["enclosure$attrs"].url;
				const attachment = MediaAttachment.createWithUrl(enclosureUrl);

				let title = null;
				let subtitle = null;
				let duration = null;
				
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
				//var description = item["description"];
				let description = "";
				if (subtitle != null) {
					description = "<em>" + subtitle + "</em>";
				}
				var content = `<p>${description}</p>`;
				if (duration != null) {
					content += `<p>Duration: ${duration}</p>`;
				}
				
				const resultItem = Item.createWithUriDate(url, date);
				resultItem.title = title;
				resultItem.body = content;
				resultItem.attachments = [attachment];
			
				results.push(resultItem);
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
