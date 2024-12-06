
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
					icon = lookupUrl(baseUrl);
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
	sendRequest(site)
	.then((xml) => {
		let jsonObject = xmlParse(xml);
				
		if (jsonObject.feed != null) {
			// Atom 1.0
			processError(new Error("Invalid feed format"));
		}
		else if (jsonObject.rss != null) {
			// RSS 2.0
			let icon = null;
			if (jsonObject.rss.channel["itunes:image$attrs"] != null) {
				icon = jsonObject.rss.channel["itunes:image$attrs"].href;
			}

			const items = jsonObject.rss.channel.item;
			var results = [];
			for (const item of items) {
				const url = item.link;
				const date = new Date(item.pubDate);
				
				let attachment = null;
				if (item["enclosure$attrs"] != null) {
					const enclosureUrl = item["enclosure$attrs"].url;
					if (enclosureUrl != null) {
						attachment = MediaAttachment.createWithUrl(enclosureUrl);
						if (item["itunes:image$attrs"] != null) {
							attachment.thumbnail = item["itunes:image$attrs"].href ?? icon;
						}
						else if (icon != null) {
							attachment.thumbnail = icon;
						}
						
						let text = "";
						if (item["itunes:duration"] != null) {
							let duration = item["itunes:duration"];
						
							if (parseInt(duration) == duration) {
								// duration is in seconds
								let date = new Date(0);
								date.setSeconds(parseInt(duration));
								text += "Duration: " + date.toISOString().slice(11,19);
							}
							else {
								// duration is in some other format
								text += "Duration: " + duration;
							}
						}
						if (item["itunes:episode"] != null) {
							let episode = item["itunes:episode"];
							if (text.length != 0) {
								text += "\n";
							}
							text += "Episode: " + episode;
						}
						
						if (text.length > 0) {
							attachment.text = text;
						}
					}
				}

				let title = null;
				let subtitle = null;
				let description = null;
				
				if (item["itunes:title"] != null) {
					title = item["itunes:title"];
				}
				else {
					title = item["title"];
				}
				if (item["itunes:subtitle"] != null) {
					subtitle = item["itunes:subtitle"];
				}
				if (item["description"] != null) {
					description = item["description"];
				}

				let content = "";
				if (subtitle != null) {
					content += `<p><em>${subtitle}</em></p>`;
				}
				if (description != null) {
					content += `<p>${description}</p>`;
				}
				
				const resultItem = Item.createWithUriDate(url, date);
				resultItem.title = title;
				resultItem.body = content;
				if (attachment != null) {
					resultItem.attachments = [attachment];
				}
				
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
