import { useState, useEffect } from "react"
import { supabase } from "./supabase"

function Card({ l }) {
  function openWA() {
    window.open("https://wa.me/91" + l.phone + "?text=Hi, I saw " + l.title + " in " + l.location + " on Homie. Still available?")
  }
  const badge = l.furnished === "Furnished" ? "bg-emerald-100 text-emerald-700" : l.furnished === "Semi Furnished" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 group border border-gray-100 hover:-translate-y-1">
      <div className="relative overflow-hidden h-52">
        {l.image_url
          ? <img src={l.image_url} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-5xl">🏠</div>
        }
        <div className="absolute top-3 left-3">
          <span className={"text-xs font-semibold px-3 py-1 rounded-full " + badge}>{l.furnished}</span>
        </div>
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1">
          <span className="text-sm font-bold text-gray-800">₹{Number(l.price).toLocaleString()}<span className="text-gray-400 font-normal">/mo</span></span>
        </div>
      </div>
      <div className="p-5">
        <h2 className="font-bold text-gray-900 text-lg mb-1">{l.title}</h2>
        <p className="text-gray-400 text-sm mb-1">📍 {l.location}</p>
        <p className="text-gray-400 text-sm mb-4">👤 {l.owner_name}</p>
        <div className="flex gap-4 text-sm text-gray-500 mb-5 border-t border-gray-100 pt-4">
          {l.beds && <span>🛏 {l.beds} Beds</span>}
          {l.baths && <span>🚿 {l.baths} Baths</span>}
          {l.sqft && <span>📐 {l.sqft} sqft</span>}
        </div>
        <button onClick={openWA} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-2xl transition-colors text-sm">
          WhatsApp Owner
        </button>
      </div>
    </div>
  )
}

