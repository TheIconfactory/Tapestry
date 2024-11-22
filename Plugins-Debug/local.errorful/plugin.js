
var missing = {value: true};

function load() {
	//SIN TAX ERR DUH
	
	if (missing.value == undefined) {
		//processError("WTF?");
	}
	
	let currentTurboUpdate = getItem("turboUpdate");
	
	clearItems();
	
	let date = new Date();
	let uri = site + `?value=${date.getTime()}`;
	
	let identity = Identity.createWithName("Mysterion");
	let item = Item.createWithUriDate(uri, date);
	item.body = `<b>Hello, ${name}. TURBO is ${turbo}. currentTurboUpdate = ${currentTurboUpdate ?? "not set"}`;
	item.author = identity;
	
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
