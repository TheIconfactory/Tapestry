
// variables.test

function identify() {
	setIdentifier(title)
}

function load() {
	let uri = "custom://variables.test";
	let date = new Date();
	let status = ""
	if (reticulate_splines == "true") {
		status = "Splines are being reticulated";
	}
	if (turbo == "true") {
		if (status.length > 0) {
			status += " and ";
		}
		status += "TURBO is engaged";
	}
	let content = `<p>Test content for ${site}</p><p>${status}</p><p>For dessert, you'll be having ${dessert_choice}. Enjoy!</p>`
	
	const post = Post.createWithUriDateContent(uri, date, content);

	processResults([post]);
}
