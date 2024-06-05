
// gov.noaa.nesdis.star

var lastDate = null;

function verify() {
	let displayName = "";
	if (satellite == "East Coast") {
		displayName = "GOES16 Satellite";
	}
	else {
		displayName = "GOES18 Satellite";
	}
	
	lastDate = null;
	
	processVerification(displayName);
}
	
// NOTE: Images update every five minutes, but it takes longer to see a visible difference.
// A new post will only be generated when we're past the minuteThreshold.

const minuteThreshold = 60;

function load() {
	const date = new Date();
	
	if (Math.floor((date - lastDate) / 1000 / 60) > minuteThreshold) {
		let directory = "GOES18";
		if (satellite == "East Coast") {
			directory = "GOES16";
		}

		let url = `https://cdn.star.nesdis.noaa.gov/${directory}/ABI/CONUS/${image}/2500x1500.jpg`;
		
		const date = new Date();
		const content = `<p>${image} image of Continental US (${satellite})</p><p><img src="${url}"/></p>`;
		var resultItem = Item.createWithUriDate(url, date);
		resultItem.body = content;
		
		processResults([resultItem]);
		
		lastDate = date;
	}
}
