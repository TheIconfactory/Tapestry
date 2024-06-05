
// com.kickstarter

function verify() {
  verifyAsync().then(processVerification).catch(processError)
}

async function verifyAsync() {
  const url = `${site}/projects/${creator_username}/${project_slug}`
  const html = await sendRequest(url)
  const regexp = /window.ksr_track_properties = ({.+})/g
  const data = JSON.parse([...html.matchAll(regexp)][0][1]).project
  const displayName = data.project_name
  return displayName
}

function load() {
  loadAsync().then(processResults).catch(processError)
}

async function loadAsync() {
  const url = `${site}/projects/${creator_username}/${project_slug}`
  const html = await sendRequest(url)
  const regexp = /window.ksr_track_properties = ({.+})/g
  const data = JSON.parse([...html.matchAll(regexp)][0][1]).project
  const backers = parseInt(data.project_backers_count).toLocaleString()
  const amount = parseInt(data.project_current_amount_pledged_usd).toLocaleString()
  const goal = parseInt(data.project_goal_usd).toLocaleString()
  const percent = data.project_percent_raised
  const days = Math.floor(data.project_hours_remaining / 24)
  const title = data.project_name
  const identity = Identity.createWithName(data.project_creator_name)
  const header = `<p><em>${data.project_blurb}</em></p>`
  const details = `<p><b>${backers}</b> backers pledged <b>$${amount}</b> of $${goal} (<b>${percent}%</b>) - <b>${days}</b> days to go</p>`
  const date = new Date()
  const resultItem = Item.createWithUriDate(url, date)
  resultItem.title = title;
  resultItem.body = `${header}${details}`
  resultItem.author = identity
  return [resultItem]
}
