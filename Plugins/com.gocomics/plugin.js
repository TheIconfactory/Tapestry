
// com.gocomics

function identify() {
	if (comicId != null && comicId.length > 0) {
		const baseUrl = "https://www.gocomics.com";
		const url = baseUrl + "/" + comicId;
		sendRequest(url, "HEAD")
		.then((dictionary) => {
			const jsonObject = JSON.parse(dictionary);
			
			const responseUrl = jsonObject["url"];
			
			// NOTE: If the responseUrl is the same as the original url, there was no redirect
			// and the comicId is valid.
			if (responseUrl == url) {
				setIdentifier(comicId);
			}
			else {
				setIdentifier(null);
			}
		})
		.catch((requestError) => {
			setIdentifier(null);
		});
	}
	else {
		setIdentifier(null);
	}
}


/*
 NOTE: The regular expression below will match the meta properties in the HTML, which are then put into a
 dictionary as key/value pairs.
 
 This is a sample of what the properties look like:
 
 <meta property="og:url" content="https://www.gocomics.com/nancy/2023/04/03" />
 <meta property="og:type" content="article" />
 <meta property="og:title" content="Nancy by Olivia Jaimes for April 03, 2023 | GoComics.com" />
 <meta property="og:image" content="https://assets.amuniversal.com/e7430910aeeb013bef63005056a9545d" />
 <meta property="og:image:height" content="276" />
 <meta property="og:image:width" content="900" />
 <meta property="og:description" content="" />
 <meta property="og:site_name" content="GoComics" />
 <meta property="fb:app_id" content="1747171135497727" />
 
 <meta property="article:published_time" content="2023-04-03" />
 <meta property="article:author" content="Olivia Jaimes" />
 <meta property="article:section" content="comic" />
 <meta property="article:tag" content="" />
 */

const metaRegex = /<meta\s+property=\"(.*)\"\s+content=\"(.*)\".*>/g

function metaProperties(html) {
	var properties = {};
	
	const matches = html.matchAll(metaRegex);
	for (const match of matches) {
		const key = match[1];
		const value = match[2];
		properties[key] = value;
	}

	return properties;
}

const avatarRegex = /<div class="gc-avatar gc-avatar--creator xs"><img[^]*?src="(.*)"/

var lastTimestamp = null

function load() {
	const baseUrl = "https://www.gocomics.com";
	const date = new Date();
	
	const year = date.getFullYear();
	const month = date.getMonth() + 1;
	const day = date.getDate();
	
	const timestamp = String(year) + "/" + String(month).padStart(2, "0") + "/" + String(day).padStart(2, "0");
	
	if (timestamp == lastTimestamp) {
		return;
	}
	
	const url = baseUrl + "/" + comicId + "/" + timestamp;
	sendRequest(url)
	.then((html) => {
		const properties = metaProperties(html);
		
		const image = properties["og:image"];
		const title = properties["og:title"];
		const url = properties["og:url"];
		const siteName = properties["og:site_name"];
		const author = properties["article:author"];
		
		if (image != null) {
			const media = image;
			const attachment = Attachment.createWithMedia(media);
			attachment.text = title;
			
			const text = title.replace(/\| GoComics.com$/, "at <a href=\"" + url + "\">" + siteName + "</a>");
			
			const content = "<p>" + text + "</p>";
			const post = Post.createWithUriDateContent(url, date, content);
			post.attachments = [attachment];

			const match = html.match(avatarRegex);
			const avatar = match[1];

			const creatorUrl = baseUrl + "/" + comicId;
			const creatorName = author;
			const creator = Creator.createWithUriName(creatorUrl, creatorName);
			creator.avatar = avatar;
			
			post.creator = creator;
			
			processResults([post]);
			
			lastTimestamp = timestamp;
		}
	})
	.catch((requestError) => {
		// NOTE: It's possible that the comic for the day has not been posted yet (timezones, yay). So fail silently.
		//processError(requestError);
	});
	
}
