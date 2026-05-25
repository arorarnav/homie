import { useState, useEffect, useRef } from "react"
import { supabase } from "./supabase"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

// fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

function timeAgo(date) {
  const diff = Math.floor((new Date() - new Date(date)) / 1000)
  if (diff < 3600) return Math.floor(diff / 60) + "m ago"
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago"
  return Math.floor(diff / 86400) + "d ago"
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const SLIDES = [
  { emoji: "🏠", title: "Welcome to Homie", sub: "Lucknow's only no-broker property platform. Find homes, plots and properties — directly from owners." },
  { emoji: "👆", title: "Swipe to Browse", sub: "Swipe right to save a property. Swipe left to skip. No brokers. No commission. Ever." },
  { emoji: "📍", title: "Find What's Near You", sub: "See listings around you on a live map. Filter by budget, type and location in seconds." },
]

function Onboarding({ onDone }) {
  const [slide, setSlide] = useState(0)
  const isLast = slide === SLIDES.length - 1
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 px-8 text-center">
      <button onClick={onDone} className="absolute top-6 right-6 text-white/60 text-sm font-medium hover:text-white">Skip</button>
      <div className="text-8xl mb-8 animate-bounce">{SLIDES[slide].emoji}</div>
      <h1 className="text-3xl font-black text-white mb-4 leading-tight">{SLIDES[slide].title}</h1>
      <p className="text-blue-200 text-base leading-relaxed max-w-xs">{SLIDES[slide].sub}</p>
      <div className="flex gap-2 mt-10 mb-8">
        {SLIDES.map((_, i) => <div key={i} className={"h-2 rounded-full transition-all duration-300 " + (i === slide ? "w-8 bg-white" : "w-2 bg-white/30")} />)}
      </div>
      <button onClick={() => isLast ? onDone() : setSlide(s => s + 1)} className="bg-white text-blue-700 font-black px-10 py-4 rounded-2xl text-lg shadow-2xl active:scale-95 transition-all">
        {isLast ? "Let's Go 🚀" : "Next →"}
      </button>
    </div>
  )
}

