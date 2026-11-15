import { useEffect, useState } from 'react'
import { allTags, notes } from './notes.js'
import Banner from '../site/Banner.jsx'
import Footer from '../site/Footer.jsx'

const readTag = () => new URLSearchParams(window.location.search).get('tag')

const fmtDate = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

export default function Logbook() {
  const [tag, setTag] = useState(readTag)

  useEffect(() => {
    const onPop = () => setTag(readTag())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const choose = (slug) => (e) => {
    e.preventDefault()
    const next = slug === tag ? null : slug
    const url = new URL(window.location.href)
    if (next) url.searchParams.set('tag', next)
    else url.searchParams.delete('tag')
    window.history.pushState(null, '', url)
    setTag(next)
  }

  const shown = tag
    ? notes.filter((n) => n.tags.some((t) => t.slug === tag))
    : notes
  const tagHref = (slug) => `?tag=${encodeURIComponent(slug)}`

  return (
    <>
      <Banner current="log" />
      <main className="logbook">
        <h1>Logbook</h1>
        <p className="intro">What I'm reading, learning and thinking about.</p>

        {allTags.length > 0 && (
          <nav className="tag-bar" aria-label="Filter by tag">
            <a
              href="./"
              onClick={choose(null)}
              className={`tag ${!tag ? 'on' : ''}`}
            >
              all
            </a>
            {allTags.map((t) => (
              <a
                key={t.slug}
                href={tagHref(t.slug)}
                onClick={choose(t.slug)}
                className={`tag ${tag === t.slug ? 'on' : ''}`}
              >
                #{t.name} <span className="count">{t.count}</span>
              </a>
            ))}
          </nav>
        )}

        {shown.length === 0 && (
          <p className="empty">No notes tagged “{tag}”.</p>
        )}

        {shown.map((n) => (
          <article key={n.slug} id={n.slug} className="note">
            <header>
              <time dateTime={n.date}>{fmtDate(n.date)}</time>
              <h2>
                {n.link ? (
                  <a href={n.link}>{n.title}</a>
                ) : (
                  <a href={`#${n.slug}`}>{n.title}</a>
                )}
              </h2>
            </header>
            <div
              className="note-body"
              dangerouslySetInnerHTML={{ __html: n.html }}
            />
            {n.link && (
              <p className="note-link">
                <a href={n.link}>Open →</a>
              </p>
            )}
            <footer>
              {n.tags.map((t) => (
                <a
                  key={t.slug}
                  href={tagHref(t.slug)}
                  onClick={choose(t.slug)}
                  className={`tag small ${tag === t.slug ? 'on' : ''}`}
                >
                  #{t.name}
                </a>
              ))}
            </footer>
          </article>
        ))}
      </main>
      <Footer />
    </>
  )
}
