import Banner from './site/Banner.jsx'
import Footer from './site/Footer.jsx'

export default function App() {
  return (
    <>
      <Banner current="home" />
      <main>
        <h1>Hi, I'm Jing</h1>
        <p>
          I work on <a href="https://github.com/google/gvisor">gVisor</a>.
          Before that, I built data ingestion infrastructure.
        </p>
      </main>
      <Footer />
    </>
  )
}
