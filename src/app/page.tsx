import Navbar from './components/Navbar'
import ProfilePanel from './components/ProfilePanel'
import About from './components/About'
import Timeline from './components/Timeline'
import Projects from './components/Projects'
import Chatbot from './components/Chatbot'
import Footer from './components/Footer'

export default function Home() {
  return (
    <>
      {/* Mobile navbar - hidden on desktop */}
      <Navbar />

      <div className="lg:flex">
        {/* Left Panel - Fixed on desktop, normal flow on mobile */}
        <aside className="lg:w-[40%] xl:w-[35%] lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:overflow-hidden">
          <ProfilePanel />
        </aside>

        {/* Right Panel - Scrollable content, offset on desktop */}
        <main className="lg:w-[60%] xl:w-[65%] lg:ml-[40%] xl:ml-[35%]">
          <About />
          <Timeline />
          <Projects />
          <Chatbot />
          <Footer />
        </main>
      </div>
    </>
  )
}
