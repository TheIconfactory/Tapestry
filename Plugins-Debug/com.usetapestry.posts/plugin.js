//let base = "http://braccio.local.:8080/";
let base = "https://files.iconfactory.net/tapestry/Screenshots/";

function verify() {
	const url = base + "content.json";
	sendRequest(url)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		console.log(`group = ${group}`);
		let service = jsonObject[group];		
		if (service != null) {
			let displayName = service["name"];
			let icon = base + "images/" + service["icon"];
			const verification = {
				displayName: displayName,
				icon: icon
			};
			processVerification(verification);
		}
		else {
			processError(`No service named '${service}`);
		}
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function load() {
	const url = base + "content.json";
	sendRequest(url)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		console.log(`group = ${group}`);
		let service = jsonObject[group];		
		if (service != null) {
			let displayName = service["name"];
			let icon = base + "images/" + service["icon"];
			let items = service["items"];
			for (const item of items) {
				const uri = item["uri"];
			}
			
			const now = new Date();
			var results = [];
			for (const item of items) {
				const url = item["uri"];
				const date = relativeDate(now, item["time"]);
				const body = item['body'];
				
				let identity = null;
				if (item["identity"] != null) {
					const name = item.identity["name"];
					identity = Identity.createWithName(name);
					if (item.identity["username"] != null) {
						identity.username = item.identity["username"];
					}
					if (item.identity["avatar"] != null) {
						identity.avatar = base + "images/" + item.identity["avatar"];
					}
				}
				
				let linkAttachment = null;
				let mediaAttachment = null;
				if (item["attachment"] != null) {
					if (item.attachment.type == "link") {
						linkAttachment = LinkAttachment.createWithUrl(item.attachment.url);
					}
					else if (item.attachment.type == "media") {
						if (item.attachment.image != null) {
							const url = base + "images/" + item.attachment.image;
							mediaAttachment = MediaAttachment.createWithUrl(url);
							if (item.attachment["aspectSize"] != null) {
								mediaAttachment.aspectSize = item.attachment.aspectSize;
							}
							if (item.attachment["text"] != null) {
								mediaAttachment.text = item.attachment.text;
							}
						}
						else if (item.attachment.audio != null) {
							const url = base + "audio/" + item.attachment.audio;
							mediaAttachment = MediaAttachment.createWithUrl(url);
							if (item.attachment["thumbnail"] != null) {
								mediaAttachment.thumbnail = base + "images/" + item.attachment.thumbnail;
							}
							if (item.attachment["text"] != null) {
								mediaAttachment.text = item.attachment.text;
							}
						}
					}
				}
								
				const resultItem = Item.createWithUriDate(url, date);
				resultItem.body = body;
				resultItem.author = identity;
				if (mediaAttachment != null) {
					resultItem.attachments = [mediaAttachment];
				}
				else if (linkAttachment != null) {
					resultItem.attachments = [linkAttachment];
				}
				
				results.push(resultItem);
			}
	
			processResults(results);

		}
		else {
			processError(`No service named '${service}`);
		}
	})
	.catch((requestError) => {
		processError(requestError);
	});

}

function relativeDate(now, minuteOffset) {
	let timestamp = now.valueOf();
	timestamp = timestamp - (minuteOffset * 60 * 1000);
	return new Date(timestamp);
}
