
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
		processResults([resultItem]);
	})
	.catch((error) => {
		processError(error);
	});
}
