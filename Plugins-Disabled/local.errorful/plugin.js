
var missing = {value: true};

let xml = `<?xml version="1.0" encoding="UTF-8"?>
<description>
	<p>text text text. <a href="https://example.com" target="_blank">Go!</a></p>
	<p>more text</p>
</description>`;
	
function load() {
	//SIN TAX ERR DUH
	
	let jsonObject = xmlParse(xml);
	
	if (missing.value == undefined) {
		//processError("WTF?");
	}
	
	let currentTurboUpdate = getItem("turboUpdate");
	
	clearItems();
	
	let date = new Date();
	let uri = site + `?value=${date.getTime()}`;
	
	let attachment = MediaAttachment.createWithUrl("https://usetapestry.com/icons/tumblr.png");
	attachment.mimeType = "image/png";
	attachment.text = "A test image";
	
	let identity = Identity.createWithName("Mysterion");
	let item = Item.createWithUriDate(uri, date);
	item.body = `<b>Hello, ${name}. TURBO is ${turbo}. currentTurboUpdate = ${currentTurboUpdate ?? "not set"}`;
	//item.body = 'this is a bunch of text\n\nwith newlines\nand other non-HTML stuff';
	item.author = identity;
	item.attachments = [attachment];
	
	if (turbo == "on") {
		let bigString = "";
		while (bigString.length < 90000) {
			bigString = bigString + "x";
		}
		setItem("bigString", bigString);
		//setItem("bigString", null);
	}	

	setItem("turboUpdate", date);
	console.log(`setItem("turboUpdate") = ${date}`);
	
	processResults([item]);

	//processError("Done!");
	//throw new Error("Whoops!")
}
