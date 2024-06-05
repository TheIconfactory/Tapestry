function load() {
  loadAsync().then(processResults).catch(processError);
}

async function loadAsync() {
  const text = await sendRequest("https://daily.bandcamp.com/feed");
  const { item: items, link } = xmlParse(text).rss.channel;

  return items.map((item) => {
    const identity = Identity.createWithName(item["dc:creator"]);
    identity.uri = link;

    let paragraphs = item.description.match(/<p>.*?<\/p>/g);

    const [_, media] = paragraphs[0].match(/<img\s+(?:.+)?src="(.+?)"(?:\s+.+)?>/);

    paragraphs = (media ? paragraphs.slice(1) : paragraphs);

    const resultItem = Item.createWithUriDate(item.link, new Date(item["dc:date"]));
    resultItem.title = item.title;
	resultItem.body = paragraphs.join('');
    if (media) {
      const attachment = Attachment.createWithMedia(media);

      resultItem.attachments = [attachment];
    }

    resultItem.author = identity;

    return resultItem;
  });
}
