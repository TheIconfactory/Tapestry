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
  const identity = Identity.createWithName('Healthchecks')
  identity.uri = site
  identity.avatar = `${site}/static/img/logo.png`
  return flips.map(flip => {
    const date = new Date(flip.timestamp)
    const uri = `${site}/checks/${uuid}/details?date=${date.getTime()}`
    const content = `<p>Check <b>${check.name}</b> is <b>${flip.up == '1' ? 'up' : 'down'}</b>`
    const item = Item.createWithUriDate(uri, date)
    item.body = content
    item.author = identity
    return item
  })
}
