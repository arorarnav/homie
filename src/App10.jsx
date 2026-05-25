import { useState, useEffect, useRef } from "react"
import { supabase } from "./supabase"
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

// ─── utils ────────────────────────────────────────────────────────────────────
function timeAgo(date) {
  const diff = Math.floor((new Date() - new Date(date)) / 1000)
  if (diff < 3600) return Math.floor(diff / 60) + "m ago"
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago"
  return Math.floor(diff / 86400) + "d ago"
}
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
function getPhotos(l) {
  if (l.images && l.images.length > 0) return l.images
  if (l.image_url) return [l.image_url]
  return []
}

// ─── onboarding ───────────────────────────────────────────────────────────────
const SLIDES = [
  {
    bg: "from-slate-900 to-slate-800",
    accent: "#f97316",
    emoji: "🏘️",
    tag: "Welcome to Homie",
    title: "Find a home.\nNot a headache.",
    body: "Lucknow's first no-broker rental platform. Every listing is directly from the owner — no middlemen, no commission, no drama.",
  },
  {
    bg: "from-orange-500 to-rose-600",
    accent: "#fff",
    emoji: "👆",
    tag: "How it works",
    title: "Swipe through homes\nlike you mean it.",
    body: "Swipe right to save a property you love. Swipe left to skip. One tap connects you directly to the owner on WhatsApp.",
  },
  {
    bg: "from-blue-600 to-indigo-700",
    accent: "#fff",
    emoji: "📍",
    tag: "Near you. Always.",
    title: "See what's available\naround you, right now.",
    body: "Listings sorted by distance. A live map showing every property near you. Fresh listings first — stale ones auto-expire.",
  },
]

function Onboarding({ onDone }) {
  const [slide, setSlide] = useState(0)
  const s = SLIDES[slide]
  const isLast = slide === SLIDES.length - 1

  return (
    <div className={`fixed inset-0 z-50 flex flex-col bg-gradient-to-br ${s.bg} transition-all duration-500`}>
      <button onClick={onDone} className="absolute top-6 right-6 text-white/50 text-sm font-semibold hover:text-white transition-colors z-10">
        Skip
      </button>

      <div className="flex-1 flex flex-col justify-end px-8 pb-10">
        <div className="text-7xl mb-8">{s.emoji}</div>

        <div className="inline-block border border-white/30 text-white/70 text-xs font-bold px-3 py-1 rounded-full mb-4 w-fit tracking-widest uppercase">
          {s.tag}
        </div>

        <h1 className="text-4xl font-black text-white leading-tight mb-4 whitespace-pre-line">
          {s.title}
        </h1>
        <p className="text-white/70 text-base leading-relaxed mb-10">
          {s.body}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => setSlide(i)} className={"h-1.5 rounded-full transition-all duration-300 " + (i === slide ? "w-8 bg-white" : "w-2 bg-white/30")} />
            ))}
          </div>
          <button
            onClick={() => isLast ? onDone() : setSlide(s => s + 1)}
            className="bg-white text-gray-900 font-black px-8 py-3.5 rounded-2xl text-base shadow-2xl active:scale-95 transition-all"
          >
            {isLast ? "Get Started →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── setup ────────────────────────────────────────────────────────────────────
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
      () => { setLocationDone(false); setLocating(false) }
    )
  }

  const types = [
    { id: "rent", label: "Rent", icon: "🏠", sub: "Monthly rentals" },
    { id: "sale", label: "Buy", icon: "🏷️", sub: "Properties for sale" },
    { id: "land", label: "Land", icon: "🌳", sub: "Plots & land" },
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white px-6 pt-14 pb-8">
      <div className="mb-10">
        <p className="text-xs font-bold text-orange-500 tracking-widest uppercase mb-2">One time setup</p>
        <h1 className="text-3xl font-black text-gray-900 leading-tight">What are you<br/>looking for?</h1>
      </div>

      <div className="flex flex-col gap-3 mb-8">
        {types.map(t => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={"flex items-center gap-4 p-4 rounded-2xl border-2 transition-all " + (type === t.id ? "border-orange-400 bg-orange-50" : "border-gray-100 bg-gray-50")}
          >
            <span className="text-3xl">{t.icon}</span>
            <div className="text-left">
              <p className={"font-black text-base " + (type === t.id ? "text-orange-600" : "text-gray-700")}>{t.label}</p>
              <p className="text-gray-400 text-xs">{t.sub}</p>
            </div>
            {type === t.id && <div className="ml-auto w-5 h-5 bg-orange-400 rounded-full flex items-center justify-center text-white text-xs font-black">✓</div>}
          </button>
        ))}
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-bold text-gray-600">Max budget</p>
          <p className="text-lg font-black text-orange-500">₹{budget.toLocaleString()}{type === "rent" ? "/mo" : ""}</p>
        </div>
        <input
          type="range"
          min="5000"
          max={type === "rent" ? 100000 : 10000000}
          step={type === "rent" ? 1000 : 100000}
          value={budget}
          onChange={e => setBudget(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
      </div>

      <button
        onClick={getLocation}
        disabled={locating}
        className={"w-full py-4 rounded-2xl border-2 font-bold text-sm transition-all mb-4 flex items-center justify-center gap-2 " + (locationDone ? "border-emerald-400 bg-emerald-50 text-emerald-600" : "border-gray-200 bg-gray-50 text-gray-600")}
      >
        {locating ? "Getting your location..." : locationDone ? "✅ Location set — listings near you first" : "📍 Allow location access"}
      </button>

      <button
        onClick={() => onDone({ type, budget, userLoc })}
        className="w-full bg-gray-900 hover:bg-gray-800 text-white font-black py-4 rounded-2xl text-lg active:scale-95 transition-all mt-auto"
      >
        Show me properties →
      </button>
    </div>
  )
}

