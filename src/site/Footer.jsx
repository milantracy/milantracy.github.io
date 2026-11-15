import './banner.css'

// Site-wide footer.
export default function Footer() {
  return (
    <footer className="site-footer">
      © {new Date().getFullYear()} Jing Chen
    </footer>
  )
}
