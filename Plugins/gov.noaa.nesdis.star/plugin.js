
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

		let subdirectory = "CONUS";
		let imageWidth = "2500";
		let imageHeight = "1500";
		if (view == "Full Disk") {
			subdirectory = "FD";
			imageWidth = "1808";
			imageHeight = "1808";
		}
		let directoryUrl = `https://cdn.star.nesdis.noaa.gov/${directory}/ABI/${subdirectory}/${image}/`;
		sendRequest(directoryUrl)
		.then((html) => {
			
			let imageRegex = null;
			if (view == "Full Disk") {
				imageRegex = /<a href="(.*-1808x1808\.jpg)">/gm
			}
			else {
				imageRegex = /<a href="(.*-2500x1500\.jpg)">/gm
			}
			const matches = [...html.matchAll(imageRegex)];
			const lastMatch = matches[matches.length - 1];
			const imageUrl = lastMatch[1];

			let year = parseInt(imageUrl.substring(0, 4));
			let dayOfYear = parseInt(imageUrl.substring(4, 7));
			let hour = parseInt(imageUrl.substring(7, 9));
			let minute = parseInt(imageUrl.substring(9, 11));
			
			const url = `https://cdn.star.nesdis.noaa.gov/${directory}/ABI/${subdirectory}/${image}/${imageUrl}`;
			
			const initialDate = new Date(Date.UTC(year, 0, 1, hour, minute));
			const date = new Date(initialDate.setUTCDate(dayOfYear));
			
			let attachment = MediaAttachment.createWithUrl(url);
			attachment.aspectSize = {width: imageWidth, height: imageHeight};
			
			const content = `<p>${image} image of Continental US (${satellite})</p>`;
			var resultItem = Item.createWithUriDate(url, date);
			resultItem.body = content;
			resultItem.attachments = [attachment];
			
			processResults([resultItem]);
			
		})
		.catch((requestError) => {
			processError(requestError);
		});	

		lastDate = date;
	}
}
