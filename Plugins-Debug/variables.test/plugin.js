
// variables.test

if (require('stuff.js') === false) {
	console.log("failed to read stuff.js")
}
//const resourceName = 'sample.json';
const resourceName = 'template.txt';
//const resourceName = 'ONE MILLION.png';
//const resourceName = 'SHIPPING LABLE.rtf';
let result = require(resourceName);
if (result === false) {
	console.log(`failed to read resource = ${resourceName}`)
}
else {
	console.log(`${resourceName} returned ${result}`)
}

function verify() {
	let base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAApgAAAKYB3X3/OAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAANCSURBVEiJtZZPbBtFFMZ/M7ubXdtdb1xSFyeilBapySVU8h8OoFaooFSqiihIVIpQBKci6KEg9Q6H9kovIHoCIVQJJCKE1ENFjnAgcaSGC6rEnxBwA04Tx43t2FnvDAfjkNibxgHxnWb2e/u992bee7tCa00YFsffekFY+nUzFtjW0LrvjRXrCDIAaPLlW0nHL0SsZtVoaF98mLrx3pdhOqLtYPHChahZcYYO7KvPFxvRl5XPp1sN3adWiD1ZAqD6XYK1b/dvE5IWryTt2udLFedwc1+9kLp+vbbpoDh+6TklxBeAi9TL0taeWpdmZzQDry0AcO+jQ12RyohqqoYoo8RDwJrU+qXkjWtfi8Xxt58BdQuwQs9qC/afLwCw8tnQbqYAPsgxE1S6F3EAIXux2oQFKm0ihMsOF71dHYx+f3NND68ghCu1YIoePPQN1pGRABkJ6Bus96CutRZMydTl+TvuiRW1m3n0eDl0vRPcEysqdXn+jsQPsrHMquGeXEaY4Yk4wxWcY5V/9scqOMOVUFthatyTy8QyqwZ+kDURKoMWxNKr2EeqVKcTNOajqKoBgOE28U4tdQl5p5bwCw7BWquaZSzAPlwjlithJtp3pTImSqQRrb2Z8PHGigD4RZuNX6JYj6wj7O4TFLbCO/Mn/m8R+h6rYSUb3ekokRY6f/YukArN979jcW+V/S8g0eT/N3VN3kTqWbQ428m9/8k0P/1aIhF36PccEl6EhOcAUCrXKZXXWS3XKd2vc/TRBG9O5ELC17MmWubD2nKhUKZa26Ba2+D3P+4/MNCFwg59oWVeYhkzgN/JDR8deKBoD7Y+ljEjGZ0sosXVTvbc6RHirr2reNy1OXd6pJsQ+gqjk8VWFYmHrwBzW/n+uMPFiRwHB2I7ih8ciHFxIkd/3Omk5tCDV1t+2nNu5sxxpDFNx+huNhVT3/zMDz8usXC3ddaHBj1GHj/As08fwTS7Kt1HBTmyN29vdwAw+/wbwLVOJ3uAD1wi/dUH7Qei66PfyuRj4Ik9is+hglfbkbfR3cnZm7chlUWLdwmprtCohX4HUtlOcQjLYCu+fzGJH2QRKvP3UNz8bWk1qMxjGTOMThZ3kvgLI5AzFfo379UAAAAASUVORK5CYII=";

	const verification = {
		displayName: title,
		icon: base64Image
	};
	processVerification(verification)
}

function load() {
	const bogusDate = new Date(2999, 0, 1);
	const bogusItem = Item.createWithUriDate("https://example.com/bogus", bogusDate);
	bogusItem.body = "Back to the future.";
	processResults([bogusItem], false);
	
	//boom();
	
	headers = {
		"X-CLIENT-ID": "My __CLIENT_ID__",
		"Authorization": "Bearer __ACCESS_TOKEN__",
		"X-wth": "__CHOCK_MODE__ 696969696969",
	};
 	sendRequest("http://usetapestry.com.local/samples/ping", "POST", "client_id=__CLIENT_ID__&access_token=__ACCESS_TOKEN__", headers)
 	.then((text) => {
 		console.log(text);
		let uri = "custom://variables.test";
		let date = new Date();
		let status = ""
		if (reticulate_splines == "on") {
			status = CHOCK("Splines are being reticulated");
		}
		if (turbo == "on") {
			if (status.length > 0) {
				status += " and ";
			}
			status += "<TURBO is engaged>";
		}
		status += ` at level ${value}`;
		status = status.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
		let content = `<p>Test content for ${site} & ${title}</p><p>${status}</p><blockquote><p>For dessert, you'll be having ${dessert_choice}. Enjoy!</p></blockquote><p><a href="https://streamer.iconfactory.net">Check user agent in logs</a><img src="https://iconfactory.com/images-v8/if_logo.png" width="188" height="43" alt="IF logo"></p>`
		
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

function performAction(actionId, actionValue, item) {
	console.log(`actionId = ${actionId}`);
	if (actionId == "favorite") {
		try {
			let object = JSON.parse(actionValue);
			console.log(`actionValue = ${JSON.stringify(object, null, 4)}`);
		}
		catch (error) {
			console.log(`actionValue = ${actionValue}`);
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
		console.log(`actionValue = ${actionValue}`);
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
		let error = new Error(`can't handle actionValue = ${actionValue}`)
		actionComplete(item, error);
	}
	
}
