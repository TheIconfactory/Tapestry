function load() {
  loadAsync().then(processResults).catch(processError);
}

async function loadAsync() {
  const text = await sendRequest("https://daily.bandcamp.com/feed");
  const { item: items, link } = xmlParse(text).rss.channel;

  return items.map((item) => {
    const creator = Creator.createWithUriName(link, item["dc:creator"]);

    creator.avatar = "https://s4.bcbits.com/img/favicon/apple-touch-icon.png";

    let paragraphs = item.description.match(/<p>.*?<\/p>/g);

    const [_, media] = paragraphs[0].match(/<img\s+(?:.+)?src="(.+?)"(?:\s+.+)?>/);

    paragraphs = (media ? paragraphs.slice(1) : paragraphs);

    paragraphs.unshift(`<p><b>${item.title}</b></p>`);

    const post = Post.createWithUriDateContent(item.link, new Date(item["dc:date"]), paragraphs.join(''));

    if (media) {
      const attachment = Attachment.createWithMedia(media);

      post.attachments = [attachment];
    }

    post.creator = creator;

    return post;
  });
}
