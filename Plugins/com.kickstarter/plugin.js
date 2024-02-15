function load() {
  loadAsync().then(processResults).catch(processError)
}

async function loadAsync() {
  const site = 'https://kickstarter.com'
  const creator = Creator.createWithUriName(site, 'Kickstarter')
  creator.avatar = `${site}/favicon.png`
  const url = `${site}/projects/${creator_username}/${project_slug}`
  const html = await sendRequest(url)
  const regexp = /window.ksr_track_properties = ({.+})/g
  const data = JSON.parse([...html.matchAll(regexp)][0][1]).project
  const backers = parseInt(data.project_backers_count).toLocaleString()
  const amount = parseInt(data.project_current_amount_pledged_usd).toLocaleString()
  const goal = parseInt(data.project_goal_usd).toLocaleString()
  const percent = data.project_percent_raised
  const days = Math.floor(data.project_hours_remaining / 24)
  const header = `<p><b>${data.project_name}</b> by ${data.project_creator_name} - <em>${data.project_blurb}</em>`
  const details = `<p><b>${backers}</b> backers pledged $<b>${amount}</b> of $${goal} (<b>${percent}</b>%) - <b>${days}</b> days to go`
  const date = new Date()
  const post = Post.createWithUriDateContent(`${url}?date=${date.getTime()}`, date, `${header}<br>${details}`)
  post.creator = creator
  return [post]
}