// ─── listing detail ───────────────────────────────────────────────────────────
function ListingDetail({ listing, onClose }) {
  if (!listing) return null
  const photos = getPhotos(listing)
  const mapUrl = listing.latitude && listing.longitude
    ? null
    : `https://maps.google.com/maps?q=${encodeURIComponent(listing.title + " " + listing.location + " Lucknow")}&output=embed`

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
      {/* close button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-20 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-bold shadow-lg"
      >
        ←
      </button>

      <div className="flex-1 overflow-y-auto">
        {/* photos */}
        {photos.length > 0 ? (
          <div className="flex flex-col">
            {photos.map((url, i) => (
              <img key={i} src={url} alt={listing.title} className="w-full object-cover" style={{ maxHeight: "320px" }} />
            ))}
          </div>
        ) : (
          <div className="w-full h-72 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center text-8xl">🏠</div>
        )}

        {/* content */}
        <div className="px-5 py-6">
          {/* price + badge */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-3xl font-black text-gray-900">
                ₹{Number(listing.price).toLocaleString()}
                <span className="text-gray-400 text-base font-normal">{listing.type === "rent" ? "/mo" : ""}</span>
              </p>
              <p className="text-gray-500 text-sm mt-1">📍 {listing.location}, Lucknow</p>
            </div>
            {listing.furnished && (
              <span className="bg-blue-50 text-blue-600 text-xs font-bold px-3 py-1.5 rounded-full">{listing.furnished}</span>
            )}
          </div>

          <h2 className="text-xl font-black text-gray-900 mb-1">{listing.title}</h2>
          <p className="text-gray-400 text-xs mb-6">{timeAgo(listing.created_at)} · Listed on Homie</p>

          {/* stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {listing.beds && (
              <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-2xl mb-1">🛏</p>
                <p className="font-black text-gray-900">{listing.beds}</p>
                <p className="text-xs text-gray-400">Bedrooms</p>
              </div>
            )}
            {listing.baths && (
              <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-2xl mb-1">🚿</p>
                <p className="font-black text-gray-900">{listing.baths}</p>
                <p className="text-xs text-gray-400">Bathrooms</p>
              </div>
            )}
            {listing.sqft && (
              <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-2xl mb-1">📐</p>
                <p className="font-black text-gray-900">{listing.sqft}</p>
                <p className="text-xs text-gray-400">Sq. ft.</p>
              </div>
            )}
          </div>

          {/* owner */}
          <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-xl font-black text-orange-500">
              {listing.owner_name?.[0]?.toUpperCase() || "O"}
            </div>
            <div>
              <p className="font-black text-gray-900">{listing.owner_name}</p>
              <p className="text-gray-400 text-xs">Property Owner · Direct listing</p>
            </div>
            <div className="ml-auto bg-emerald-100 text-emerald-600 text-xs font-bold px-3 py-1.5 rounded-full">No broker</div>
          </div>

          {/* map */}
          {listing.latitude && listing.longitude ? (
            <div className="rounded-2xl overflow-hidden mb-6 h-52">
              <MapContainer center={[listing.latitude, listing.longitude]} zoom={15} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[listing.latitude, listing.longitude]}>
                  <Popup>{listing.title}</Popup>
                </Marker>
              </MapContainer>
            </div>
          ) : mapUrl ? (
            <div className="rounded-2xl overflow-hidden mb-6 h-52 bg-gray-100">
              <iframe src={mapUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" />
            </div>
          ) : null}

          <div className="h-24" />
        </div>
      </div>

      {/* sticky CTA */}
      <div className="bg-white border-t border-gray-100 px-5 py-4 shadow-2xl">
        <button
          onClick={() => window.open("https://wa.me/91" + listing.phone + "?text=Hi " + listing.owner_name + ", I saw your listing on Homie — " + listing.title + " in " + listing.location + ". Is it still available?")}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl text-base active:scale-95 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-200"
        >
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Message {listing.owner_name} on WhatsApp
        </button>
      </div>
    </div>
  )
}

