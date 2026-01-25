export default function Footer() {
  return (
    <footer className="py-8 px-6 border-t border-slate/20">
      <div className="max-w-3xl mx-auto text-center text-sm text-slate">
        <p>&copy; {new Date().getFullYear()} Noah Shaw. All rights reserved.</p>
      </div>
    </footer>
  )
}