function UploadForm({ onClose, onSuccess }) {
  const [form, setForm] = useState({ title: "", price: "", location: "Gomti Nagar", furnished: "Furnished", beds: "", baths: "", sqft: "", phone: "", owner_name: "", image_url: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function handle(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

 async function submit() {
    if (!form.title || !form.price || !form.phone || !form.owner_name) {
      setError("Please fill in all required fields.")
      return
    }
    setLoading(true)
    console.log("Submitting form:", form)
    const { data, error } = await supabase.from("listings").insert([form]).select()
    console.log("Response:", data, error)
    setLoading(false)
    if (error) { setError(error.message); return }
    onSuccess()
    onClose()
  }

  const input = "w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-gray-900">List Your Property</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 px-4 py-2 rounded-xl">{error}</p>}
        <div className="flex flex-col gap-3">
          <input name="owner_name" placeholder="Your Name *" value={form.owner_name} onChange={handle} className={input} />
          <input name="phone" placeholder="Your WhatsApp Number *" value={form.phone} onChange={handle} className={input} />
          <input name="title" placeholder="Property Title * (e.g. 3BHK Apartment)" value={form.title} onChange={handle} className={input} />
          <input name="price" placeholder="Monthly Rent (₹) *" type="number" value={form.price} onChange={handle} className={input} />
          <select name="location" value={form.location} onChange={handle} className={input}>
            <option value="Gomti Nagar">Gomti Nagar</option>
            <option value="Aliganj">Aliganj</option>
            <option value="Hazratganj">Hazratganj</option>
            <option value="Indira Nagar">Indira Nagar</option>
            <option value="Vikas Nagar">Vikas Nagar</option>
          </select>
          <select name="furnished" value={form.furnished} onChange={handle} className={input}>
            <option value="Furnished">Furnished</option>
            <option value="Semi Furnished">Semi Furnished</option>
            <option value="Unfurnished">Unfurnished</option>
          </select>
          <div className="grid grid-cols-3 gap-3">
            <input name="beds" placeholder="Beds" type="number" value={form.beds} onChange={handle} className={input} />
            <input name="baths" placeholder="Baths" type="number" value={form.baths} onChange={handle} className={input} />
            <input name="sqft" placeholder="Sqft" type="number" value={form.sqft} onChange={handle} className={input} />
          </div>
          <input name="image_url" placeholder="Photo URL (optional)" value={form.image_url} onChange={handle} className={input} />
          <p className="text-xs text-gray-400 -mt-2 px-1">Upload your photo to imgur.com and paste the link here</p>
          <button onClick={submit} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-colors mt-2 disabled:opacity-50">
            {loading ? "Submitting..." : "List My Property 🏠"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [loc, setLoc] = useState("All")
  const [max, setMax] = useState(50000)
  const [fur, setFur] = useState("All")
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)

  async function fetchListings() {
    setLoading(true)
    const { data, error } = await supabase.from("listings").select("*").order("created_at", { ascending: false })
    if (!error) setListings(data)
    setLoading(false)
  }

  useEffect(() => { fetchListings() }, [])

  const filtered = listings.filter(l =>
    (loc === "All" || l.location === loc) &&
    (fur === "All" || l.furnished === fur) &&
    Number(l.price) <= max &&
    (search === "" || l.title.toLowerCase().includes(search.toLowerCase()) || l.location.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {showForm && <UploadForm onClose={() => setShowForm(false)} onSuccess={fetchListings} />}

      <div className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-black text-gray-900">🏠 Homie</h1>
          <p className="text-xs text-gray-400">No brokers. No BS. Lucknow.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl text-sm font-semibold transition-colors shadow-lg shadow-blue-200">
          + List Property
        </button>
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-12 text-center">
        <h2 className="text-3xl font-black text-white mb-2">Find Your Next Home</h2>
        <p className="text-blue-200 mb-8 text-sm">Verified listings. Direct owners. Zero brokerage.</p>
        <div className="max-w-md mx-auto relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by area or property type..." className="w-full px-5 py-4 rounded-2xl text-gray-800 text-sm focus:outline-none shadow-2xl pr-12" />
          <span className="absolute right-4 top-4 text-gray-400">🔍</span>
        </div>
      </div>

      <div className="px-6 py-4 bg-white border-b border-gray-100 flex gap-3 flex-wrap items-center">
        <span className="text-sm font-semibold text-gray-500">Filter:</span>
        <select value={loc} onChange={e => setLoc(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50">
          <option value="All">All Areas</option>
          <option value="Gomti Nagar">Gomti Nagar</option>
          <option value="Aliganj">Aliganj</option>
          <option value="Hazratganj">Hazratganj</option>
          <option value="Indira Nagar">Indira Nagar</option>
          <option value="Vikas Nagar">Vikas Nagar</option>
        </select>
        <select value={fur} onChange={e => setFur(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50">
          <option value="All">All Types</option>
          <option value="Furnished">Furnished</option>
          <option value="Semi Furnished">Semi Furnished</option>
          <option value="Unfurnished">Unfurnished</option>
        </select>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-sm font-semibold text-gray-700">₹{max.toLocaleString()}/mo</span>
          <input type="range" min="5000" max="50000" step="1000" value={max} onChange={e => setMax(Number(e.target.value))} className="w-28 accent-blue-600" />
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{filtered.length} listings</span>
      </div>

      <div className="px-6 py-8 max-w-6xl mx-auto">
        {loading ? (
          <div className="text-center py-24">
            <p className="text-4xl mb-4 animate-bounce">🏠</p>
            <p className="text-gray-400">Loading listings...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(l => <Card key={l.id} l={l} />)}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">🏠</p>
            <p className="text-gray-400 font-medium">No listings yet.</p>
            <p className="text-gray-300 text-sm mt-1">Be the first to list a property!</p>
          </div>
        )}
      </div>

      <div className="text-center py-8 text-gray-300 text-xs border-t border-gray-100">
        Homie — Lucknow's no-broker rental platform
      </div>
    </div>
  )
}