function load () {
  loadAsync().then(processResults).catch(processError)
}

async function calenderEntries (category, date) {
  return JSON.parse(await sendRequest(`${site}/calendars/my/${category}/${date}/1?extended=full`, 'GET', {}, {
    'Content-type': 'application/json',
    'trakt-api-key': traktApiKey,
    'trakt-api-version': 2
  }))
}

function tmdbData (path) {
  return sendRequest(`https://api.themoviedb.org/3${path}?api_key=${tmdbApiKey}`)
}

async function tmdbPoster (id, category, title) {
  const config = JSON.parse(await tmdbData('/configuration'))
  const data = JSON.parse(await tmdbData(`/${category}/${id}`))
  const attachment = Attachment.createWithMedia(`${config.images.base_url}/${config.images.poster_sizes.at(-1)}/${data.poster_path}`)
  attachment.text = `"${title}" poster`
  return attachment
}

function runtime (duration) {
  const hours = Math.floor(duration / 60)
  const minutes = duration % 60
  return (hours > 0 ? `${hours} hours and ` : '') + `${minutes} minutes`
}

async function post (path, date, content, tmdbId, category, caption) {
  const creator = Creator.createWithUriName(website, 'Trakt')
  creator.avatar = `${website}/favicon.png`
  const post = Post.createWithUriDateContent(`${website}${path}`, date, content)
  post.creator = creator
  if (tmdbApiKey.length > 0) {
    post.attachments = [await tmdbPoster(tmdbId, category, caption)]
  }
  return post
}

async function moviePost (movie) {
  const path = `/movies/${movie.ids.slug}`
  const date = new Date(movie.released)
  const header = `<b>${movie.title}</b>` + (movie.tagline.length > 0 ? ` - <em>${movie.tagline}</em>` : '')
  const details = `${runtime(movie.runtime)}<p><em>${movie.genres.join(', ')}</em><p>${movie.certification}`
  const content = `<p>${header}<br><p>${details}<br><p>${movie.overview}`
  return await post(path, date, content, movie.ids.tmdb, 'movie', movie.title)
}

async function episodePost (show, episode) {
  const path = `/shows/${show.ids.slug}/seasons/${episode.season}/episodes/${episode.number}`
  const date = new Date(episode.first_aired)
  const header = `<b>${show.title}</b> S${episode.season}E${episode.number} - <em>${episode.title}</em>`
  const details = runtime(episode.runtime)
  const content = `<p>${header}<br><p>${details}<br><p>${episode.overview || ''}`
  return await post(path, date, content, show.ids.tmdb, 'tv', show.title)
}

async function loadAsync () {
  const date = new Date('')
  const startDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  const movies = await calenderEntries('movies', startDate)
  const moviePosts = movies.map(async entry => await moviePost(entry.movie))
  const shows = await calenderEntries('shows', startDate)
  const showPosts = shows.map(async entry => await episodePost(entry.show, entry.episode))
  return Promise.all(moviePosts.concat(showPosts))
}
