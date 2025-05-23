function verify() {
	const timeout = (onVerify == "on");

	if (timeout) {
		// do nothing
	}
	else {
		const verification = {
			displayName: "Timeout",
		};
		processVerification(verification);
	}
}

function load() {
	const timeout = (onLoad == "on");
	if (timeout) {
		// do nothing
	}
	else {
		let date = new Date();
		let uri = `https://example.com/?timestamp=${date.getTime()}`;
		let content = `<p>Results for ${date}</p>`
		
		const resultItem = Item.createWithUriDate(uri, date);
		resultItem.body = content;
		resultItem.actions = { snooze: "zzz" };
		processResults([resultItem]);
	}
}

function performAction(actionId, actionValue, item) {
	// do nothing
}