// ─── swipe card ───────────────────────────────────────────────────────────────
function SwipeCard({ listing, onSwipe, onOpen }) {
  const startX = useRef(0)
  const currentX = useRef(0)
  const [offset, setOffset] = useState(0)
  const [direction, setDirection] = useState(null)
  const [photoIdx, setPhotoIdx] = useState(0)
  const dragging = useRef(false)
  const didDrag = useRef(false)

  const photos = getPhotos(listing)

  function onTouchStart(e) { startX.current = e.touches[0].clientX; didDrag.current = false }
  function onTouchMove(e) {
    const diff = e.touches[0].clientX - startX.current
    if (Math.abs(diff) > 5) didDrag.current = true
    currentX.current = diff; setOffset(diff); setDirection(diff > 0 ? "right" : "left")
  }
  function onTouchEnd() {
    if (Math.abs(currentX.current) > 90) onSwipe(currentX.current > 0 ? "right" : "left", listing)
    else { setOffset(0); setDirection(null) }
    currentX.current = 0
  }
  function onMouseDown(e) { dragging.current = true; didDrag.current = false; startX.current = e.clientX }
  function onMouseMove(e) {
    if (!dragging.current) return
    const diff = e.clientX - startX.current
    if (Math.abs(diff) > 5) didDrag.current = true
    currentX.current = diff; setOffset(diff); setDirection(diff > 0 ? "right" : "left")
  }
  function onMouseUp() {
    if (!dragging.current) return
    dragging.current = false
    if (Math.abs(currentX.current) > 90) onSwipe(currentX.current > 0 ? "right" : "left", listing)
    else { setOffset(0); setDirection(null) }
    currentX.current = 0
  }

  const rotate = offset / 18
  const opacity = Math.min(Math.abs(offset) / 90, 1)
  const isNew = (new Date() - new Date(listing.created_at)) < 86400000

  return (
    <div
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
      style={{ transform: `translateX(${offset}px) rotate(${rotate}deg)`, transition: offset === 0 ? "transform 0.3s ease" : "none" }}
      className="absolute w-full select-none cursor-grab active:cursor-grabbing"
    >
      {/* swipe indicators */}
      {direction === "right" && (
        <div style={{ opacity }} className="absolute top-8 left-5 z-20 border-4 border-emerald-400 text-emerald-400 font-black text-xl px-4 py-2 rounded-2xl -rotate-12 bg-white/80 backdrop-blur-sm">SAVE ❤️</div>
      )}
      {direction === "left" && (
        <div style={{ opacity }} className="absolute top-8 right-5 z-20 border-4 border-red-400 text-red-400 font-black text-xl px-4 py-2 rounded-2xl rotate-12 bg-white/80 backdrop-blur-sm">SKIP 👋</div>
      )}

      <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 mx-2">
        {/* photo */}
        <div className="relative h-80 bg-gray-100">
          {photos.length > 0
            ? <img src={photos[photoIdx]} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-8xl">🏠</div>
          }
          {/* photo nav dots */}
          {photos.length > 1 && (
            <div className="absolute top-3 left-0 right-0 flex justify-center gap-1 px-4">
              {photos.map((_, i) => (
                <div key={i} className={"flex-1 h-0.5 rounded-full transition-all " + (i === photoIdx ? "bg-white" : "bg-white/40")} />
              ))}
            </div>
          )}
          {/* tap zones */}
          {photos.length > 1 && (
            <>
              <div className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={e => { e.stopPropagation(); setPhotoIdx(i => Math.max(0, i - 1)) }} />
              <div className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={e => { e.stopPropagation(); setPhotoIdx(i => Math.min(photos.length - 1, i + 1)) }} />
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent pointer-events-none" />
          {isNew && <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-full animate-pulse">🔴 NEW</div>}
          <div className="absolute top-4 right-4 bg-white/95 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="font-black text-gray-900 text-sm">₹{Number(listing.price).toLocaleString()}</span>
            <span className="text-gray-400 text-xs">{listing.type === "rent" ? "/mo" : ""}</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5 pointer-events-none">
            <h2 className="text-2xl font-black text-white leading-tight">{listing.title}</h2>
            <p className="text-white/75 text-sm mt-1">📍 {listing.location}{listing.distance ? " · " + listing.distance + " km" : ""}</p>
          </div>
        </div>

        {/* info */}
        <div className="p-4">
          <div className="flex gap-2 text-xs flex-wrap mb-3">
            {listing.beds && <span className="bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl font-semibold text-gray-600">🛏 {listing.beds} Beds</span>}
            {listing.baths && <span className="bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl font-semibold text-gray-600">🚿 {listing.baths} Baths</span>}
            {listing.sqft && <span className="bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl font-semibold text-gray-600">📐 {listing.sqft} sqft</span>}
            {listing.furnished && <span className="bg-blue-50 border border-blue-100 text-blue-600 px-3 py-1.5 rounded-xl font-semibold">{listing.furnished}</span>}
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400">👤 {listing.owner_name} · {timeAgo(listing.created_at)}</p>
            <button onClick={() => !didDrag.current && onOpen(listing)} className="text-xs text-blue-600 font-bold underline underline-offset-2">Details →</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onSwipe("left", listing)} className="flex-1 py-3.5 rounded-2xl bg-gray-100 hover:bg-red-50 text-2xl transition-all active:scale-95">👋</button>
            <button
              onClick={() => window.open("https://wa.me/91" + listing.phone + "?text=Hi " + listing.owner_name + ", I saw " + listing.title + " on Homie. Still available?")}
              className="flex-1 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm transition-all active:scale-95"
            >WhatsApp</button>
            <button onClick={() => onSwipe("right", listing)} className="flex-1 py-3.5 rounded-2xl bg-gray-100 hover:bg-emerald-50 text-2xl transition-all active:scale-95">❤️</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── map view ─────────────────────────────────────────────────────────────────
function MapView({ listings, userLoc, onOpen }) {
  const center = userLoc ? [userLoc.lat, userLoc.lng] : [26.8467, 80.9462]
  const pinned = listings.filter(l => l.latitude && l.longitude)

  return (
    <div className="relative h-full">
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} className="z-0">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />

        {/* user location */}
        {userLoc && (
          <>
            <Circle center={[userLoc.lat, userLoc.lng]} radius={300} pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.15, weight: 2 }} />
            <Marker position={[userLoc.lat, userLoc.lng]}>
              <Popup><b>You are here</b></Popup>
            </Marker>
          </>
        )}

        {/* property pins */}
        {pinned.map(l => (
          <Marker key={l.id} position={[l.latitude, l.longitude]}>
            <Popup>
              <div className="text-sm min-w-[160px]">
                {l.image_url && <img src={l.image_url} alt="" className="w-full h-24 object-cover rounded-lg mb-2" />}
                <p className="font-black text-gray-900 text-sm">{l.title}</p>
                <p className="text-orange-500 font-bold">₹{Number(l.price).toLocaleString()}{l.type === "rent" ? "/mo" : ""}</p>
                <p className="text-gray-400 text-xs mb-2">📍 {l.location}</p>
                <button onClick={() => onOpen(l)} className="w-full bg-gray-900 text-white text-xs font-bold py-2 rounded-lg">View Details</button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {pinned.length === 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-xl z-10 text-center">
          <p className="text-sm text-gray-500">No pinned listings yet.</p>
          <p className="text-xs text-gray-400 mt-1">When owners add their location, pins appear here.</p>
        </div>
      )}

      <div className="absolute top-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg z-10 flex items-center justify-between">
        <p className="text-sm font-black text-gray-900">🗺️ Live Map</p>
        <p className="text-xs text-gray-400">{pinned.length} pinned · {listings.length} total</p>
      </div>
    </div>
  )
}

// ─── photo uploader ───────────────────────────────────────────────────────────
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
      <div className="flex gap-2 flex-wrap">
        {photos.map((url, idx) => (
          <div key={idx} className="relative w-20 h-20">
            <img src={url} alt="" className="w-full h-full object-cover rounded-xl" />
            <button onClick={() => removePhoto(idx)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow">✕</button>
          </div>
        ))}
        {photos.length < 5 && (
          <label className={"w-20 h-20 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors " + (uploading ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-gray-50 hover:border-orange-400")}>
            <span className="text-xl">{uploading ? "⏳" : "📸"}</span>
            <span className="text-xs text-gray-400 mt-1">{uploading ? "..." : photos.length === 0 ? "Add photo" : "Add more"}</span>
            <input type="file" accept="image/*" multiple onChange={uploadPhoto} className="hidden" />
          </label>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-2">{photos.length}/5 · First photo is your cover shot</p>
    </div>
  )
}

// ─── upload form ──────────────────────────────────────────────────────────────
function UploadForm({ onClose, onSuccess, activeTab }) {
  const [form, setForm] = useState({ title: "", price: "", location: "Gomti Nagar", furnished: "Furnished", beds: "", baths: "", sqft: "", phone: "", owner_name: "", image_url: "", images: [], type: activeTab, latitude: null, longitude: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [locating, setLocating] = useState(false)
  const [locationSet, setLocationSet] = useState(false)

  function handle(e) { setForm({ ...form, [e.target.name]: e.target.value }) }
  function handlePhotos(urls) { setForm(f => ({ ...f, images: urls, image_url: urls[0] || "" })) }
  function getLocation() {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })); setLocationSet(true); setLocating(false) },
      () => { setError("Could not get location. Please allow access."); setLocating(false) }
    )
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

  const input = "w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 placeholder-gray-300"

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-6 pt-6 pb-4 border-b border-gray-50 rounded-t-3xl flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-gray-900">List Your Property</h2>
            <p className="text-xs text-orange-500 font-bold mt-0.5">Free forever. No broker fees.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">✕</button>
        </div>
        <div className="px-6 pb-8 pt-5 flex flex-col gap-4">
          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-100 px-4 py-3 rounded-2xl">{error}</div>}

          <div>
            <p className="text-sm font-black text-gray-700 mb-2">Photos <span className="text-gray-400 font-normal">(up to 5)</span></p>
            <PhotoUploader onPhotosChange={handlePhotos} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input name="owner_name" placeholder="Your name *" value={form.owner_name} onChange={handle} className={input} />
            <input name="phone" placeholder="WhatsApp number *" value={form.phone} onChange={handle} className={input} />
          </div>
          <input name="title" placeholder="Property title * (e.g. 3BHK in Gomti Nagar)" value={form.title} onChange={handle} className={input} />
          <div className="grid grid-cols-2 gap-3">
            <input name="price" placeholder={activeTab === "rent" ? "Monthly rent ₹ *" : "Asking price ₹ *"} type="number" value={form.price} onChange={handle} className={input} />
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
            : <input name="sqft" placeholder="Plot size (sqft)" type="number" value={form.sqft} onChange={handle} className={input} />
          }
          <button type="button" onClick={getLocation} disabled={locating} className={"w-full py-3.5 rounded-2xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-2 " + (locationSet ? "border-emerald-400 bg-emerald-50 text-emerald-600" : "border-gray-200 bg-gray-50 text-gray-500 hover:border-orange-300")}>
            {locating ? "📍 Getting location..." : locationSet ? "✅ Location pinned on map!" : "📍 Pin my property on the map"}
          </button>
          <button onClick={submit} disabled={loading} className="w-full bg-gray-900 hover:bg-gray-800 text-white font-black py-4 rounded-2xl disabled:opacity-40 text-base active:scale-95 transition-all">
            {loading ? "Publishing..." : "Publish Listing — Free 🏠"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── main ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState("loading")
  const [prefs, setPrefs] = useState(null)
  const [listings, setListings] = useState([])
  const [queue, setQueue] = useState([])
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem("homie_saved") || "[]"))
  const [activeTab, setActiveTab] = useState("browse")
  const [viewMode, setViewMode] = useState("swipe")
  const [showForm, setShowForm] = useState(false)
  const [openListing, setOpenListing] = useState(null)

  useEffect(() => {
    const seen = localStorage.getItem("homie_onboarded")
    if (seen) {
      const p = JSON.parse(localStorage.getItem("homie_prefs") || "null")
      if (p) { setPrefs(p); setPhase("app"); fetchListings(p) }
      else setPhase("setup")
    } else setPhase("onboarding")
  }, [])

  async function fetchListings(p) {
    const { data } = await supabase.from("listings").select("*").eq("type", p.type).order("created_at", { ascending: false })
    const result = (data || [])
      .filter(l => Number(l.price) <= p.budget)
      .map(l => ({ ...l, distance: p.userLoc && l.latitude && l.longitude ? getDistanceKm(p.userLoc.lat, p.userLoc.lng, l.latitude, l.longitude).toFixed(1) : null }))
      .sort((a, b) => (a.distance && b.distance ? a.distance - b.distance : 0))
    setListings(result)
    setQueue(result)
  }

  function handleOnboardingDone() { localStorage.setItem("homie_onboarded", "1"); setPhase("setup") }
  function handleSetupDone(p) { localStorage.setItem("homie_prefs", JSON.stringify(p)); setPrefs(p); setPhase("app"); fetchListings(p) }
  function handleSwipe(dir, listing) {
    if (dir === "right") {
      const newSaved = [...saved.filter(s => s.id !== listing.id), listing]
      setSaved(newSaved)
      localStorage.setItem("homie_saved", JSON.stringify(newSaved))
    }
    setQueue(q => q.filter(l => l.id !== listing.id))
  }

  if (phase === "loading") return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-6xl animate-bounce">🏠</p></div>
  if (phase === "onboarding") return <Onboarding onDone={handleOnboardingDone} />
  if (phase === "setup") return <Setup onDone={handleSetupDone} />

  const topCards = queue.slice(0, 3)

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {showForm && <UploadForm onClose={() => setShowForm(false)} onSuccess={() => prefs && fetchListings(prefs)} activeTab={prefs?.type || "rent"} />}
      {openListing && <ListingDetail listing={openListing} onClose={() => setOpenListing(null)} />}

      {/* header */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex justify-between items-center shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏠</span>
          <div>
            <h1 className="text-lg font-black text-gray-900 leading-none">Homie</h1>
            <p className="text-xs text-gray-400 leading-none mt-0.5">No brokers. No BS.</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {activeTab === "browse" && (
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button onClick={() => setViewMode("swipe")} className={"px-3 py-1.5 rounded-lg text-xs font-black transition-all " + (viewMode === "swipe" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400")}>Swipe</button>
              <button onClick={() => setViewMode("map")} className={"px-3 py-1.5 rounded-lg text-xs font-black transition-all " + (viewMode === "map" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400")}>Map</button>
            </div>
          )}
          <button onClick={() => setShowForm(true)} className="bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-black active:scale-95 transition-all">+ List</button>
        </div>
      </div>

      {/* browse — swipe */}
      {activeTab === "browse" && viewMode === "swipe" && (
        <div className="flex-1 flex flex-col items-center justify-center px-3 py-4 overflow-hidden">
          {queue.length === 0 ? (
            <div className="text-center px-8">
              <p className="text-6xl mb-4">🎉</p>
              <p className="text-gray-900 font-black text-2xl mb-2">All caught up!</p>
              <p className="text-gray-400 text-sm mb-8">You've seen all listings in your budget. Check back soon — new ones drop daily.</p>
              <button onClick={() => prefs && fetchListings(prefs)} className="bg-gray-900 text-white px-8 py-3.5 rounded-2xl font-black">Refresh listings</button>
            </div>
          ) : (
            <>
              <div className="relative w-full max-w-sm" style={{ height: "540px" }}>
                {topCards.map((l, i) => (
                  <div key={l.id} style={{ top: i * 10 + "px", transform: `scale(${1 - i * 0.04})`, zIndex: 10 - i, position: "absolute", width: "100%" }}>
                    {i === 0
                      ? <SwipeCard listing={l} onSwipe={handleSwipe} onOpen={setOpenListing} />
                      : <div className={"bg-white rounded-3xl shadow border border-gray-100 mx-2 h-12 " + (i === 1 ? "opacity-60" : "opacity-30")} />
                    }
                  </div>
                ))}
              </div>
              <p className="text-gray-400 text-xs mt-3 font-medium">{queue.length} properties left · ❤️ to save · 👋 to skip</p>
            </>
          )}
        </div>
      )}

      {/* browse — map */}
      {activeTab === "browse" && viewMode === "map" && (
        <div className="flex-1 overflow-hidden">
          <MapView listings={listings} userLoc={prefs?.userLoc} onOpen={setOpenListing} />
        </div>
      )}

      {/* saved */}
      {activeTab === "saved" && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-5 pb-2 flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900">Saved</h2>
            {saved.length > 0 && <span className="text-sm font-bold text-orange-500">{saved.length} properties</span>}
          </div>
          {saved.length === 0 ? (
            <div className="text-center py-24 px-8">
              <p className="text-5xl mb-4">💔</p>
              <p className="text-gray-700 font-black text-lg mb-2">Nothing saved yet</p>
              <p className="text-gray-400 text-sm">Swipe right on listings you like and they'll appear here</p>
            </div>
          ) : (
            <div className="px-4 pb-6 flex flex-col gap-3">
              {saved.map(l => {
                const photos = getPhotos(l)
                return (
                  <button key={l.id} onClick={() => setOpenListing(l)} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex gap-0 text-left w-full active:scale-98 transition-all">
                    <div className="w-28 h-28 flex-shrink-0 bg-gray-100">
                      {photos[0]
                        ? <img src={photos[0]} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-3xl">🏠</div>
                      }
                    </div>
                    <div className="flex-1 p-3 min-w-0">
                      <p className="font-black text-gray-900 text-sm truncate">{l.title}</p>
                      <p className="text-gray-400 text-xs mt-0.5">📍 {l.location}</p>
                      <p className="text-gray-900 font-black text-base mt-1">₹{Number(l.price).toLocaleString()}<span className="text-gray-400 font-normal text-xs">{l.type === "rent" ? "/mo" : ""}</span></p>
                      <div className="flex gap-2 mt-2">
                        {l.beds && <span className="text-xs text-gray-400">🛏 {l.beds}</span>}
                        {l.baths && <span className="text-xs text-gray-400">🚿 {l.baths}</span>}
                        {l.sqft && <span className="text-xs text-gray-400">📐 {l.sqft}sqft</span>}
                      </div>
                    </div>
                    <div className="flex items-center pr-3 text-gray-300">›</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* list */}
      {activeTab === "list" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <p className="text-6xl mb-5">🏠</p>
          <h2 className="text-2xl font-black text-gray-900 mb-2 text-center">List your property for free</h2>
          <p className="text-gray-400 text-sm text-center mb-8 max-w-xs leading-relaxed">No broker commission. Direct inquiries on WhatsApp. Pinned on the map. Up in minutes.</p>
          <button onClick={() => setShowForm(true)} className="w-full max-w-xs bg-gray-900 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-all">Publish Free →</button>
        </div>
      )}

      {/* bottom tab bar */}
      <div className="bg-white border-t border-gray-100 flex-shrink-0">
        <div className="flex justify-around items-center py-2 max-w-md mx-auto">
          {[
            { id: "browse", icon: "🏠", label: "Browse" },
            { id: "saved", icon: "❤️", label: saved.length > 0 ? `Saved ${saved.length}` : "Saved" },
            { id: "list", icon: "➕", label: "List" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={"flex flex-col items-center gap-1 px-8 py-2 transition-all " + (activeTab === tab.id ? "text-gray-900" : "text-gray-300")}>
              <span className="text-2xl">{tab.icon}</span>
              <span className={"text-xs font-black " + (activeTab === tab.id ? "text-gray-900" : "text-gray-300")}>{tab.label}</span>
              {activeTab === tab.id && <div className="w-4 h-0.5 bg-gray-900 rounded-full" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}