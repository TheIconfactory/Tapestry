const feedUrl = "https://mail.google.com/mail/feed/atom";

function identify() {
  if (appPassword == null || appPassword.length <= 0) {
    return setIdentifier(null);
  }

  const authHeader = {"Authorization": `Basic ${appPassword}`};
  sendRequest(feedUrl, null, null, authHeader)
    .then((xmlResponse, others) => {
      const jsonObject = xmlParse(xmlResponse);
      const feedTitle = jsonObject.feed.title
      const accountEmail = feedTitle.split(" ").pop()
      setIdentifier(accountEmail);
    })
    .catch((requestError) => {
      setIdentifier(null);
    });
}

function load() {
  const authHeader = {"Authorization": `Basic ${appPassword}`};
  sendRequest(feedUrl, null, null,authHeader)
    .then((xmlResponse) => {
      const jsonObject = xmlParse(xmlResponse);
      if (jsonObject.feed != null) {
        const feedName = jsonObject.feed.title;
        const linkAttrs = jsonObject.feed.link$attrs;
        const feedUrl = linkAttrs.href;
        const baseUrl = feedUrl.split("/").splice(0,3).join("/");
        const feedAvatar = baseUrl + "/favicon.ico";
        const entries = jsonObject.feed.entry;
        let posts = entries.map(toPosts(feedUrl, feedAvatar));
        processResults(posts);
      }
      else {
        processResults([]);
      }
    })
    .catch((requestError) => {
      processError(requestError);
    });
}

function toPosts(feedUrl, feedAvatar) {
  return (feedEntry) => {
    const entryLinkAttributes = feedEntry.link$attrs;
    const authorName = feedEntry.author.name;
    let entryUrl = entryLinkAttributes.href;
    let date = new Date(feedEntry.issued);
    const content = feedEntry.title;
    const post = Post.createWithUriDateContent(entryUrl, date, content);
    const creator = Creator.createWithUriName(feedUrl, authorName);
    creator.avatar = feedAvatar;
    post.creator = creator;
    return post;
  }
}
