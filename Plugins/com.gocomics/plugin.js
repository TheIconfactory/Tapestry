
// com.gocomics

function verify() {
	const url = `${site}/${comicId.trim()}`;
	sendRequest(url)
	.then((html) => {

		const matches = html.matchAll(schemaRegex);
				
		let displayName = null;
		
		if (matches != null) {
			for (const match of matches) {
				try {
					const metadata = JSON.parse(match[1]);
					if (metadata["@type"] == "ComicSeries") {
						displayName = metadata["name"];
						break;
					}
				}
				catch (error) {
					console.log(`JSON.parse error = ${error}`);
				}
			}
		}
		
		if (displayName == null) {
			const properties = extractProperties(html);
	
			const title = properties["og:title"];
			if (title != null) {
				displayName = title.replace(/ by.*$/, "");
			}
		}
		
		if (displayName != null) {
/*		
			const avatarRegex = /<img.*?SiteImage\.jsx.*?src="([^"]+?)"\/>/

			const match = html.match(avatarRegex);
			let icon = null;
			if (match != null && match[1] != null) {
 				icon = match[1];
 			}
 			// icon is non-square with a circular crop:
 			// https://gocomicscmsassets.gocomics.com/staging-assets/assets/Global_Feature_Badge_Nancy_600_78e63ba574.png
*/

			// icon is favicon
			const icon = "https://assets.gocomics.com/assets/favicons/favicon-96x96-92f1ac367fd0f34bc17956ef33d79433ddbec62144ee17b40add7a6a2ae6e61a.png";
			
			const verifcation = {
				displayName: displayName,
				icon: icon
			};
			processVerification(verifcation);
		}
		else {
			processError(Error("Invalid Comic ID"));
		}
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

const schemaRegex = /<script type="application\/ld\+json">(.+?)<\/script>/g;

function load() {
	const url = `${site}/${comicId.trim()}`;

	//const extraHeaders = {"user-agent": "curl"}; 
	//sendRequest(url, "GET", null, extraHeaders)
	
	sendRequest(url)
	.then((html) => {
		const matches = html.matchAll(schemaRegex);
		
		const now = new Date();
		const today = Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(now);
		
		const year = now.getFullYear();
		const month = now.getMonth() + 1;
		const day = now.getDate();
		const timestamp = String(year) + "/" + String(month).padStart(2, "0") + "/" + String(day).padStart(2, "0");

		const contentUrl = `${site}/${comicId.trim()}/${timestamp}`;
		console.log(`contentUrl = ${contentUrl}`);
	
		let imageUrl = null;
		let description = null;
		let author = null;
		let creator = "GoComics";
		
		if (matches != null) {
			for (const match of matches) {
				try {
					const metadata = JSON.parse(match[1]);
					if (metadata["@type"] == "ImageObject") {
						if (metadata["datePublished"] != null) {
							if (metadata["datePublished"] == today) {
								//console.log(JSON.stringify(metadata, null, "    "));
								imageUrl = metadata["contentUrl"];
								// NOTE: No aspect ratio in metadata - use console.log to check on this in the future...
								if (metadata["author"] != null) {
									author = metadata["author"]["name"];
								}
								if (metadata["creator"] != null) {
									creator = metadata["creator"]["name"];
								}
								break;
							}
						}
					}
					else {
						//console.log(`Not image: ${JSON.stringify(metadata, null, "    ")}`);
					}
				}
				catch (error) {
					console.log(`JSON.parse error = ${error}`);
				}
			}
		}
	
		if (imageUrl != null) {
			const attachment = MediaAttachment.createWithUrl(imageUrl);
			if (description != null) {
				attachment.text = description;
			}
			attachment.mimeType = "image";
			console.log(`image = ${imageUrl}`);
							
			const publishedDate = new Date(today);
			const content = `<p>Published on ${publishedDate.toLocaleDateString()} at <a href="${url}">${creator}</a></p>`;
				
			const item = Item.createWithUriDate(contentUrl, publishedDate);
			item.body = content;
			item.attachments = [attachment];
	
			if (author != null) {
				let identity = Identity.createWithName(author);
				identity.uri = site + "/" + comicId.trim();
				item.author = identity;
			}
	
			processResults([item]);
		}
		else {
			processResults([]);
		}
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}

