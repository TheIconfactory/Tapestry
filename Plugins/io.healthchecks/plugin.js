// io.healthchecks

function verify() {
  verifyAsync().then(processVerification).catch(processError)
}

function load() {
  loadAsync().then(processResults).catch(processError)
}

function getData(url) {
  return sendRequest(url, 'GET', {}, { 'X-Api-Key': project_api_key })
}

async function verifyAsync() {
  const url = `${site}/api/v3/checks/${uuid}`
  const check = JSON.parse(await getData(url))
  // all we need to know is that getting data didn't fail
  return "Healthchecks"
}

async function loadAsync() {
  const url = `${site}/api/v3/checks/${uuid}`
  const check = JSON.parse(await getData(url))
  const flips = JSON.parse(await getData(`${url}/flips`)).flips
  return flips.map(flip => {
    const date = new Date(flip.timestamp)
    const uri = `${site}/checks/${uuid}/details?date=${date.getTime()}`
    const content = `<p><b>${check.name}</b> check is <b>${flip.up == '1' ? 'up' : 'down'}</b>`
    const item = Item.createWithUriDate(uri, date)
    item.body = content
    return item
  })
}

// generally, no news is good news and results aren't generated, so use this to test content layout
async function testLoadAsync() {
  const url = `${site}/api/v3/checks/${uuid}`
  const check = JSON.parse(await getData(url))
  const date = new Date()
  const uri = `${site}/checks/${uuid}/details?date=${date.getTime()}`
  const content = `<p><b>${check.name}</b> check is <b>tested</b>`
  const item = Item.createWithUriDate(uri, date)
  item.body = content
  return [item]
}
