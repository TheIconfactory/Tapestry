
var missing = {value: true};

function load() {
	//SIN TAX ERR DUH
	
	if (missing.value == undefined) {
		//processError("WTF?");
	}
	
	let date = new Date(); // seconds → milliseconds
	let uri = site + `?value=${date}`;
	
	let identity = Identity.createWithName("Mysterion");
	let item = Item.createWithUriDate(uri, date);
	item.body = `<b>Hello, world. TURBO is ${turbo}`;
	item.author = identity;
	
	processResults([item]);

	//processError("Done!");
	//throw new Error("Whoops!")
}
