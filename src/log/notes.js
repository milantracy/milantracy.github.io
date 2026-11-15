import { marked } from 'marked'

// Every Markdown file in /notes becomes a note on the /now page.
//
// ---
// title: My note            (required)
// date: 2026-11-14          (required, YYYY-MM-DD)
// tags: [gvisor 101, reading]
// link: /gvisor-syscall/    (optional: the note points to a page)
// ---
// Markdown body…
const files = import.meta.glob('/notes/*.md', { query: '?raw', import: 'default', eager: true })

export const tagSlug = (tag) => tag.trim().toLowerCase().replace(/\s+/g, '-')

function parseFrontmatter(raw, path) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) throw new Error(`${path}: missing --- frontmatter ---`)
  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (!kv) continue
    let value = kv[2].trim()
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean)
    }
    meta[kv[1]] = value
  }
  if (!meta.title || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date || '')) {
    throw new Error(`${path}: needs a title and a YYYY-MM-DD date`)
  }
  return { meta, body: m[2] }
}

export const notes = Object.entries(files)
  .map(([path, raw]) => {
    const { meta, body } = parseFrontmatter(raw, path)
    const tags = Array.isArray(meta.tags) ? meta.tags : meta.tags ? [meta.tags] : []
    return {
      slug: path.split('/').pop().replace(/\.md$/, ''),
      title: meta.title,
      date: meta.date,
      link: meta.link || null,
      tags: tags.map((name) => ({ name, slug: tagSlug(name) })),
      html: marked.parse(body),
    }
  })
  .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title))

export const allTags = (() => {
  const counts = new Map()
  for (const n of notes) {
    for (const t of n.tags) {
      const prev = counts.get(t.slug)
      counts.set(t.slug, { ...t, count: (prev?.count || 0) + 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
})()
