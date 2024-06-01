
// local.ping

function verify() {
	if (typeof site !== 'undefined') {
		sendRequest(site, "HEAD")
		.then((dictionary) => {
			const jsonObject = JSON.parse(dictionary);
	
			const responseStatus = jsonObject["status"];
			if (responseStatus == 200) {
				// NOTE: The responseUrl may not be the same as the original url if there was a redirect.
				const responseUrl = jsonObject["url"];
				
				let icon = null
				let identifier = responseUrl;
				if (identifier.startsWith("https://")) {
					identifier = identifier.replace("https://", "");
				}
				else if (identifier.startsWith("http://")) {
					identifier = identifier.replace("http://", "");
				}
				if (identifier.endsWith("/")) {
					icon = responseUrl + "favicon.ico";
					identifier = identifier.substring(0, identifier.length - 1);
				}
				else {
					icon = responseUrl + "/favicon.ico";
				}
				
				const verification = {
					displayName: identifier,
					icon: icon
				};
				processVerification(identifier);
			}
			else {
				processError(Error("Failed to load site"));
			}
		})
		.catch((requestError) => {
			processError(requestError);
		});
	}
	else {
		processError(Error("Missing site"));
	}
}

function load() {
	sendRequest(site, "HEAD")
	.then((dictionary) => {
		const jsonObject = JSON.parse(dictionary);

		const responseStatus = jsonObject["status"];
		if (responseStatus != 200) {
			let date = new Date();
			let uri = `${site}?{date.valueOf()}`;
			let content = `<p>Response from ${site} failed with HTTP ${responseStatus} response.`;
			const post = Post.createWithUriDateContent(uri, date, content);
			processResults([post]);
		}
	})
	.catch((requestError) => {
		let date = new Date();
		let uri = `${site}?timestamp=${date.valueOf()}`;
		let content = `<p>Request to ${site} failed with <strong>${requestError}</strong></p>`;
		const post = Post.createWithUriDateContent(uri, date, content);
		processResults([post]);
	});
}
