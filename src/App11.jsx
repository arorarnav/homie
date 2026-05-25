import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "./supabase"
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet"
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
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
    const data = await res.json()
    return data.address?.suburb || data.address?.neighbourhood || data.address?.city_district || data.address?.city || "Your Location"
  } catch { return "Your Location" }
}
async function fetchNearby(lat, lng, type) {
  const queries = {
    hospital: `[out:json];node["amenity"~"hospital|clinic|pharmacy"](around:1500,${lat},${lng});out 5;`,
    cafe: `[out:json];node["amenity"~"cafe|restaurant|food_court"](around:1000,${lat},${lng});out 5;`,
    gym: `[out:json];node["leisure"~"fitness_centre|sports_centre"]["amenity"~"gym"](around:2000,${lat},${lng});out 5;`,
  }
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: queries[type] })
    const data = await res.json()
    return data.elements || []
  } catch { return [] }
}

// ─── splash ───────────────────────────────────────────────────────────────────
function Splash({ onDone }) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState("")

  function getLocation() {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        const area = await reverseGeocode(lat, lng)
        onDone({ lat, lng, area })
      },
      () => { setError("Please allow location to continue."); setLocating(false) }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950 overflow-hidden">
      {/* background texture */}
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent" />

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center relative z-10">
        <div className="mb-3">
          <span className="text-xs font-black tracking-widest text-orange-500 uppercase">Homie</span>
        </div>
        <h1 className="text-5xl font-black text-white leading-tight mb-4">
          Rentals<br />
          <span className="text-orange-500">Reimagined.</span>
        </h1>
        <p className="text-gray-400 text-base leading-relaxed max-w-xs mb-16">
          No brokers. No commission. No BS.<br />Direct from owners in Lucknow.
        </p>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <button
          onClick={getLocation}
          disabled={locating}
          className="w-full max-w-xs bg-orange-500 hover:bg-orange-400 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-all shadow-2xl shadow-orange-500/30 disabled:opacity-60"
        >
          {locating ? "Finding you..." : "📍 Find Rentals Near Me"}
        </button>

        <p className="text-gray-600 text-xs mt-6">We use your location to show nearby listings first</p>
      </div>

      <div className="pb-8 text-center relative z-10">
        <p className="text-gray-700 text-xs">Lucknow's no-broker rental platform</p>
      </div>
    </div>
  )
}

// ─── listing detail ───────────────────────────────────────────────────────────
const AMENITY_ICONS = {
  "Parking": "🚗", "Lift": "🛗", "Generator": "⚡", "24/7 Water": "💧",
  "WiFi": "📶", "Gas Pipeline": "🔥", "Security": "🔐", "CCTV": "📹",
  "Pets Allowed": "🐾", "Bachelors OK": "👨", "AC": "❄️", "Furnished": "🛋️",
}

