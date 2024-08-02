
var lastUpdate = null;

function load() {
	if (lastUpdate != null) {
		// check the interval provided by the user
		console.log(`interval = ${interval}`);
		let delta = parseInt(interval) * 60000; // minute string → milliseconds
		let future = (lastUpdate.getTime() + delta);
		let now = (new Date()).getTime();
		if (now < future) {
			// time has not elapsed, process no results and return
			console.log(`time until next update = ${(future - now) / 1000} sec.`);
			processResults(null);
			return;
		}
	}
	
	const endpoint = `${site}/api`;
	sendRequest(endpoint)
	.then((text) => {
		const json = JSON.parse(text);

		let uri = site + `?value=${json.value}&timestamp=${json.timestamp}`;
		let date = new Date(json.timestamp * 1000); // seconds → milliseconds
	
		let src = "https://usetapestry.com" + json.image; // relative → absolute url
		
		let item = Item.createWithUriDate(uri, date);
		item.body = `<p>The Mystic 9-Ball says: <b>${json.description}</b></p>`;

//		item.title = "Shake it Up!";
		
// 		let annotation = Annotation.createWithText("The Iconfactory created");
// 		annotation.icon = "https://iconfactory.com/favicon.ico";
// 		annotation.uri = "https://iconfactory.com";
// 		item.annotations = [annotation];
		
// 		let identity = Identity.createWithName("Mister Mystic");
// 		identity.uri = "https://usetapestry.com/samples/mystic9ball";
// 		identity.username = "@HighRoller";
// 		identity.avatar = "https://usetapestry.com/samples/mystic9ball/images/9ball.png";
// 		item.author = identity;
		
		let mediaAttachment = MediaAttachment.createWithUrl(src);
		mediaAttachment.aspectSize = {width : 500, height: 500};
		mediaAttachment.text = `Mystic 9-Ball saying ${json.description}`;

 		item.attachments = [mediaAttachment];

// 		let linkAttachment = LinkAttachment.createWithUrl(uri);
// 		linkAttachment.type = "website";
// 		linkAttachment.title = "Shake It Up With The Mystic 9-Ball!";
// 		linkAttachment.subtitle = "Get fun answers to life’s toughest questions with the Mystic 9-Ball & its cryptic prognostications.";
// 		linkAttachment.image = "https://usetapestry.com/samples/mystic9ball/images/banner.png";
// 		linkAttachment.aspectSize = {width : 1024, height: 768};
// 		
// 		item.attachments = [mediaAttachment, linkAttachment];
				
		let items = [item];

		processResults(items);
		
		lastUpdate = new Date();
	})
	.catch((requestError) => {
		processError(requestError);
	});
}
