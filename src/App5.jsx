import { useState, useEffect, useRef } from "react"
import { supabase } from "./supabase"

function Card({ l }) {
  function openWA() {
    window.open("https://wa.me/91" + l.phone + "?text=Hi, I saw " + l.title + " in " + l.location + " on Homie. Still available?")
  }
  const badge = l.furnished === "Furnished" ? "bg-emerald-100 text-emerald-700" : l.furnished === "Semi Furnished" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 group border border-gray-100 hover:-translate-y-1">
      <div className="relative overflow-hidden h-56">
        {l.image_url
          ? <img src={l.image_url} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center text-6xl">🏠</div>
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute top-3 left-3">
          <span className={"text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-sm " + badge}>{l.furnished}</span>
        </div>
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm">
          <span className="text-sm font-black text-gray-900">₹{Number(l.price).toLocaleString()}<span className="text-gray-400 font-normal text-xs">/mo</span></span>
        </div>
      </div>
      <div className="p-5">
        <h2 className="font-black text-gray-900 text-lg mb-1 leading-tight">{l.title}</h2>
        <p className="text-gray-400 text-sm mb-1">📍 {l.location}</p>
        <p className="text-gray-400 text-sm mb-4">👤 {l.owner_name}</p>
        <div className="flex gap-3 text-xs text-gray-500 mb-5 border-t border-gray-50 pt-4">
          {l.beds && <span className="bg-gray-50 px-3 py-1.5 rounded-xl font-medium">🛏 {l.beds} Beds</span>}
          {l.baths && <span className="bg-gray-50 px-3 py-1.5 rounded-xl font-medium">🚿 {l.baths} Baths</span>}
          {l.sqft && <span className="bg-gray-50 px-3 py-1.5 rounded-xl font-medium">📐 {l.sqft} sqft</span>}
        </div>
        <button onClick={openWA} className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold py-3.5 rounded-2xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-100">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp Owner
        </button>
      </div>
    </div>
  )
}