function ListingDetail({ listing, onClose, onSave, isSaved }) {
  const [tab, setTab] = useState("details")
  const [nearby, setNearby] = useState({ hospital: [], cafe: [], gym: [] })
  const [loadingNearby, setLoadingNearby] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)
  const photos = getPhotos(listing)

  useEffect(() => {
    if (tab === "living" && listing.latitude && listing.longitude) {
      setLoadingNearby(true)
      Promise.all([
        fetchNearby(listing.latitude, listing.longitude, "hospital"),
        fetchNearby(listing.latitude, listing.longitude, "cafe"),
        fetchNearby(listing.latitude, listing.longitude, "gym"),
      ]).then(([hospital, cafe, gym]) => {
        setNearby({ hospital, cafe, gym })
        setLoadingNearby(false)
      })
    }
  }, [tab])

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
      <button onClick={onClose} className="absolute top-4 left-4 z-30 w-10 h-10 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-bold">←</button>
      <button onClick={() => onSave(listing)} className={"absolute top-4 right-4 z-30 w-10 h-10 rounded-full flex items-center justify-center text-xl backdrop-blur-sm " + (isSaved ? "bg-red-500 text-white" : "bg-black/60 text-white")}>
        {isSaved ? "❤️" : "🤍"}
      </button>

      <div className="flex-1 overflow-y-auto">
        {/* photos */}
        <div className="relative h-80 bg-gray-100 flex-shrink-0">
          {photos.length > 0
            ? <img src={photos[photoIdx]} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-8xl">🏠</div>
          }
          {photos.length > 1 && (
            <>
              <div className="absolute top-4 left-0 right-0 flex justify-center gap-1 px-16">
                {photos.map((_, i) => <div key={i} className={"flex-1 h-0.5 rounded-full transition-all " + (i === photoIdx ? "bg-white" : "bg-white/40")} />)}
              </div>
              <div className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={() => setPhotoIdx(i => Math.max(0, i - 1))} />
              <div className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={() => setPhotoIdx(i => Math.min(photos.length - 1, i + 1))} />
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          <div className="absolute bottom-4 left-5 right-5 pointer-events-none">
            <p className="text-white text-2xl font-black leading-tight">{listing.title}</p>
            <p className="text-white/70 text-sm mt-1">📍 {listing.location}</p>
          </div>
        </div>

        {/* price bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-3xl font-black text-gray-900">₹{Number(listing.price).toLocaleString()}<span className="text-gray-400 text-base font-normal">/mo</span></p>
            <p className="text-xs text-gray-400 mt-0.5">{timeAgo(listing.created_at)} · by {listing.owner_name}</p>
          </div>
          {listing.distance && <div className="bg-blue-50 text-blue-600 text-sm font-black px-3 py-1.5 rounded-full">{listing.distance} km</div>}
        </div>

        {/* tabs */}
        <div className="flex border-b border-gray-100 px-5 gap-6">
          {["details", "amenities", "living", "map"].map(t => (
            <button key={t} onClick={() => setTab(t)} className={"py-3 text-sm font-black capitalize border-b-2 transition-all " + (tab === t ? "border-orange-500 text-orange-500" : "border-transparent text-gray-400")}>
              {t === "living" ? "Living" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* tab content */}
        <div className="px-5 py-5">
          {/* details */}
          {tab === "details" && (
            <div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {listing.beds && <div className="bg-gray-50 rounded-2xl p-4 text-center"><p className="text-2xl mb-1">🛏</p><p className="font-black text-gray-900">{listing.beds}</p><p className="text-xs text-gray-400">Beds</p></div>}
                {listing.baths && <div className="bg-gray-50 rounded-2xl p-4 text-center"><p className="text-2xl mb-1">🚿</p><p className="font-black text-gray-900">{listing.baths}</p><p className="text-xs text-gray-400">Baths</p></div>}
                {listing.sqft && <div className="bg-gray-50 rounded-2xl p-4 text-center"><p className="text-2xl mb-1">📐</p><p className="font-black text-gray-900">{listing.sqft}</p><p className="text-xs text-gray-400">Sqft</p></div>}
              </div>
              {listing.furnished && (
                <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 mb-4">
                  <p className="text-sm font-bold text-orange-600">🛋️ {listing.furnished}</p>
                </div>
              )}
              <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center font-black text-orange-500 text-lg">
                  {listing.owner_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-black text-gray-900">{listing.owner_name}</p>
                  <p className="text-gray-400 text-xs">Direct owner · No broker</p>
                </div>
                <div className="ml-auto bg-emerald-100 text-emerald-600 text-xs font-bold px-2 py-1 rounded-full">Verified</div>
              </div>
            </div>
          )}

          {/* amenities */}
          {tab === "amenities" && (
            <div>
              {listing.amenities && listing.amenities.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {listing.amenities.map(a => (
                    <div key={a} className="bg-gray-50 rounded-2xl p-3 flex flex-col items-center gap-1 text-center">
                      <span className="text-2xl">{AMENITY_ICONS[a] || "✓"}</span>
                      <span className="text-xs font-bold text-gray-600">{a}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">🏠</p>
                  <p className="text-gray-400 text-sm">No amenities listed by owner</p>
                </div>
              )}
            </div>
          )}

          {/* living view */}
          {tab === "living" && (
            <div>
              {!listing.latitude ? (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">📍</p>
                  <p className="text-gray-400 text-sm">Owner hasn't pinned this property yet</p>
                </div>
              ) : loadingNearby ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-sm animate-pulse">Finding nearby places...</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {[
                    { key: "hospital", label: "Hospitals & Clinics", icon: "🏥" },
                    { key: "cafe", label: "Cafes & Restaurants", icon: "☕" },
                    { key: "gym", label: "Gyms & Fitness", icon: "💪" },
                  ].map(({ key, label, icon }) => (
                    <div key={key}>
                      <p className="font-black text-gray-900 mb-3">{icon} {label}</p>
                      {nearby[key].length === 0 ? (
                        <p className="text-gray-400 text-sm">None found nearby</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {nearby[key].slice(0, 4).map((place, i) => (
                            <div key={i} className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center justify-between">
                              <p className="text-sm font-bold text-gray-700">{place.tags?.name || "Unnamed"}</p>
                              {listing.latitude && place.lat && (
                                <p className="text-xs text-gray-400">{getDistanceKm(listing.latitude, listing.longitude, place.lat, place.lon).toFixed(1)} km</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* map */}
          {tab === "map" && (
            <div className="rounded-2xl overflow-hidden h-72">
              {listing.latitude && listing.longitude ? (
                <MapContainer center={[listing.latitude, listing.longitude]} zoom={15} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[listing.latitude, listing.longitude]}>
                    <Popup>{listing.title}</Popup>
                  </Marker>
                  <Circle center={[listing.latitude, listing.longitude]} radius={200} pathOptions={{ color: "#f97316", fillColor: "#f97316", fillOpacity: 0.1 }} />
                </MapContainer>
              ) : (
                <div className="h-full bg-gray-50 flex flex-col items-center justify-center">
                  <p className="text-4xl mb-3">🗺️</p>
                  <p className="text-gray-400 text-sm">No exact location shared</p>
                  <p className="text-gray-300 text-xs mt-1">Listed in {listing.location}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="h-24" />
      </div>

      {/* sticky CTA */}
      <div className="bg-white border-t border-gray-100 px-5 py-4">
        <button
          onClick={() => window.open("https://wa.me/91" + listing.phone + "?text=Hi " + listing.owner_name + ", I saw your listing on Homie — " + listing.title + " in " + listing.location + ". Is it still available?")}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl text-base active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
        >
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Message {listing.owner_name} on WhatsApp
        </button>
      </div>
    </div>
  )
}

// ─── swipe stack ──────────────────────────────────────────────────────────────
function SwipeStack({ listings, onSwipe, onOpen }) {
  const [cards, setCards] = useState(listings)
  const [gone, setGone] = useState(new Set())
  const [current, setCurrent] = useState(0)

  useEffect(() => { setCards(listings); setGone(new Set()); setCurrent(0) }, [listings])

  const cardRef = useRef(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const offsetX = useRef(0)
  const isDragging = useRef(false)
  const didDrag = useRef(false)
  const [dragState, setDragState] = useState({ x: 0, dir: null })

  const listing = cards[current]

  function handleStart(clientX, clientY) {
    startX.current = clientX
    startY.current = clientY
    offsetX.current = 0
    isDragging.current = true
    didDrag.current = false
  }

  function handleMove(clientX) {
    if (!isDragging.current) return
    const diff = clientX - startX.current
    if (Math.abs(diff) > 8) didDrag.current = true
    offsetX.current = diff
    setDragState({ x: diff, dir: diff > 0 ? "right" : "left" })
  }

  function handleEnd() {
    if (!isDragging.current) return
    isDragging.current = false
    const threshold = 90
    if (Math.abs(offsetX.current) > threshold) {
      const dir = offsetX.current > 0 ? "right" : "left"
      // animate out
      setDragState({ x: dir === "right" ? 600 : -600, dir })
      setTimeout(() => {
        onSwipe(dir, listing)
        setCurrent(c => c + 1)
        setDragState({ x: 0, dir: null })
      }, 300)
    } else {
      setDragState({ x: 0, dir: null })
      offsetX.current = 0
    }
  }

  if (!listing || current >= cards.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <p className="text-6xl mb-4">🎉</p>
        <p className="text-gray-900 font-black text-2xl mb-2">All caught up!</p>
        <p className="text-gray-400 text-sm mb-8">You've seen all listings. Check back soon.</p>
        <button onClick={() => { setCurrent(0); setGone(new Set()) }} className="bg-gray-900 text-white px-8 py-3.5 rounded-2xl font-black">Start Over</button>
      </div>
    )
  }

  const photos = getPhotos(listing)
  const rotate = dragState.x / 18
  const opacity = Math.min(Math.abs(dragState.x) / 90, 1)
  const isNew = (new Date() - new Date(listing.created_at)) < 86400000
  const nextCard = cards[current + 1]

  return (
    <div className="flex-1 flex flex-col items-center justify-start px-3 pt-3 pb-2 overflow-hidden">
      <div className="relative w-full max-w-sm flex-1" style={{ maxHeight: "560px" }}>
        {/* next card peek */}
        {nextCard && (
          <div className="absolute inset-x-4 top-3 bottom-0 bg-white rounded-3xl shadow border border-gray-100 z-0" style={{ transform: "scale(0.95)" }} />
        )}

        {/* main card */}
        <div
          ref={cardRef}
          onTouchStart={e => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={e => handleMove(e.touches[0].clientX)}
          onTouchEnd={handleEnd}
          onMouseDown={e => handleStart(e.clientX, e.clientY)}
          onMouseMove={e => { if (isDragging.current) handleMove(e.clientX) }}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          style={{
            transform: `translateX(${dragState.x}px) rotate(${rotate}deg)`,
            transition: isDragging.current ? "none" : "transform 0.3s ease",
            zIndex: 10,
          }}
          className="absolute inset-0 bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 select-none cursor-grab active:cursor-grabbing"
        >
          {/* save indicator */}
          {dragState.dir === "right" && (
            <div style={{ opacity }} className="absolute top-8 left-5 z-20 border-4 border-emerald-400 text-emerald-500 font-black text-xl px-4 py-2 rounded-2xl -rotate-12 bg-white/90">SAVE ❤️</div>
          )}
          {dragState.dir === "left" && (
            <div style={{ opacity }} className="absolute top-8 right-5 z-20 border-4 border-red-400 text-red-500 font-black text-xl px-4 py-2 rounded-2xl rotate-12 bg-white/90">SKIP 👋</div>
          )}

          {/* photo */}
          <div className="relative h-72 bg-gray-100">
            {photos.length > 0
              ? <img src={photos[0]} alt="" className="w-full h-full object-cover pointer-events-none" />
              : <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-8xl">🏠</div>
            }
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
            {isNew && <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-full">🔴 NEW</div>}
            <div className="absolute top-4 right-4 bg-white/95 rounded-xl px-3 py-1.5">
              <span className="font-black text-gray-900">₹{Number(listing.price).toLocaleString()}</span>
              <span className="text-gray-400 text-xs">/mo</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h2 className="text-xl font-black text-white leading-tight">{listing.title}</h2>
              <p className="text-white/75 text-sm mt-0.5">📍 {listing.location}{listing.distance ? " · " + listing.distance + " km" : ""}</p>
            </div>
          </div>

          {/* info */}
          <div className="p-4">
            <div className="flex gap-2 flex-wrap mb-3">
              {listing.beds && <span className="bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600">🛏 {listing.beds} Beds</span>}
              {listing.baths && <span className="bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600">🚿 {listing.baths} Baths</span>}
              {listing.sqft && <span className="bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600">📐 {listing.sqft} sqft</span>}
              {listing.furnished && <span className="bg-orange-50 border border-orange-100 text-orange-600 px-3 py-1.5 rounded-xl text-xs font-semibold">{listing.furnished}</span>}
            </div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">👤 {listing.owner_name} · {timeAgo(listing.created_at)}</p>
              <button
                onClick={() => !didDrag.current && onOpen(listing)}
                className="text-xs text-orange-500 font-black"
                onMouseDown={e => e.stopPropagation()}
              >
                Details →
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { onSwipe("left", listing); setCurrent(c => c + 1) }}
                onMouseDown={e => e.stopPropagation()}
                className="flex-1 py-3.5 rounded-2xl bg-gray-100 hover:bg-red-50 text-2xl transition-all active:scale-95"
              >👋</button>
              <button
                onClick={() => window.open("https://wa.me/91" + listing.phone + "?text=Hi, I saw " + listing.title + " on Homie. Still available?")}
                onMouseDown={e => e.stopPropagation()}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm transition-all active:scale-95"
              >WhatsApp</button>
              <button
                onClick={() => { onSwipe("right", listing); setCurrent(c => c + 1) }}
                onMouseDown={e => e.stopPropagation()}
                className="flex-1 py-3.5 rounded-2xl bg-gray-100 hover:bg-orange-50 text-2xl transition-all active:scale-95"
              >❤️</button>
            </div>
          </div>
        </div>
      </div>
      <p className="text-gray-400 text-xs mt-2 font-medium flex-shrink-0">{cards.length - current} left · swipe or tap buttons</p>
    </div>
  )
}

// ─── map view ─────────────────────────────────────────────────────────────────
function MapView({ listings, userLoc, onOpen }) {
  const center = userLoc ? [userLoc.lat, userLoc.lng] : [26.8467, 80.9462]
  const pinned = listings.filter(l => l.latitude && l.longitude)
  return (
    <div className="relative flex-1 overflow-hidden">
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
        {userLoc && (
          <>
            <Circle center={[userLoc.lat, userLoc.lng]} radius={400} pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.1, weight: 2 }} />
            <Marker position={[userLoc.lat, userLoc.lng]}>
              <Popup><b>You are here</b></Popup>
            </Marker>
          </>
        )}
        {pinned.map(l => (
          <Marker key={l.id} position={[l.latitude, l.longitude]}>
            <Popup>
              <div className="min-w-[160px]">
                {getPhotos(l)[0] && <img src={getPhotos(l)[0]} alt="" className="w-full h-20 object-cover rounded-lg mb-2" />}
                <p className="font-black text-gray-900 text-sm">{l.title}</p>
                <p className="text-orange-500 font-bold text-sm">₹{Number(l.price).toLocaleString()}/mo</p>
                <p className="text-gray-400 text-xs mb-2">📍 {l.location}</p>
                <button onClick={() => onOpen(l)} className="w-full bg-gray-900 text-white text-xs font-bold py-2 rounded-lg">View Details</button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="absolute top-3 left-3 right-3 bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg z-10 flex items-center justify-between pointer-events-none">
        <p className="text-sm font-black text-gray-900">🗺️ Live Map</p>
        <p className="text-xs text-gray-400">{pinned.length} pinned · {listings.length} total</p>
      </div>
      {pinned.length === 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 rounded-2xl p-4 shadow-xl z-10 text-center">
          <p className="text-sm text-gray-500">No pinned listings yet. Listings appear here when owners add their location.</p>
        </div>
      )}
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
      if (!error) { const { data } = supabase.storage.from("photos").getPublicUrl(filename); urls.push(data.publicUrl) }
    }
    const newPhotos = [...photos, ...urls]
    setPhotos(newPhotos); onPhotosChange(newPhotos); setUploading(false)
  }
  function removePhoto(idx) { const n = photos.filter((_, i) => i !== idx); setPhotos(n); onPhotosChange(n) }
  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        {photos.map((url, idx) => (
          <div key={idx} className="relative w-20 h-20">
            <img src={url} alt="" className="w-full h-full object-cover rounded-xl" />
            <button onClick={() => removePhoto(idx)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">✕</button>
          </div>
        ))}
        {photos.length < 5 && (
          <label className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 bg-gray-50">
            <span className="text-xl">{uploading ? "⏳" : "📸"}</span>
            <span className="text-xs text-gray-400 mt-1">{uploading ? "..." : "Add"}</span>
            <input type="file" accept="image/*" multiple onChange={uploadPhoto} className="hidden" />
          </label>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-2">{photos.length}/5 photos</p>
    </div>
  )
}

// ─── upload form ──────────────────────────────────────────────────────────────
const ALL_AMENITIES = ["Parking", "Lift", "Generator", "24/7 Water", "WiFi", "Gas Pipeline", "Security", "CCTV", "Pets Allowed", "Bachelors OK", "AC", "Furnished"]

function UploadForm({ onClose, onSuccess }) {
  const [form, setForm] = useState({ title: "", price: "", location: "", furnished: "Unfurnished", beds: "", baths: "", sqft: "", phone: "", owner_name: "", image_url: "", images: [], type: "rent", latitude: null, longitude: null, amenities: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [locating, setLocating] = useState(false)
  const [locationSet, setLocationSet] = useState(false)

  function handle(e) { setForm({ ...form, [e.target.name]: e.target.value }) }
  function toggleAmenity(a) {
    setForm(f => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a] }))
  }
  function handlePhotos(urls) { setForm(f => ({ ...f, images: urls, image_url: urls[0] || "" })) }
  function getLocation() {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })); setLocationSet(true); setLocating(false) },
      () => { setError("Could not get location."); setLocating(false) }
    )
  }
  async function submit() {
    if (!form.title || !form.price || !form.phone || !form.owner_name || !form.location) { setError("Please fill all required fields including location."); return }
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
            <p className="text-xs text-orange-500 font-bold mt-0.5">Free. No broker fees.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">✕</button>
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
          <input name="title" placeholder="Property title * (e.g. 3BHK Flat, Sector 7)" value={form.title} onChange={handle} className={input} />
          <input name="location" placeholder="Area / Locality * (type anything — Vijay Khand, Near Mall...)" value={form.location} onChange={handle} className={input} />
          <div className="grid grid-cols-2 gap-3">
            <input name="price" placeholder="Monthly rent ₹ *" type="number" value={form.price} onChange={handle} className={input} />
            <select name="furnished" value={form.furnished} onChange={handle} className={input}>
              <option value="Furnished">Furnished</option>
              <option value="Semi Furnished">Semi Furnished</option>
              <option value="Unfurnished">Unfurnished</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input name="beds" placeholder="Beds" type="number" value={form.beds} onChange={handle} className={input} />
            <input name="baths" placeholder="Baths" type="number" value={form.baths} onChange={handle} className={input} />
            <input name="sqft" placeholder="Sqft" type="number" value={form.sqft} onChange={handle} className={input} />
          </div>

          {/* amenities */}
          <div>
            <p className="text-sm font-black text-gray-700 mb-2">Amenities</p>
            <div className="flex flex-wrap gap-2">
              {ALL_AMENITIES.map(a => (
                <button key={a} type="button" onClick={() => toggleAmenity(a)} className={"px-3 py-1.5 rounded-xl text-xs font-bold border transition-all " + (form.amenities.includes(a) ? "bg-orange-500 text-white border-orange-500" : "bg-gray-50 text-gray-600 border-gray-200")}>
                  {AMENITY_ICONS[a]} {a}
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={getLocation} disabled={locating} className={"w-full py-3.5 rounded-2xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-2 " + (locationSet ? "border-emerald-400 bg-emerald-50 text-emerald-600" : "border-gray-200 bg-gray-50 text-gray-500")}>
            {locating ? "📍 Getting location..." : locationSet ? "✅ Property pinned on map!" : "📍 Pin my property on the map"}
          </button>
          <button onClick={submit} disabled={loading} className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl disabled:opacity-40 text-base active:scale-95 transition-all">
            {loading ? "Publishing..." : "Publish Listing — Free 🏠"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── main ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [userLoc, setUserLoc] = useState(null)
  const [area, setArea] = useState("")
  const [showSplash, setShowSplash] = useState(true)
  const [listings, setListings] = useState([])
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem("homie_saved") || "[]"))
  const [activeTab, setActiveTab] = useState("browse")
  const [viewMode, setViewMode] = useState("swipe")
  const [showForm, setShowForm] = useState(false)
  const [openListing, setOpenListing] = useState(null)
  const [budget, setBudget] = useState(50000)
  const [showBudget, setShowBudget] = useState(false)

  useEffect(() => {
    const loc = JSON.parse(localStorage.getItem("homie_loc") || "null")
    if (loc) { setUserLoc(loc); setArea(loc.area || ""); setShowSplash(false); fetchListings(loc) }
  }, [])

  async function fetchListings(loc) {
    const { data } = await supabase.from("listings").select("*").eq("type", "rent").order("created_at", { ascending: false })
    const result = (data || []).map(l => ({
      ...l,
      distance: loc && l.latitude && l.longitude ? getDistanceKm(loc.lat, loc.lng, l.latitude, l.longitude).toFixed(1) : null
    })).sort((a, b) => (a.distance && b.distance ? a.distance - b.distance : 0))
    setListings(result)
  }

  function handleSplashDone(loc) {
    localStorage.setItem("homie_loc", JSON.stringify(loc))
    setUserLoc(loc); setArea(loc.area); setShowSplash(false); fetchListings(loc)
  }

  function handleSwipe(dir, listing) {
    if (dir === "right") {
      const newSaved = [...saved.filter(s => s.id !== listing.id), listing]
      setSaved(newSaved)
      localStorage.setItem("homie_saved", JSON.stringify(newSaved))
    }
  }

  function toggleSave(listing) {
    const isSaved = saved.some(s => s.id === listing.id)
    const newSaved = isSaved ? saved.filter(s => s.id !== listing.id) : [...saved, listing]
    setSaved(newSaved)
    localStorage.setItem("homie_saved", JSON.stringify(newSaved))
  }

  const filtered = listings.filter(l => Number(l.price) <= budget)

  if (showSplash) return <Splash onDone={handleSplashDone} />

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {showForm && <UploadForm onClose={() => setShowForm(false)} onSuccess={() => fetchListings(userLoc)} />}
      {openListing && <ListingDetail listing={openListing} onClose={() => setOpenListing(null)} onSave={toggleSave} isSaved={saved.some(s => s.id === openListing.id)} />}

      {/* header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-black text-gray-900 text-base flex-shrink-0">🏠 Homie</span>
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 flex-1 min-w-0 cursor-pointer" onClick={() => setShowSplash(true)}>
            <span className="text-orange-500 text-xs">📍</span>
            <span className="text-xs font-bold text-gray-700 truncate">{area || "Set location"}</span>
            <span className="text-gray-300 text-xs ml-auto flex-shrink-0">▾</span>
          </div>
        </div>
        <div className="flex gap-2 items-center ml-2 flex-shrink-0">
          {activeTab === "browse" && (
            <div className="flex bg-gray-100 rounded-xl p-0.5">
              <button onClick={() => setViewMode("swipe")} className={"px-2.5 py-1.5 rounded-lg text-xs font-black transition-all " + (viewMode === "swipe" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400")}>Swipe</button>
              <button onClick={() => setViewMode("map")} className={"px-2.5 py-1.5 rounded-lg text-xs font-black transition-all " + (viewMode === "map" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400")}>Map</button>
            </div>
          )}
          <button onClick={() => setShowForm(true)} className="bg-gray-900 text-white px-3 py-2 rounded-xl text-xs font-black active:scale-95 transition-all">+ List</button>
        </div>
      </div>

      {/* budget bar */}
      {activeTab === "browse" && viewMode === "swipe" && (
        <div className="bg-white border-b border-gray-50 px-4 py-2 flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-400 font-medium flex-shrink-0">Budget:</span>
          <input type="range" min="5000" max="100000" step="1000" value={budget} onChange={e => setBudget(Number(e.target.value))} className="flex-1 accent-orange-500" />
          <span className="text-xs font-black text-orange-500 flex-shrink-0">₹{budget.toLocaleString()}/mo</span>
        </div>
      )}

      {/* browse swipe */}
      {activeTab === "browse" && viewMode === "swipe" && (
        <SwipeStack listings={filtered} onSwipe={handleSwipe} onOpen={setOpenListing} />
      )}

      {/* browse map */}
      {activeTab === "browse" && viewMode === "map" && (
        <MapView listings={listings} userLoc={userLoc} onOpen={setOpenListing} />
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
              <p className="text-gray-400 text-sm">Swipe right or tap ❤️ on listings you like</p>
            </div>
          ) : (
            <div className="px-4 pb-6 flex flex-col gap-3">
              {saved.map(l => {
                const photos = getPhotos(l)
                return (
                  <button key={l.id} onClick={() => setOpenListing(l)} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex text-left w-full active:scale-[0.98] transition-all">
                    <div className="w-28 h-28 flex-shrink-0 bg-gray-100">
                      {photos[0] ? <img src={photos[0]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl">🏠</div>}
                    </div>
                    <div className="flex-1 p-3 min-w-0">
                      <p className="font-black text-gray-900 text-sm truncate">{l.title}</p>
                      <p className="text-gray-400 text-xs mt-0.5">📍 {l.location}</p>
                      <p className="text-gray-900 font-black text-base mt-1">₹{Number(l.price).toLocaleString()}<span className="text-gray-400 font-normal text-xs">/mo</span></p>
                      <div className="flex gap-2 mt-1">
                        {l.beds && <span className="text-xs text-gray-400">🛏 {l.beds}</span>}
                        {l.baths && <span className="text-xs text-gray-400">🚿 {l.baths}</span>}
                        {l.sqft && <span className="text-xs text-gray-400">📐 {l.sqft}sqft</span>}
                      </div>
                    </div>
                    <div className="flex items-center pr-3 text-gray-300 text-lg">›</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* list tab */}
      {activeTab === "list" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <p className="text-6xl mb-5">🏠</p>
          <h2 className="text-2xl font-black text-gray-900 mb-2 text-center">List your property free</h2>
          <p className="text-gray-400 text-sm text-center mb-8 max-w-xs leading-relaxed">No broker commission. Direct WhatsApp inquiries. Pinned on the map.</p>
          <button onClick={() => setShowForm(true)} className="w-full max-w-xs bg-gray-900 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-all">Publish Free →</button>
        </div>
      )}

      {/* bottom tabs */}
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