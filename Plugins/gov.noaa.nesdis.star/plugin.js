
// gov.noaa.nesdis.star

var lastDate = null;

function verify() {
	let displayName = "";
	if (satellite == "East Coast") {
		displayName += "GOES16";
	}
	else {
		displayName += "GOES18";
	}
	displayName += ": ";
	displayName += image;
	
	lastDate = null;
	
	processVerification(displayName);
}
	
// NOTE: Images update every five minutes, but it takes longer to see a visible difference.
// A new post will only be generated when we're past the minuteThreshold. Additionally,
// this threshold is used to limit the number of times lookBack recurses.

const minuteThreshold = 1; //60;

function finalize(timestamp, url) {
	const creatorUrl = "https://www.star.nesdis.noaa.gov";
	const creatorName = "NOAA STAR – GOES16";
	var creator = Creator.createWithUriName(creatorUrl, creatorName);
	creator.avatar = "https://www.star.nesdis.noaa.gov/favicon.ico";
	
	const date = new Date();
	const content = "<p>GeoColor image of Continental US at " + timestamp + " GMT.<img src=\"" + url + "\"/></p>";
	var post = Post.createWithUriDateContent(url, date, content);
	post.creator = creator;
	
	processResults([post]);
	
	lastDate = date;
}

function lookBack(counter, year, dayOfYear, hours, minutes) {
	const folder = "https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/GEOCOLOR/"
	const timestamp = String(year) + String(dayOfYear).padStart(3, "0") + String(hours).padStart(2, "0") + String(minutes).padStart(2, "0");
	const image = "_GOES16-ABI-CONUS-GEOCOLOR-2500x1500.jpg";
	
	const url = folder + timestamp + image;
	sendRequest(url, "HEAD")
		.then((dictionary) => {
			const jsonObject = JSON.parse(dictionary);

			const status = jsonObject["status"];
			const headers = jsonObject["headers"];

			if (status == 200) {
				finalize(timestamp, url);
			}
			else {
				const newCounter = counter + 1;
				if (newCounter < minuteThreshold) {
					var newMinutes = minutes - 1;
					var newHours = hours;
					var newDayOfYear = dayOfYear;
					var newYear = year;
					if (newMinutes < 0) {
						newMinutes = 59;
						newHours = newHours - 1;
						if (newHours < 0) {
							newHours = 23;
							newDayOfYear = newDayOfYear - 1;
							if (newDayOfYear < 0) {
								newDayOfYear = 364;
								newYear = newYear - 1;
							}
						}
					}

					lookBack(newCounter, newYear, newDayOfYear, newHours, newMinutes);
				}
				else {
					// TODO: Decide if error or empty results is a better way to handle this situation.
					processResults([]);
					//processError(new Error("Can't find recent image"));
				}
			}
		})
		.catch((requestError) => {
			processError(requestError);
		});
}

function load() {
	const date = new Date();
	
	if (Math.floor((date - lastDate) / 1000 / 60) > minuteThreshold) {
		let directory = "GOES18";
		if (satellite == "East Coast") {
			directory = "GOES16";
		}

		let url = `https://cdn.star.nesdis.noaa.gov/${directory}/ABI/CONUS/${image}/2500x1500.jpg`;
		
		const creatorUrl = "https://www.star.nesdis.noaa.gov";
		const creatorName = `NOAA STAR – ${directory}`;
		var creator = Creator.createWithUriName(creatorUrl, creatorName);
		creator.avatar = "https://www.star.nesdis.noaa.gov/favicon.ico";
		
		const date = new Date();
		const content = `<p>${image} image of Continental US (${satellite})</p><p><img src="${url}"/></p>`;
		var post = Post.createWithUriDateContent(url, date, content);
		post.creator = creator;
		
		processResults([post]);
		
		lastDate = date;

/*
		const year = date.getUTCFullYear();
		const dayOfYear = Math.floor((date - new Date(year, 0, 0)) / 1000 / 60 / 60 / 24);
		const hours = date.getUTCHours();
		const minutes = date.getUTCMinutes();
		
		lookBack(0, year, dayOfYear, hours, minutes);
*/
	}
}
