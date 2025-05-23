
// local.ping

function verify() {
	sendRequest(site, "GET", null, null, true)
	.then((text) => {
		const response = JSON.parse(text);
		console.log(`response.status = ${response.status}`);

		if (response.status == 200) {
			// NOTE: The response.url may not be the same as the original url if there was a redirect.
			let displayName = response.url;
			if (displayName.startsWith("https://")) {
				displayName = displayName.replace("https://", "");
			}
			else if (displayName.startsWith("http://")) {
				displayName = displayName.replace("http://", "");
			}
			if (displayName.endsWith("/")) {
				displayName = displayName.substring(0, displayName.length - 1);
			}
			
			lookupIcon(response.url).then((icon) => {
				const verification = {
					displayName: displayName,
					icon: icon
				};
				processVerification(verification);				
			});
			//processVerification(displayName);
		}
		else {
			processError(Error("Failed to load site"));
		}
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function load() {
	console.log(`site = ${site}`);
	sendRequest(site, "GET", null, null, true)
	.then((text) => {
		const response = JSON.parse(text);
		console.log(`response.status = ${response.status}`);

		if (response.status != 200) {
			let date = new Date();
			let uri = `${site}?{date.valueOf()}`;
			let content = `<p>Response from ${site} failed with HTTP ${responseStatus} response.`;
			const resultItem = Item.createWithUriDate(uri, date);
			resultItem.body = content;
			processResults([resultItem]);
		}
		else {
			console.log(`response.url = ${response.url}`);
			console.log(JSON.stringify(response.headers, null, "    "));
			processResults(null);
		}
	})
	.catch((requestError) => {
		if (requestError == "Error: cancelled") {
			// ignore errors from cancelled (background) refreshes
			processResults(null);
		}
		else {
			let date = new Date();
			let uri = `${site}?timestamp=${date.valueOf()}`;
			let content = `<p>Request to ${site} failed with <strong>${requestError}</strong></p>`;
			const resultItem = Item.createWithUriDate(uri, date);
			resultItem.body = content;
			processResults([resultItem]);
		}
	});
}
