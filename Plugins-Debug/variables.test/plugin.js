
// variables.test

function verify() {
	const verification = {
		displayName: title,
		icon: "https://iconfactory.com/favicon.ico"
	};
	processVerification(verification)
}

function load() {
	const bogusDate = new Date(2999, 0, 1);
	const bogusItem = Item.createWithUriDate("https://example.com/bogus", bogusDate);
	bogusItem.body = "Back to the future.";
	processResults([bogusItem], false);
	
	headers = {
		"X-CLIENT-ID": "My __CLIENT_ID__",
		"X-ACCESS_TOKEN": "__ACCESS_TOKEN__"
	};
	sendRequest("https://example.com", "GET", "client_id=__CLIENT_ID__&access_token=__ACCESS_TOKEN__", headers)
	.then((text) => {
		console.log("got response");
		let uri = "custom://variables.test";
		let date = new Date();
		let status = ""
		if (reticulate_splines == "on") {
			status = "Splines are being reticulated";
		}
		if (turbo == "on") {
			if (status.length > 0) {
				status += " and ";
			}
			status += "TURBO is engaged";
		}
		status += ` at level ${value}`;
		
		let content = `<p>Test content for ${site} & ${title}</p><p>${status}</p><blockquote><p>For dessert, you'll be having ${dessert_choice}. Enjoy!</p></blockquote><p><a href="https://streamer.iconfactory.net">Check user agent in logs</a></p>`
		
		const resultItem = Item.createWithUriDate(uri, date);
		resultItem.body = content;
		let object = {abc: 123, def: "xyz"};
		let payload = JSON.stringify(object);
		resultItem.actions = { favorite: payload, boost: "456" };
		resultItem.shortcodes = { "ONE": "https://example.com/one.jpg", "CHOCK": "http://chocklock.com/favicon.ico" };
		resultItem.annotations = [Annotation.createWithText("Test")];
		processResults([resultItem]);
	})
	.catch((error) => {
		processError(error);
	});
}

function performAction(actionId, value, item) {
	console.log(`actionId = ${actionId}`);
	if (actionId == "favorite") {
		try {
			let object = JSON.parse(value);
			console.log(`value = ${JSON.stringify(object, null, 4)}`);
		}
		catch (error) {
			console.log(`value = ${value}`);
		}
		let content = item.body;
		content += "<p>Faved!</p>";
		item.body = content;
		
		let shortcodes = item.shortcodes;
		shortcodes["NEW"] = "https://example.com/new.png";
		item.shortcodes = shortcodes;
		
		let actions = item.actions;
		delete actions["favorite"];
		actions["unfavorite"] = "nah";
		item.actions = actions;
		actionComplete(item, null);
	}
	else if (actionId == "unfavorite") {
		console.log(`value = ${value}`);
		let content = item.body;
		content += "<p><strong>UNFAVED!</strong></p>";
		item.body = content;

		let actions = item.actions;
		delete actions["unfavorite"];
		actions["favorite"] = "yay";
		item.actions = actions;
		actionComplete(item, null);
	}
	else if (actionId == "boost") {
		const delay = 2000;
		let start = new Date().getTime();
		while (new Date().getTime() < start + delay);
		actionComplete(item, `can't handle value = ${value}`);
	}
	
}
