function load() {
  loadAsync().then(processResults).catch(processError)
}

function getData(url) {
  return sendRequest(url, 'GET', {}, { 'X-Api-Key': project_api_key })
}

async function loadAsync() {
  const url = `${site}/api/v3/checks/${uuid}`
  const check = JSON.parse(await getData(url))
  const flips = JSON.parse(await getData(`${url}/flips`)).flips
  const creator = Creator.createWithUriName(site, 'Healthchecks')
  creator.avatar = `${site}/static/img/logo.png`
  return flips.map(flip => {
    const date = new Date(flip.timestamp)
    const uri = `${site}/checks/${uuid}/details?date=${date.getTime()}`
    const content = `<p>Check <b>${check.name}</b> is <b>${flip.up == '1' ? 'up' : 'down'}</b>`
    const post = Post.createWithUriDateContent(uri, date, content)
    post.creator = creator
    return post
  })
}