function Setup({ onDone }) {
  const [type, setType] = useState("rent")
  const [budget, setBudget] = useState(20000)
  const [locating, setLocating] = useState(false)
  const [locationDone, setLocationDone] = useState(false)
  const [userLoc, setUserLoc] = useState(null)

  function getLocation() {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocationDone(true); setLocating(false) },
      () => { setLocationDone(true); setLocating(false) }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white px-6 pt-16 pb-8">
      <h1 className="text-3xl font-black text-gray-900 mb-2">Quick Setup</h1>
      <p className="text-gray-400 mb-10">Tell us what you're looking for</p>
      <p className="text-sm font-bold text-gray-600 mb-3">I'm looking to...</p>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[{ id: "rent", label: "Rent", icon: "🏠" }, { id: "sale", label: "Buy", icon: "🏷️" }, { id: "land", label: "Land", icon: "🌳" }].map(t => (
          <button key={t.id} onClick={() => setType(t.id)} className={"py-4 rounded-2xl border-2 font-bold text-sm flex flex-col items-center gap-1 transition-all " + (type === t.id ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500")}>
            <span className="text-2xl">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      <p className="text-sm font-bold text-gray-600 mb-3">Max budget: <span className="text-blue-600">₹{budget.toLocaleString()}{type === "rent" ? "/mo" : ""}</span></p>
      <input type="range" min="5000" max={type === "rent" ? 100000 : 10000000} step={type === "rent" ? 1000 : 100000} value={budget} onChange={e => setBudget(Number(e.target.value))} className="w-full accent-blue-600 mb-10" />
      <button onClick={getLocation} disabled={locating} className={"w-full py-4 rounded-2xl border-2 font-bold text-sm transition-all mb-4 " + (locationDone ? "border-emerald-400 bg-emerald-50 text-emerald-600" : "border-gray-200 bg-gray-50 text-gray-600")}>
        {locating ? "📍 Getting location..." : locationDone ? "✅ Location set!" : "📍 Allow Location Access"}
      </button>
      <button onClick={() => onDone({ type, budget, userLoc })} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl text-lg shadow-xl shadow-blue-200 active:scale-95 transition-all mt-auto">
        Find Properties 🏠
      </button>
    </div>
  )
}

function PhotoUploader({ onPhotosChange }) {
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)

  async function uploadPhoto(e) {
    const files = Array.from(e.target.files)
    if (photos.length + files.length > 5) { alert("Max 5 photos"); return }
    setUploading(true)
    const urls = []
    for (const file of files) {
      const filename = Date.now() + "-" + Math.random().toString(36).slice(2) + "-" + file.name.replace(/\s/g, "-")
      const { error } = await supabase.storage.from("photos").upload(filename, file)
      if (!error) {
        const { data } = supabase.storage.from("photos").getPublicUrl(filename)
        urls.push(data.publicUrl)
      }
    }
    const newPhotos = [...photos, ...urls]
    setPhotos(newPhotos)
    onPhotosChange(newPhotos)
    setUploading(false)
  }

  function removePhoto(idx) {
    const newPhotos = photos.filter((_, i) => i !== idx)
    setPhotos(newPhotos)
    onPhotosChange(newPhotos)
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-2">
        {photos.map((url, idx) => (
          <div key={idx} className="relative w-20 h-20">
            <img src={url} alt="" className="w-full h-full object-cover rounded-xl" />
            <button onClick={() => removePhoto(idx)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">✕</button>
          </div>
        ))}
        {photos.length < 5 && (
          <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 bg-gray-50">
            <span className="text-2xl">{uploading ? "⏳" : "📸"}</span>
            <span className="text-xs text-gray-400 mt-1">{uploading ? "..." : "Add"}</span>
            <input type="file" accept="image/*" multiple onChange={uploadPhoto} className="hidden" />
          </label>
        )}
      </div>
      <p className="text-xs text-gray-400">{photos.length}/5 photos · First photo is the cover</p>
    </div>
  )
}

function SwipeCard({ listing, onSwipe }) {
  const startX = useRef(0)
  const currentX = useRef(0)
  const [offset, setOffset] = useState(0)
  const [direction, setDirection] = useState(null)
  const [photoIdx, setPhotoIdx] = useState(0)
  const dragging = useRef(false)

  const allPhotos = listing.images?.length > 0 ? listing.images : listing.image_url ? [listing.image_url] : []

  function onTouchStart(e) { startX.current = e.touches[0].clientX }
  function onTouchMove(e) {
    const diff = e.touches[0].clientX - startX.current
    currentX.current = diff
    setOffset(diff)
    setDirection(diff > 0 ? "right" : "left")
  }
  function onTouchEnd() {
    if (Math.abs(currentX.current) > 100) onSwipe(currentX.current > 0 ? "right" : "left", listing)
    else { setOffset(0); setDirection(null) }
    currentX.current = 0
  }
  function onMouseDown(e) { dragging.current = true; startX.current = e.clientX }
  function onMouseMove(e) {
    if (!dragging.current) return
    const diff = e.clientX - startX.current
    currentX.current = diff
    setOffset(diff)
    setDirection(diff > 0 ? "right" : "left")
  }
  function onMouseUp() {
    if (!dragging.current) return
    dragging.current = false
    if (Math.abs(currentX.current) > 100) onSwipe(currentX.current > 0 ? "right" : "left", listing)
    else { setOffset(0); setDirection(null) }
    currentX.current = 0
  }

  const rotate = offset / 20
  const opacity = Math.min(Math.abs(offset) / 100, 1)

  return (
    <div
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
      style={{ transform: `translateX(${offset}px) rotate(${rotate}deg)`, transition: offset === 0 ? "transform 0.3s ease" : "none" }}
      className="absolute w-full select-none cursor-grab active:cursor-grabbing"
    >
      {direction === "right" && <div style={{ opacity }} className="absolute top-8 left-6 z-20 border-4 border-emerald-400 text-emerald-400 font-black text-2xl px-4 py-2 rounded-2xl rotate-[-15deg]">SAVE ❤️</div>}
      {direction === "left" && <div style={{ opacity }} className="absolute top-8 right-6 z-20 border-4 border-red-400 text-red-400 font-black text-2xl px-4 py-2 rounded-2xl rotate-[15deg]">SKIP 👋</div>}

      <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 mx-2">
        {/* photo gallery */}
        <div className="relative h-72 bg-gray-100">
          {allPhotos.length > 0
            ? <img src={allPhotos[photoIdx]} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center text-8xl">🏠</div>
          }
          {/* photo dots */}
          {allPhotos.length > 1 && (
            <div className="absolute top-3 left-0 right-0 flex justify-center gap-1">
              {allPhotos.map((_, i) => <div key={i} className={"h-1 rounded-full transition-all " + (i === photoIdx ? "w-6 bg-white" : "w-2 bg-white/50")} />)}
            </div>
          )}
          {/* tap zones to change photo */}
          {allPhotos.length > 1 && (
            <>
              <div className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={e => { e.stopPropagation(); setPhotoIdx(i => Math.max(0, i - 1)) }} />
              <div className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={e => { e.stopPropagation(); setPhotoIdx(i => Math.min(allPhotos.length - 1, i + 1)) }} />
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white pointer-events-none">
            <h2 className="text-2xl font-black leading-tight">{listing.title}</h2>
            <p className="text-white/80 text-sm">📍 {listing.location}{listing.distance ? " · " + listing.distance + " km away" : ""}</p>
          </div>
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-2xl px-3 py-1.5 pointer-events-none">
            <span className="font-black text-gray-900">₹{Number(listing.price).toLocaleString()}</span>
            <span className="text-gray-400 text-xs">{listing.type === "rent" ? "/mo" : ""}</span>
          </div>
          <div className="absolute bottom-16 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded-full pointer-events-none">{timeAgo(listing.created_at)}</div>
        </div>

        {/* details */}
        <div className="p-5">
          <div className="flex gap-2 text-xs text-gray-500 mb-4 flex-wrap">
            {listing.beds && <span className="bg-gray-50 px-3 py-1.5 rounded-xl font-medium">🛏 {listing.beds} Beds</span>}
            {listing.baths && <span className="bg-gray-50 px-3 py-1.5 rounded-xl font-medium">🚿 {listing.baths} Baths</span>}
            {listing.sqft && <span className="bg-gray-50 px-3 py-1.5 rounded-xl font-medium">📐 {listing.sqft} sqft</span>}
            {listing.furnished && <span className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl font-medium">{listing.furnished}</span>}
          </div>
          <p className="text-xs text-gray-400 mb-4">👤 {listing.owner_name}</p>
          <div className="flex gap-2">
            <button onClick={() => onSwipe("left", listing)} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-2xl hover:bg-red-50 transition-all">👋</button>
            <button onClick={() => window.open("https://wa.me/91" + listing.phone + "?text=Hi, I saw " + listing.title + " on Homie. Still available?")} className="flex-1 py-3.5 rounded-2xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-all">WhatsApp</button>
            <button onClick={() => onSwipe("right", listing)} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-2xl hover:bg-emerald-50 transition-all">❤️</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MapView({ listings, userLoc }) {
  const center = userLoc ? [userLoc.lat, userLoc.lng] : [26.8467, 80.9462]
  const [selected, setSelected] = useState(null)
  return (
    <div className="flex flex-col h-full relative">
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} className="z-0">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OpenStreetMap" />
        {listings.filter(l => l.latitude && l.longitude).map(l => (
          <Marker key={l.id} position={[l.latitude, l.longitude]} eventHandlers={{ click: () => setSelected(l) }}>
            <Popup>
              <div className="text-sm">
                <p className="font-bold">{l.title}</p>
                <p className="text-blue-600 font-bold">₹{Number(l.price).toLocaleString()}</p>
                <p className="text-gray-500">📍 {l.location}</p>
                <button onClick={() => window.open("https://wa.me/91" + l.phone)} className="mt-2 bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-bold w-full">WhatsApp</button>
              </div>
            </Popup>
          </Marker>
        ))}
        {userLoc && (
          <Marker position={[userLoc.lat, userLoc.lng]}>
            <Popup>You are here</Popup>
          </Marker>
        )}
      </MapContainer>
      {listings.filter(l => l.latitude && l.longitude).length === 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 rounded-2xl p-4 shadow-xl z-10">
          <p className="text-sm text-gray-500 text-center">No listings with location data yet. Ask owners to add their location when listing.</p>
        </div>
      )}
    </div>
  )
}

function UploadForm({ onClose, onSuccess, activeTab }) {
  const [form, setForm] = useState({ title: "", price: "", location: "Gomti Nagar", furnished: "Furnished", beds: "", baths: "", sqft: "", phone: "", owner_name: "", image_url: "", images: [], type: activeTab, latitude: null, longitude: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [locating, setLocating] = useState(false)
  const [locationSet, setLocationSet] = useState(false)

  function handle(e) { setForm({ ...form, [e.target.name]: e.target.value }) }

  function getLocation() {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })); setLocationSet(true); setLocating(false) },
      () => { setError("Could not get location."); setLocating(false) }
    )
  }

  function handlePhotos(urls) {
    setForm(f => ({ ...f, images: urls, image_url: urls[0] || "" }))
  }

  async function submit() {
    if (!form.title || !form.price || !form.phone || !form.owner_name) { setError("Please fill name, phone, title and price."); return }
    setLoading(true)
    const cleaned = { ...form, price: Number(form.price), beds: form.beds === "" ? null : Number(form.beds), baths: form.baths === "" ? null : Number(form.baths), sqft: form.sqft === "" ? null : Number(form.sqft) }
    const { error } = await supabase.from("listings").insert([cleaned]).select()
    setLoading(false)
    if (error) { setError(error.message); return }
    onSuccess(); onClose()
  }

  const input = "w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 placeholder-gray-400"

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-6 pt-6 pb-4 border-b border-gray-50 rounded-t-3xl flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-gray-900">List Your Property</h2>
            <p className="text-xs text-gray-400 mt-0.5">Free. No broker fees. Ever.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">✕</button>
        </div>
        <div className="px-6 pb-6 pt-4 flex flex-col gap-4">
          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-100 px-4 py-3 rounded-2xl">{error}</div>}
          <div>
            <p className="text-sm font-bold text-gray-600 mb-2">Photos (up to 5)</p>
            <PhotoUploader onPhotosChange={handlePhotos} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input name="owner_name" placeholder="Your Name *" value={form.owner_name} onChange={handle} className={input} />
            <input name="phone" placeholder="WhatsApp No. *" value={form.phone} onChange={handle} className={input} />
          </div>
          <input name="title" placeholder="Property Title *" value={form.title} onChange={handle} className={input} />
          <div className="grid grid-cols-2 gap-3">
            <input name="price" placeholder={activeTab === "rent" ? "Monthly Rent ₹ *" : "Price ₹ *"} type="number" value={form.price} onChange={handle} className={input} />
            {activeTab !== "land" && (
              <select name="furnished" value={form.furnished} onChange={handle} className={input}>
                <option value="Furnished">Furnished</option>
                <option value="Semi Furnished">Semi Furnished</option>
                <option value="Unfurnished">Unfurnished</option>
              </select>
            )}
          </div>
          <select name="location" value={form.location} onChange={handle} className={input}>
            {["Gomti Nagar","Aliganj","Hazratganj","Indira Nagar","Vikas Nagar","Mahanagar","Rajajipuram","Chinhat","Faizabad Road"].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          {activeTab !== "land"
            ? <div className="grid grid-cols-3 gap-3">
                <input name="beds" placeholder="Beds" type="number" value={form.beds} onChange={handle} className={input} />
                <input name="baths" placeholder="Baths" type="number" value={form.baths} onChange={handle} className={input} />
                <input name="sqft" placeholder="Sqft" type="number" value={form.sqft} onChange={handle} className={input} />
              </div>
            : <input name="sqft" placeholder="Plot Size (sqft)" type="number" value={form.sqft} onChange={handle} className={input} />
          }
          <button type="button" onClick={getLocation} disabled={locating} className={"w-full py-3 rounded-2xl text-sm font-bold border-2 transition-all " + (locationSet ? "border-emerald-400 bg-emerald-50 text-emerald-600" : "border-gray-200 bg-gray-50 text-gray-600")}>
            {locating ? "📍 Getting location..." : locationSet ? "✅ Location captured!" : "📍 Add My Location"}
          </button>
          <button onClick={submit} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl disabled:opacity-50 shadow-xl shadow-blue-200">
            {loading ? "Listing..." : "🏠 List My Property — Free"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [phase, setPhase] = useState("loading")
  const [prefs, setPrefs] = useState(null)
  const [listings, setListings] = useState([])
  const [queue, setQueue] = useState([])
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem("homie_saved") || "[]"))
  const [activeTab, setActiveTab] = useState("swipe")
  const [viewMode, setViewMode] = useState("swipe")
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem("homie_onboarded")
    if (seen) {
      const savedPrefs = JSON.parse(localStorage.getItem("homie_prefs") || "null")
      if (savedPrefs) { setPrefs(savedPrefs); setPhase("app") }
      else setPhase("setup")
    } else setPhase("onboarding")
  }, [])

  async function fetchListings(p) {
    const { data } = await supabase.from("listings").select("*").eq("type", p.type).order("created_at", { ascending: false })
    const filtered = (data || [])
      .filter(l => Number(l.price) <= p.budget)
      .map(l => ({
        ...l,
        distance: p.userLoc && l.latitude && l.longitude
          ? getDistanceKm(p.userLoc.lat, p.userLoc.lng, l.latitude, l.longitude).toFixed(1)
          : null
      }))
      .sort((a, b) => (a.distance && b.distance ? a.distance - b.distance : 0))
    setListings(filtered)
    setQueue(filtered)
  }

  function handleOnboardingDone() { localStorage.setItem("homie_onboarded", "1"); setPhase("setup") }

  function handleSetupDone(p) {
    localStorage.setItem("homie_prefs", JSON.stringify(p))
    setPrefs(p); setPhase("app"); fetchListings(p)
  }

  function handleSwipe(dir, listing) {
    if (dir === "right") {
      const newSaved = [...saved.filter(s => s.id !== listing.id), listing]
      setSaved(newSaved)
      localStorage.setItem("homie_saved", JSON.stringify(newSaved))
    }
    setQueue(q => q.filter(l => l.id !== listing.id))
  }

  if (phase === "loading") return <div className="min-h-screen bg-blue-600 flex items-center justify-center"><p className="text-6xl animate-bounce">🏠</p></div>
  if (phase === "onboarding") return <Onboarding onDone={handleOnboardingDone} />
  if (phase === "setup") return <Setup onDone={handleSetupDone} />

  const topCards = queue.slice(0, 3)

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {showForm && <UploadForm onClose={() => setShowForm(false)} onSuccess={() => fetchListings(prefs)} activeTab={prefs?.type || "rent"} />}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex justify-between items-center shadow-sm flex-shrink-0">
        <div>
          <h1 className="text-xl font-black text-gray-900">🏠 Homie</h1>
          <p className="text-xs text-gray-400">No brokers. No BS.</p>
        </div>
        <div className="flex gap-2 items-center">
          {activeTab === "swipe" && (
            <div className="flex bg-gray-100 rounded-2xl p-1">
              <button onClick={() => setViewMode("swipe")} className={"px-3 py-1.5 rounded-xl text-xs font-bold transition-all " + (viewMode === "swipe" ? "bg-white text-blue-600 shadow-sm" : "text-gray-400")}>Swipe</button>
              <button onClick={() => setViewMode("map")} className={"px-3 py-1.5 rounded-xl text-xs font-bold transition-all " + (viewMode === "map" ? "bg-white text-blue-600 shadow-sm" : "text-gray-400")}>Map</button>
            </div>
          )}
          <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-lg shadow-blue-200">+ List</button>
        </div>
      </div>

      {/* Swipe View */}
      {activeTab === "swipe" && viewMode === "swipe" && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-hidden">
          {queue.length === 0 ? (
            <div className="text-center">
              <p className="text-6xl mb-4">🎉</p>
              <p className="text-gray-700 font-black text-xl mb-2">You've seen everything!</p>
              <p className="text-gray-400 text-sm mb-6">Check back soon for new listings</p>
              <button onClick={() => fetchListings(prefs)} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold">Refresh</button>
            </div>
          ) : (
            <>
              <div className="relative w-full max-w-sm" style={{ height: "520px" }}>
                {topCards.map((l, i) => (
                  <div key={l.id} style={{ top: i * 8 + "px", transform: `scale(${1 - i * 0.03})`, zIndex: 10 - i, position: "absolute", width: "100%" }}>
                    {i === 0
                      ? <SwipeCard listing={l} onSwipe={handleSwipe} />
                      : <div className="bg-white rounded-3xl shadow-md border border-gray-100 mx-2 h-16 opacity-60" />
                    }
                  </div>
                ))}
              </div>
              <p className="text-gray-400 text-xs mt-3">{queue.length} left · Swipe right to save ❤️</p>
            </>
          )}
        </div>
      )}

      {/* Map View */}
      {activeTab === "swipe" && viewMode === "map" && (
        <div className="flex-1 overflow-hidden">
          <MapView listings={listings} userLoc={prefs?.userLoc} />
        </div>
      )}

      {/* Saved Tab */}
      {activeTab === "saved" && (
        <div className="flex-1 px-4 py-5 overflow-y-auto">
          <h2 className="text-xl font-black text-gray-900 mb-4">Saved ❤️ <span className="text-blue-600">{saved.length}</span></h2>
          {saved.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">💔</p>
              <p className="text-gray-400 font-medium">No saved properties yet</p>
              <p className="text-gray-300 text-sm mt-1">Swipe right on listings you like</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {saved.map(l => (
                <div key={l.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex gap-3 p-3">
                  {l.image_url || (l.images && l.images[0])
                    ? <img src={l.images?.[0] || l.image_url} alt="" className="w-20 h-20 object-cover rounded-xl flex-shrink-0" />
                    : <div className="w-20 h-20 bg-blue-50 rounded-xl flex items-center justify-center text-3xl flex-shrink-0">🏠</div>
                  }
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-gray-900 text-sm truncate">{l.title}</h3>
                    <p className="text-gray-400 text-xs">📍 {l.location}</p>
                    <p className="text-blue-600 font-bold text-sm mt-0.5">₹{Number(l.price).toLocaleString()}{l.type === "rent" ? "/mo" : ""}</p>
                    <button onClick={() => window.open("https://wa.me/91" + l.phone + "?text=Hi, I saw " + l.title + " on Homie. Still available?")} className="mt-2 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl">WhatsApp Owner</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* List Tab */}
      {activeTab === "list" && (
        <div className="flex-1 px-4 py-6 flex flex-col items-center justify-center">
          <p className="text-6xl mb-4">🏠</p>
          <h2 className="text-2xl font-black text-gray-900 mb-2">List Your Property</h2>
          <p className="text-gray-400 text-sm mb-8 text-center">Free. Direct. No brokers. Reach thousands of renters in Lucknow.</p>
          <button onClick={() => setShowForm(true)} className="w-full max-w-sm bg-blue-600 text-white font-black py-5 rounded-2xl text-lg shadow-xl shadow-blue-200">+ List Free 🏠</button>
        </div>
      )}

      {/* Bottom Tab Bar */}
      <div className="bg-white/95 backdrop-blur-sm border-t border-gray-100 shadow-2xl flex-shrink-0">
        <div className="flex justify-around items-center py-2 max-w-lg mx-auto">
          {[
            { id: "swipe", icon: "🏠", label: "Browse" },
            { id: "saved", icon: "❤️", label: saved.length > 0 ? "Saved " + saved.length : "Saved" },
            { id: "list", icon: "➕", label: "List" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={"flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all " + (activeTab === tab.id ? "text-blue-600" : "text-gray-400")}>
              <span className="text-2xl">{tab.icon}</span>
              <span className={"text-xs font-bold " + (activeTab === tab.id ? "text-blue-600" : "text-gray-400")}>{tab.label}</span>
              {activeTab === tab.id && <div className="w-1 h-1 bg-blue-600 rounded-full" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}