function UploadForm({ onClose, onSuccess }) {
  const [form, setForm] = useState({ title: "", price: "", location: "Gomti Nagar", furnished: "Furnished", beds: "", baths: "", sqft: "", phone: "", owner_name: "", image_url: "" })
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState(null)
  const fileRef = useRef()

  function handle(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function uploadPhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const filename = Date.now() + "-" + file.name.replace(/\s/g, "-")
    const { data, error } = await supabase.storage.from("photos").upload(filename, file)
    if (error) { setError("Photo upload failed: " + error.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from("photos").getPublicUrl(filename)
    setForm(f => ({ ...f, image_url: urlData.publicUrl }))
    setPreview(urlData.publicUrl)
    setUploading(false)
  }

  async function submit() {
    if (!form.title || !form.price || !form.phone || !form.owner_name) {
      setError("Please fill name, phone, title and price.")
      return
    }
    setLoading(true)
    const { error } = await supabase.from("listings").insert([form]).select()
    setLoading(false)
    if (error) { setError(error.message); return }
    onSuccess()
    onClose()
  }

  const input = "w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 placeholder-gray-400"

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-6 pt-6 pb-4 border-b border-gray-50 rounded-t-3xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black text-gray-900">List Your Property</h2>
              <p className="text-xs text-gray-400 mt-0.5">Free. No broker fees. Ever.</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 transition-colors">✕</button>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 flex flex-col gap-4">
          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-100 px-4 py-3 rounded-2xl">{error}</div>}

          {/* Photo Upload */}
          <div
            onClick={() => fileRef.current.click()}
            className="border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-gray-50 hover:bg-blue-50"
          >
            {preview
              ? <img src={preview} alt="preview" className="w-full h-40 object-cover rounded-xl" />
              : <div>
                  <p className="text-3xl mb-2">{uploading ? "⏳" : "📸"}</p>
                  <p className="text-sm font-semibold text-gray-600">{uploading ? "Uploading..." : "Tap to upload photo"}</p>
                  <p className="text-xs text-gray-400 mt-1">JPG or PNG, max 5MB</p>
                </div>
            }
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadPhoto} className="hidden" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input name="owner_name" placeholder="Your Name *" value={form.owner_name} onChange={handle} className={input} />
            <input name="phone" placeholder="WhatsApp No. *" value={form.phone} onChange={handle} className={input} />
          </div>
          <input name="title" placeholder="Property Title * (e.g. 3BHK Apartment)" value={form.title} onChange={handle} className={input} />
          <div className="grid grid-cols-2 gap-3">
            <input name="price" placeholder="Monthly Rent ₹ *" type="number" value={form.price} onChange={handle} className={input} />
            <select name="furnished" value={form.furnished} onChange={handle} className={input}>
              <option value="Furnished">Furnished</option>
              <option value="Semi Furnished">Semi Furnished</option>
              <option value="Unfurnished">Unfurnished</option>
            </select>
          </div>
          <select name="location" value={form.location} onChange={handle} className={input}>
            <option value="Gomti Nagar">Gomti Nagar</option>
            <option value="Aliganj">Aliganj</option>
            <option value="Hazratganj">Hazratganj</option>
            <option value="Indira Nagar">Indira Nagar</option>
            <option value="Vikas Nagar">Vikas Nagar</option>
            <option value="Mahanagar">Mahanagar</option>
            <option value="Rajajipuram">Rajajipuram</option>
          </select>
          <div className="grid grid-cols-3 gap-3">
            <input name="beds" placeholder="Beds" type="number" value={form.beds} onChange={handle} className={input} />
            <input name="baths" placeholder="Baths" type="number" value={form.baths} onChange={handle} className={input} />
            <input name="sqft" placeholder="Sqft" type="number" value={form.sqft} onChange={handle} className={input} />
          </div>

          <button onClick={submit} disabled={loading || uploading} className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black py-4 rounded-2xl transition-all mt-2 disabled:opacity-50 text-base shadow-xl shadow-blue-200">
            {loading ? "Listing..." : "🏠 List My Property — Free"}
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

      {/* Header */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900">🏠 Homie</h1>
          <p className="text-xs text-gray-400">No brokers. No BS. Lucknow.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-200">
          + List Free
        </button>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-6 py-14 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-8 text-6xl">🏠</div>
          <div className="absolute top-8 right-12 text-4xl">🏡</div>
          <div className="absolute bottom-4 left-16 text-5xl">🏢</div>
          <div className="absolute bottom-8 right-8 text-3xl">🏠</div>
        </div>
        <div className="relative z-10">
          <div className="inline-block bg-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full mb-4 backdrop-blur-sm">
            🎉 Zero brokerage. Always.
          </div>
          <h2 className="text-4xl font-black text-white mb-3 leading-tight">Find Your<br/>Perfect Home</h2>
          <p className="text-blue-200 mb-8 text-sm">Direct from owners. Verified listings. Lucknow only.</p>
          <div className="max-w-md mx-auto relative">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Gomti Nagar, Aliganj..." className="w-full px-5 py-4 rounded-2xl text-gray-800 text-sm focus:outline-none shadow-2xl pr-12 font-medium" />
            <span className="absolute right-4 top-3.5 text-xl">🔍</span>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex gap-6 justify-center text-center">
        <div>
          <p className="text-lg font-black text-blue-600">{listings.length}</p>
          <p className="text-xs text-gray-400">Active Listings</p>
        </div>
        <div className="border-l border-gray-100 pl-6">
          <p className="text-lg font-black text-emerald-500">₹0</p>
          <p className="text-xs text-gray-400">Brokerage</p>
        </div>
        <div className="border-l border-gray-100 pl-6">
          <p className="text-lg font-black text-purple-500">Direct</p>
          <p className="text-xs text-gray-400">Owner Contact</p>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex gap-2 flex-wrap items-center overflow-x-auto">
        <select value={loc} onChange={e => setLoc(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 font-medium">
          <option value="All">All Areas</option>
          <option value="Gomti Nagar">Gomti Nagar</option>
          <option value="Aliganj">Aliganj</option>
          <option value="Hazratganj">Hazratganj</option>
          <option value="Indira Nagar">Indira Nagar</option>
          <option value="Vikas Nagar">Vikas Nagar</option>
          <option value="Mahanagar">Mahanagar</option>
          <option value="Rajajipuram">Rajajipuram</option>
        </select>
        <select value={fur} onChange={e => setFur(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 font-medium">
          <option value="All">All Types</option>
          <option value="Furnished">Furnished</option>
          <option value="Semi Furnished">Semi Furnished</option>
          <option value="Unfurnished">Unfurnished</option>
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs font-bold text-gray-700">₹{max.toLocaleString()}</span>
          <input type="range" min="5000" max="50000" step="1000" value={max} onChange={e => setMax(Number(e.target.value))} className="w-24 accent-blue-600" />
        </div>
        <span className="text-xs text-gray-400 bg-blue-50 text-blue-600 font-semibold px-3 py-1 rounded-full">{filtered.length} homes</span>
      </div>

      {/* Grid */}
      <div className="px-4 py-6 max-w-6xl mx-auto">
        {loading ? (
          <div className="text-center py-24">
            <p className="text-5xl mb-4 animate-bounce">🏠</p>
            <p className="text-gray-400 font-medium">Finding homes for you...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(l => <Card key={l.id} l={l} />)}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-6xl mb-4">🏠</p>
            <p className="text-gray-700 font-bold text-lg">No listings yet</p>
            <p className="text-gray-400 text-sm mt-1 mb-6">Be the first to list a property in Lucknow</p>
            <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200">
              + List Your Property Free
            </button>
          </div>
        )}
      </div>

      <div className="text-center py-8 text-gray-300 text-xs border-t border-gray-100 bg-white">
        Homie — Lucknow's no-broker rental platform 🏠
      </div>
    </div>
  )
}