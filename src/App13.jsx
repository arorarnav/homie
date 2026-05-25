import { useState, useEffect, useRef } from "react"
import { supabase } from "./supabase"
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

// ─── design tokens ────────────────────────────────────────────────────────────
const COLORS = {
  cream: "#FAF7F2",
  surface: "#FFFFFF",
  terracotta: "#C25E3F",
  terracottaDark: "#A04A2E",
  ink: "#1A1A1A",
  muted: "#6B6358",
  border: "#EBE5DC",
}

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
    return data.address?.suburb || data.address?.neighbourhood || data.address?.city_district || data.address?.city || "Selected Location"
  } catch { return "Selected Location" }
}
async function fetchNearby(lat, lng, type) {
  const queries = {
    hospital: `[out:json];node["amenity"~"hospital|clinic|pharmacy"](around:1500,${lat},${lng});out 5;`,
    cafe: `[out:json];node["amenity"~"cafe|restaurant|food_court"](around:1000,${lat},${lng});out 5;`,
    gym: `[out:json];(node["leisure"~"fitness_centre|sports_centre"](around:2000,${lat},${lng});node["amenity"="gym"](around:2000,${lat},${lng}););out 5;`,
  }
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: queries[type] })
    const data = await res.json()
    return data.elements || []
  } catch { return [] }
}

const AMENITIES = ["Parking", "Lift", "Generator", "24/7 Water", "WiFi", "Gas Pipeline", "Security", "CCTV", "Pets Allowed", "Bachelors OK", "AC", "Furnished"]

// ─── reusable map picker ──────────────────────────────────────────────────────
function MapClickHandler({ onPick }) {
  useMapEvents({
    click(e) { onPick(e.latlng.lat, e.latlng.lng) }
  })
  return null
}

function RecenterMap({ center }) {
  const map = useMap()
  useEffect(() => { if (center) map.setView(center, 14) }, [center])
  return null
}

function MapPicker({ initialLat, initialLng, onConfirm, onClose }) {
  const [position, setPosition] = useState(initialLat && initialLng ? [initialLat, initialLng] : [26.8467, 80.9462])
  const [areaName, setAreaName] = useState("Tap on the map to pin location")
  const [confirming, setConfirming] = useState(false)

  async function updatePosition(lat, lng) {
    setPosition([lat, lng])
    const name = await reverseGeocode(lat, lng)
    setAreaName(name)
  }

  function useGPS() {
    navigator.geolocation.getCurrentPosition(
      pos => updatePosition(pos.coords.latitude, pos.coords.longitude),
      () => alert("Location access denied. You can still tap on the map.")
    )
  }

  async function confirm() {
    setConfirming(true)
    const name = await reverseGeocode(position[0], position[1])
    onConfirm({ lat: position[0], lng: position[1], area: name })
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: COLORS.cream }}>
      {/* header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
        <button onClick={onClose} className="text-2xl" style={{ color: COLORS.ink }}>←</button>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-widest font-medium" style={{ color: COLORS.muted, letterSpacing: "0.15em" }}>Pin Location</p>
          <p className="font-bold truncate" style={{ color: COLORS.ink, fontFamily: "'DM Sans', sans-serif" }}>{areaName}</p>
        </div>
        <button onClick={useGPS} className="px-3 py-2 rounded-lg text-xs font-bold border" style={{ borderColor: COLORS.border, color: COLORS.muted }}>
          Use GPS
        </button>
      </div>

      {/* map */}
      <div className="flex-1 relative">
        <MapContainer center={position} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <RecenterMap center={position} />
          <Marker position={position} draggable eventHandlers={{ dragend: e => updatePosition(e.target.getLatLng().lat, e.target.getLatLng().lng) }}>
            <Popup>{areaName}</Popup>
          </Marker>
          <MapClickHandler onPick={updatePosition} />
        </MapContainer>
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-medium shadow-lg pointer-events-none" style={{ background: COLORS.surface, color: COLORS.muted, border: `1px solid ${COLORS.border}` }}>
          Tap anywhere on the map to drop a pin
        </div>
      </div>

      {/* confirm */}
      <div className="px-5 py-4 border-t" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
        <button
          onClick={confirm}
          disabled={confirming}
          className="w-full py-4 rounded-xl text-sm font-bold tracking-wide transition-all active:scale-[0.98]"
          style={{ background: COLORS.ink, color: COLORS.surface, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.05em" }}
        >
          {confirming ? "CONFIRMING..." : "CONFIRM LOCATION"}
        </button>
      </div>
    </div>
  )
}

// ─── onboarding ───────────────────────────────────────────────────────────────
function Onboarding({ onDone }) {
  const [step, setStep] = useState(1)
  const [category, setCategory] = useState(null)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState("")
  const [showMapPicker, setShowMapPicker] = useState(false)

  function pickCategory(cat) {
    setCategory(cat)
    setStep(2)
  }

  function getLocation() {
    setLocating(true)
    setError("")
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const area = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
        onDone({ category, lat: pos.coords.latitude, lng: pos.coords.longitude, area })
      },
      () => { setError("Location denied. You can pick manually below."); setLocating(false) }
    )
  }

  if (showMapPicker) {
    return <MapPicker onConfirm={d => onDone({ category, ...d })} onClose={() => setShowMapPicker(false)} />
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: COLORS.cream }}>
      {step === 1 && (
        <div className="flex-1 flex flex-col px-8 pt-20 pb-12">
          <p className="text-xs uppercase tracking-[0.25em] font-bold mb-3" style={{ color: COLORS.terracotta }}>Homie</p>
          <h1 className="leading-[0.95] mb-4" style={{ color: COLORS.ink, fontFamily: "'Instrument Serif', serif", fontSize: "64px", fontWeight: 400 }}>
            Rentals,<br />
            <em style={{ color: COLORS.terracotta }}>reimagined.</em>
          </h1>
          <p className="text-base mb-16 leading-relaxed max-w-xs" style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
            Direct from owners. No brokers. No commission. The first honest rental platform in Lucknow.
          </p>

          <div className="mt-auto">
            <p className="text-xs uppercase tracking-widest font-bold mb-4" style={{ color: COLORS.muted, letterSpacing: "0.15em" }}>What are you looking for?</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => pickCategory("residential")} className="text-left p-5 rounded-xl border transition-all hover:border-current active:scale-[0.98]" style={{ background: COLORS.surface, borderColor: COLORS.border, color: COLORS.ink }}>
                <p className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: COLORS.terracotta }}>01</p>
                <p className="text-xl font-bold" style={{ fontFamily: "'DM Sans', sans-serif" }}>Residential</p>
                <p className="text-sm mt-1" style={{ color: COLORS.muted, fontWeight: 300 }}>Homes, flats, PGs to live in</p>
              </button>
              <button onClick={() => pickCategory("commercial")} className="text-left p-5 rounded-xl border transition-all hover:border-current active:scale-[0.98]" style={{ background: COLORS.surface, borderColor: COLORS.border, color: COLORS.ink }}>
                <p className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: COLORS.terracotta }}>02</p>
                <p className="text-xl font-bold" style={{ fontFamily: "'DM Sans', sans-serif" }}>Commercial</p>
                <p className="text-sm mt-1" style={{ color: COLORS.muted, fontWeight: 300 }}>Offices, shops, warehouses</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex-1 flex flex-col px-8 pt-20 pb-12">
          <p className="text-xs uppercase tracking-[0.25em] font-bold mb-3" style={{ color: COLORS.terracotta }}>Step 2 of 2</p>
          <h1 className="leading-[0.95] mb-4" style={{ color: COLORS.ink, fontFamily: "'Instrument Serif', serif", fontSize: "56px", fontWeight: 400 }}>
            Where are you<br /><em>looking?</em>
          </h1>
          <p className="text-base mb-12 leading-relaxed max-w-xs" style={{ color: COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
            We'll surface {category} properties closest to you first.
          </p>

          {error && <p className="text-sm mb-4" style={{ color: "#B83A26" }}>{error}</p>}

          <div className="mt-auto flex flex-col gap-3">
            <button onClick={getLocation} disabled={locating} className="w-full py-4 rounded-xl text-sm font-bold tracking-wide transition-all active:scale-[0.98]" style={{ background: COLORS.ink, color: COLORS.surface, letterSpacing: "0.05em", fontFamily: "'DM Sans', sans-serif" }}>
              {locating ? "LOCATING..." : "USE MY LOCATION"}
            </button>
            <button onClick={() => setShowMapPicker(true)} className="w-full py-4 rounded-xl text-sm font-bold tracking-wide border transition-all active:scale-[0.98]" style={{ borderColor: COLORS.border, color: COLORS.ink, letterSpacing: "0.05em", fontFamily: "'DM Sans', sans-serif" }}>
              PICK ON MAP MANUALLY
            </button>
            <button onClick={() => setStep(1)} className="text-sm mt-2" style={{ color: COLORS.muted, fontWeight: 300 }}>← Back</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── location picker (Zomato style) ───────────────────────────────────────────
const POPULAR = ["Gomti Nagar", "Hazratganj", "Aliganj", "Indira Nagar", "Mahanagar", "Chinhat", "Vikas Nagar", "Rajajipuram"]

function LocationPicker({ currentArea, onPick, onClose }) {
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [locating, setLocating] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const recent = JSON.parse(localStorage.getItem("homie_recent_areas") || "[]")

  async function searchAreas(q) {
    if (!q || q.length < 3) { setResults([]); return }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ", Lucknow")}&format=json&limit=5`)
      const data = await res.json()
      setResults(data)
    } catch { setResults([]) }
  }

  function pickArea(area, lat, lng) {
    const newRecent = [area, ...recent.filter(r => r !== area)].slice(0, 5)
    localStorage.setItem("homie_recent_areas", JSON.stringify(newRecent))
    onPick({ area, lat, lng })
  }

  function useGPS() {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const area = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
        pickArea(area, pos.coords.latitude, pos.coords.longitude)
      },
      () => setLocating(false)
    )
  }

  if (showMap) {
    return <MapPicker onConfirm={d => pickArea(d.area, d.lat, d.lng)} onClose={() => setShowMap(false)} />
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: COLORS.cream }}>
      <div className="px-5 pt-5 pb-3 border-b flex items-center gap-3" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
        <button onClick={onClose} className="text-2xl" style={{ color: COLORS.ink }}>←</button>
        <input
          autoFocus
          value={search}
          onChange={e => { setSearch(e.target.value); searchAreas(e.target.value) }}
          placeholder="Search area or locality..."
          className="flex-1 border rounded-xl px-4 py-3 text-sm focus:outline-none"
          style={{ borderColor: COLORS.border, background: COLORS.cream, fontFamily: "'DM Sans', sans-serif" }}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <button onClick={useGPS} disabled={locating} className="w-full px-5 py-4 flex items-center gap-4 border-b text-left" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm" style={{ background: COLORS.terracotta, color: COLORS.surface }}>◉</div>
          <div>
            <p className="font-bold text-sm" style={{ color: COLORS.terracotta }}>{locating ? "Detecting..." : "Use Current Location"}</p>
            <p className="text-xs mt-0.5" style={{ color: COLORS.muted, fontWeight: 300 }}>{currentArea || "Allow location access"}</p>
          </div>
        </button>

        <button onClick={() => setShowMap(true)} className="w-full px-5 py-4 flex items-center gap-4 border-b text-left" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm border" style={{ borderColor: COLORS.border, color: COLORS.ink }}>◇</div>
          <div>
            <p className="font-bold text-sm" style={{ color: COLORS.ink }}>Pick on map manually</p>
            <p className="text-xs mt-0.5" style={{ color: COLORS.muted, fontWeight: 300 }}>Drop a pin anywhere</p>
          </div>
        </button>

        {search.length >= 3 && results.length > 0 && (
          <div>
            <p className="px-5 pt-5 pb-2 text-xs uppercase tracking-widest font-bold" style={{ color: COLORS.muted, letterSpacing: "0.15em" }}>Search Results</p>
            {results.map((r, i) => (
              <button key={i} onClick={() => pickArea(r.display_name.split(",")[0], parseFloat(r.lat), parseFloat(r.lon))} className="w-full px-5 py-3 border-b text-left" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
                <p className="text-sm font-bold" style={{ color: COLORS.ink }}>{r.display_name.split(",")[0]}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: COLORS.muted, fontWeight: 300 }}>{r.display_name}</p>
              </button>
            ))}
          </div>
        )}

        {recent.length > 0 && search.length === 0 && (
          <div>
            <p className="px-5 pt-5 pb-2 text-xs uppercase tracking-widest font-bold" style={{ color: COLORS.muted, letterSpacing: "0.15em" }}>Recent</p>
            {recent.map((r, i) => (
              <button key={i} onClick={() => pickArea(r, null, null)} className="w-full px-5 py-3 border-b text-left" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
                <p className="text-sm font-bold" style={{ color: COLORS.ink }}>{r}</p>
              </button>
            ))}
          </div>
        )}

        {search.length === 0 && (
          <div>
            <p className="px-5 pt-5 pb-2 text-xs uppercase tracking-widest font-bold" style={{ color: COLORS.muted, letterSpacing: "0.15em" }}>Popular Areas</p>
            <div className="px-5 pb-5 flex flex-wrap gap-2">
              {POPULAR.map(p => (
                <button key={p} onClick={() => pickArea(p, null, null)} className="px-4 py-2 rounded-lg text-xs font-bold border" style={{ borderColor: COLORS.border, color: COLORS.ink, background: COLORS.surface }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── listing detail ───────────────────────────────────────────────────────────
function ListingDetail({ listing, onClose, onSave, isSaved }) {
  const [tab, setTab] = useState("details")
  const [nearby, setNearby] = useState({ hospital: [], cafe: [], gym: [] })
  const [loadingNearby, setLoadingNearby] = useState(false)
  const photos = getPhotos(listing)

  useEffect(() => {
    if (tab === "neighborhood" && listing.latitude && listing.longitude && listing.category !== "commercial") {
      setLoadingNearby(true)
      Promise.all([
        fetchNearby(listing.latitude, listing.longitude, "hospital"),
        fetchNearby(listing.latitude, listing.longitude, "cafe"),
        fetchNearby(listing.latitude, listing.longitude, "gym"),
      ]).then(([hospital, cafe, gym]) => { setNearby({ hospital, cafe, gym }); setLoadingNearby(false) })
    }
  }, [tab])

  const tabs = listing.category === "commercial"
    ? ["details", "amenities", "map"]
    : ["details", "amenities", "neighborhood", "map"]

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: COLORS.cream }}>
      <button onClick={onClose} className="absolute top-4 left-4 z-30 w-10 h-10 rounded-full flex items-center justify-center text-xl backdrop-blur-md" style={{ background: "rgba(255,255,255,0.9)", color: COLORS.ink }}>←</button>
      <button onClick={() => onSave(listing)} className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full flex items-center justify-center text-base backdrop-blur-md" style={{ background: isSaved ? COLORS.terracotta : "rgba(255,255,255,0.9)", color: isSaved ? COLORS.surface : COLORS.ink }}>
        {isSaved ? "♥" : "♡"}
      </button>

      <div className="flex-1 overflow-y-auto">
        {/* photos full bleed */}
        {photos.length > 0 ? (
          <div className="flex flex-col" style={{ background: COLORS.ink }}>
            {photos.map((url, i) => (
              <img key={i} src={url} alt={listing.title} className="w-full h-auto" style={{ maxHeight: "75vh", objectFit: "contain" }} />
            ))}
          </div>
        ) : (
          <div className="w-full h-80 flex items-center justify-center text-6xl" style={{ background: COLORS.cream, color: COLORS.muted }}>—</div>
        )}

        {/* hero info */}
        <div className="px-6 pt-8 pb-6" style={{ background: COLORS.surface }}>
          <p className="text-xs uppercase tracking-widest font-bold mb-2" style={{ color: COLORS.terracotta, letterSpacing: "0.15em" }}>
            {listing.category === "commercial" ? "Commercial" : "Residential"} · {timeAgo(listing.created_at)}
          </p>
          <h1 className="leading-tight mb-3" style={{ color: COLORS.ink, fontFamily: "'Instrument Serif', serif", fontSize: "36px", fontWeight: 400 }}>
            {listing.title}
          </h1>
          <p className="text-sm mb-5" style={{ color: COLORS.muted, fontWeight: 300 }}>
            {listing.location}{listing.distance && ` · ${listing.distance} km away`}
          </p>

          <div className="flex items-baseline gap-2 pt-5 border-t" style={{ borderColor: COLORS.border }}>
            <p className="font-bold" style={{ color: COLORS.ink, fontSize: "36px", fontFamily: "'DM Sans', sans-serif" }}>
              ₹{Number(listing.price).toLocaleString()}
            </p>
            <p className="text-sm" style={{ color: COLORS.muted, fontWeight: 300 }}>per month</p>
          </div>
        </div>

        {/* tabs */}
        <div className="flex border-b sticky top-0 z-10" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} className="flex-1 py-4 text-xs uppercase tracking-widest font-bold border-b-2 transition-all" style={{
              borderColor: tab === t ? COLORS.terracotta : "transparent",
              color: tab === t ? COLORS.terracotta : COLORS.muted,
              letterSpacing: "0.15em",
              fontFamily: "'DM Sans', sans-serif"
            }}>
              {t}
            </button>
          ))}
        </div>

        <div className="px-6 py-6" style={{ background: COLORS.surface }}>
          {tab === "details" && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-3">
                {listing.beds && <div className="text-center p-4 rounded-xl border" style={{ borderColor: COLORS.border }}><p className="text-xs uppercase tracking-widest" style={{ color: COLORS.muted, letterSpacing: "0.15em" }}>Beds</p><p className="font-bold mt-1" style={{ color: COLORS.ink, fontSize: "20px" }}>{listing.beds}</p></div>}
                {listing.baths && <div className="text-center p-4 rounded-xl border" style={{ borderColor: COLORS.border }}><p className="text-xs uppercase tracking-widest" style={{ color: COLORS.muted, letterSpacing: "0.15em" }}>Baths</p><p className="font-bold mt-1" style={{ color: COLORS.ink, fontSize: "20px" }}>{listing.baths}</p></div>}
                {listing.sqft && <div className="text-center p-4 rounded-xl border" style={{ borderColor: COLORS.border }}><p className="text-xs uppercase tracking-widest" style={{ color: COLORS.muted, letterSpacing: "0.15em" }}>Sqft</p><p className="font-bold mt-1" style={{ color: COLORS.ink, fontSize: "20px" }}>{listing.sqft}</p></div>}
              </div>
              {listing.furnished && (
                <div className="flex items-center justify-between py-4 border-t" style={{ borderColor: COLORS.border }}>
                  <p className="text-xs uppercase tracking-widest" style={{ color: COLORS.muted, letterSpacing: "0.15em" }}>Furnishing</p>
                  <p className="font-bold" style={{ color: COLORS.ink }}>{listing.furnished}</p>
                </div>
              )}
              <div className="flex items-center gap-4 pt-4 border-t" style={{ borderColor: COLORS.border }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold" style={{ background: COLORS.cream, color: COLORS.terracotta, fontFamily: "'Instrument Serif', serif", fontSize: "20px" }}>
                  {listing.owner_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: COLORS.ink }}>{listing.owner_name}</p>
                  <p className="text-xs" style={{ color: COLORS.muted, fontWeight: 300 }}>Direct owner · No broker</p>
                </div>
              </div>
            </div>
          )}

          {tab === "amenities" && (
            <div>
              {listing.amenities && listing.amenities.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {listing.amenities.map(a => (
                    <div key={a} className="px-4 py-3 rounded-xl border text-sm font-medium" style={{ borderColor: COLORS.border, color: COLORS.ink }}>
                      {a}
                    </div>
                  ))}
                </div>
              ) : <p className="text-center py-12 text-sm" style={{ color: COLORS.muted }}>No amenities listed</p>}
            </div>
          )}

          {tab === "neighborhood" && (
            <div>
              {!listing.latitude ? (
                <p className="text-center py-12 text-sm" style={{ color: COLORS.muted }}>Owner hasn't pinned this property</p>
              ) : loadingNearby ? (
                <p className="text-center py-12 text-sm animate-pulse" style={{ color: COLORS.muted }}>Finding what's nearby...</p>
              ) : (
                <div className="flex flex-col gap-7">
                  {[
                    { key: "hospital", label: "Healthcare" },
                    { key: "cafe", label: "Food & Cafes" },
                    { key: "gym", label: "Fitness" },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <p className="text-xs uppercase tracking-widest font-bold mb-3" style={{ color: COLORS.terracotta, letterSpacing: "0.15em" }}>{label}</p>
                      {nearby[key].length === 0 ? (
                        <p className="text-sm" style={{ color: COLORS.muted }}>None found nearby</p>
                      ) : (
                        <div className="flex flex-col">
                          {nearby[key].slice(0, 4).map((place, i) => (
                            <div key={i} className="flex items-center justify-between py-3 border-b" style={{ borderColor: COLORS.border }}>
                              <p className="text-sm font-medium" style={{ color: COLORS.ink }}>{place.tags?.name || "Unnamed"}</p>
                              {place.lat && <p className="text-xs" style={{ color: COLORS.muted }}>{getDistanceKm(listing.latitude, listing.longitude, place.lat, place.lon).toFixed(1)} km</p>}
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

          {tab === "map" && (
            <div className="rounded-xl overflow-hidden h-72 border" style={{ borderColor: COLORS.border }}>
              {listing.latitude && listing.longitude ? (
                <MapContainer center={[listing.latitude, listing.longitude]} zoom={15} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[listing.latitude, listing.longitude]}><Popup>{listing.title}</Popup></Marker>
                  <Circle center={[listing.latitude, listing.longitude]} radius={200} pathOptions={{ color: COLORS.terracotta, fillColor: COLORS.terracotta, fillOpacity: 0.1 }} />
                </MapContainer>
              ) : <p className="text-center pt-24 text-sm" style={{ color: COLORS.muted }}>No exact location shared</p>}
            </div>
          )}
        </div>
        <div className="h-24" />
      </div>

      {/* sticky CTA */}
      <div className="px-5 py-4 border-t" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
        <button
          onClick={() => window.open("https://wa.me/91" + listing.phone + "?text=Hi " + listing.owner_name + ", I saw your listing on Homie — " + listing.title + " in " + listing.location + ". Is it still available?")}
          className="w-full py-4 rounded-xl text-sm font-bold tracking-wide transition-all active:scale-[0.98]"
          style={{ background: COLORS.ink, color: COLORS.surface, letterSpacing: "0.05em", fontFamily: "'DM Sans', sans-serif" }}
        >
          MESSAGE {listing.owner_name?.toUpperCase()}
        </button>
      </div>
    </div>
  )
}

// ─── swipe stack ──────────────────────────────────────────────────────────────
function SwipeStack({ listings, onSwipe, onOpen }) {
  const [cards, setCards] = useState(listings)
  const [current, setCurrent] = useState(0)
  useEffect(() => { setCards(listings); setCurrent(0) }, [listings])

  const startX = useRef(0)
  const offsetX = useRef(0)
  const isDragging = useRef(false)
  const didDrag = useRef(false)
  const [dragState, setDragState] = useState({ x: 0, dir: null, animating: false })

  const listing = cards[current]

  function handleStart(clientX) {
    if (dragState.animating) return
    startX.current = clientX
    offsetX.current = 0
    isDragging.current = true
    didDrag.current = false
  }
  function handleMove(clientX) {
    if (!isDragging.current || dragState.animating) return
    const diff = clientX - startX.current
    if (Math.abs(diff) > 8) didDrag.current = true
    offsetX.current = diff
    setDragState({ x: diff, dir: diff > 0 ? "right" : "left", animating: false })
  }
  function handleEnd() {
    if (!isDragging.current || dragState.animating) return
    isDragging.current = false
    const threshold = 90
    if (Math.abs(offsetX.current) > threshold) {
      const dir = offsetX.current > 0 ? "right" : "left"
      setDragState({ x: dir === "right" ? 700 : -700, dir, animating: true })
      setTimeout(() => {
        onSwipe(dir, listing)
        setCurrent(c => c + 1)
        setDragState({ x: 0, dir: null, animating: false })
      }, 280)
    } else {
      setDragState({ x: 0, dir: null, animating: false })
      offsetX.current = 0
    }
  }
  function buttonSwipe(dir) {
    if (dragState.animating) return
    setDragState({ x: dir === "right" ? 700 : -700, dir, animating: true })
    setTimeout(() => {
      onSwipe(dir, listing)
      setCurrent(c => c + 1)
      setDragState({ x: 0, dir: null, animating: false })
    }, 280)
  }

  if (!listing || current >= cards.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <p className="text-xs uppercase tracking-widest font-bold mb-4" style={{ color: COLORS.terracotta, letterSpacing: "0.15em" }}>All done</p>
        <h2 className="mb-3" style={{ color: COLORS.ink, fontFamily: "'Instrument Serif', serif", fontSize: "40px", fontWeight: 400 }}>You've seen<br /><em>everything.</em></h2>
        <p className="text-sm mb-8" style={{ color: COLORS.muted, fontWeight: 300 }}>Check back soon — new listings drop daily.</p>
        <button onClick={() => setCurrent(0)} className="px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest" style={{ background: COLORS.ink, color: COLORS.surface, letterSpacing: "0.15em" }}>Start Over</button>
      </div>
    )
  }

  const photos = getPhotos(listing)
  const rotate = dragState.x / 22
  const opacity = Math.min(Math.abs(dragState.x) / 90, 1)
  const isNew = (new Date() - new Date(listing.created_at)) < 86400000
  const nextCard = cards[current + 1]

  return (
    <div className="flex-1 flex flex-col items-center justify-start px-4 pt-4 pb-3 overflow-hidden">
      <div className="relative w-full max-w-sm flex-1" style={{ maxHeight: "580px" }}>
        {nextCard && (
          <div className="absolute inset-x-4 top-3 bottom-0 rounded-2xl border z-0" style={{ background: COLORS.surface, borderColor: COLORS.border, transform: "scale(0.95)" }} />
        )}

        <div
          onTouchStart={e => handleStart(e.touches[0].clientX)}
          onTouchMove={e => handleMove(e.touches[0].clientX)}
          onTouchEnd={handleEnd}
          onMouseDown={e => handleStart(e.clientX)}
          onMouseMove={e => { if (isDragging.current) handleMove(e.clientX) }}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          style={{
            transform: `translateX(${dragState.x}px) rotate(${rotate}deg)`,
            transition: isDragging.current ? "none" : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
            zIndex: 10,
            background: COLORS.surface,
            borderColor: COLORS.border,
          }}
          className="absolute inset-0 rounded-2xl overflow-hidden border select-none cursor-grab active:cursor-grabbing"
        >
          {dragState.dir === "right" && (
            <div style={{ opacity, borderColor: COLORS.terracotta, color: COLORS.terracotta, background: "rgba(255,255,255,0.95)" }} className="absolute top-8 left-5 z-20 border-2 font-bold text-sm px-4 py-2 rounded-lg -rotate-12 uppercase tracking-widest">Save</div>
          )}
          {dragState.dir === "left" && (
            <div style={{ opacity, borderColor: COLORS.muted, color: COLORS.muted, background: "rgba(255,255,255,0.95)" }} className="absolute top-8 right-5 z-20 border-2 font-bold text-sm px-4 py-2 rounded-lg rotate-12 uppercase tracking-widest">Skip</div>
          )}

          <div className="relative h-80" style={{ background: COLORS.cream }}>
            {photos.length > 0 ? (
              <img src={photos[0]} alt="" className="w-full h-full object-cover pointer-events-none" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl" style={{ color: COLORS.muted }}>—</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            {isNew && (
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest" style={{ background: COLORS.terracotta, color: COLORS.surface, letterSpacing: "0.15em" }}>New</div>
            )}
            <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full backdrop-blur-md" style={{ background: "rgba(255,255,255,0.95)" }}>
              <span className="font-bold text-sm" style={{ color: COLORS.ink }}>₹{Number(listing.price).toLocaleString()}</span>
              <span className="text-xs ml-1" style={{ color: COLORS.muted }}>/mo</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h2 className="text-2xl leading-tight" style={{ color: COLORS.surface, fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>{listing.title}</h2>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.85)", fontWeight: 300 }}>{listing.location}{listing.distance ? ` · ${listing.distance} km away` : ""}</p>
            </div>
          </div>

          <div className="p-5">
            <div className="flex gap-2 flex-wrap mb-4">
              {listing.beds && <span className="px-3 py-1 rounded-full text-xs font-medium border" style={{ borderColor: COLORS.border, color: COLORS.muted }}>{listing.beds} Beds</span>}
              {listing.baths && <span className="px-3 py-1 rounded-full text-xs font-medium border" style={{ borderColor: COLORS.border, color: COLORS.muted }}>{listing.baths} Baths</span>}
              {listing.sqft && <span className="px-3 py-1 rounded-full text-xs font-medium border" style={{ borderColor: COLORS.border, color: COLORS.muted }}>{listing.sqft} sqft</span>}
              {listing.furnished && <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: COLORS.cream, color: COLORS.terracotta }}>{listing.furnished}</span>}
            </div>

            <div className="flex items-center justify-between mb-4 pt-3 border-t" style={{ borderColor: COLORS.border }}>
              <p className="text-xs" style={{ color: COLORS.muted, fontWeight: 300 }}>{listing.owner_name} · {timeAgo(listing.created_at)}</p>
              <button onClick={() => !didDrag.current && onOpen(listing)} onMouseDown={e => e.stopPropagation()} className="text-xs uppercase tracking-widest font-bold" style={{ color: COLORS.terracotta, letterSpacing: "0.15em" }}>
                Details →
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => buttonSwipe("left")} onMouseDown={e => e.stopPropagation()} className="flex-1 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all active:scale-95" style={{ borderColor: COLORS.border, color: COLORS.muted, letterSpacing: "0.15em" }}>
                Skip
              </button>
              <button onClick={() => window.open("https://wa.me/91" + listing.phone)} onMouseDown={e => e.stopPropagation()} className="flex-1 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95" style={{ background: COLORS.ink, color: COLORS.surface, letterSpacing: "0.15em" }}>
                Message
              </button>
              <button onClick={() => buttonSwipe("right")} onMouseDown={e => e.stopPropagation()} className="flex-1 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95" style={{ background: COLORS.terracotta, color: COLORS.surface, letterSpacing: "0.15em" }}>
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs mt-3" style={{ color: COLORS.muted, fontWeight: 300 }}>{cards.length - current} properties remaining</p>
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
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {userLoc && (
          <>
            <Circle center={[userLoc.lat, userLoc.lng]} radius={400} pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.08, weight: 1 }} />
            <Marker position={[userLoc.lat, userLoc.lng]}><Popup>You are here</Popup></Marker>
          </>
        )}
        {pinned.map(l => (
          <Marker key={l.id} position={[l.latitude, l.longitude]}>
            <Popup>
              <div className="min-w-[160px]">
                {getPhotos(l)[0] && <img src={getPhotos(l)[0]} alt="" className="w-full h-20 object-cover rounded-lg mb-2" />}
                <p className="font-bold text-sm">{l.title}</p>
                <p className="text-xs" style={{ color: COLORS.terracotta }}>₹{Number(l.price).toLocaleString()}/mo</p>
                <p className="text-xs text-gray-400 mb-2">{l.location}</p>
                <button onClick={() => onOpen(l)} className="w-full text-xs font-bold py-2 rounded-lg" style={{ background: COLORS.ink, color: COLORS.surface }}>View Details</button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="absolute top-4 left-4 right-4 px-4 py-3 rounded-xl shadow-lg z-10 flex items-center justify-between pointer-events-none" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)" }}>
        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: COLORS.ink, letterSpacing: "0.15em" }}>Map View</p>
        <p className="text-xs" style={{ color: COLORS.muted }}>{pinned.length} pinned · {listings.length} total</p>
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
      if (!error) { const { data } = supabase.storage.from("photos").getPublicUrl(filename); urls.push(data.publicUrl) }
    }
    const newPhotos = [...photos, ...urls]; setPhotos(newPhotos); onPhotosChange(newPhotos); setUploading(false)
  }
  function removePhoto(idx) { const n = photos.filter((_, i) => i !== idx); setPhotos(n); onPhotosChange(n) }
  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        {photos.map((url, idx) => (
          <div key={idx} className="relative w-20 h-20">
            <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
            <button onClick={() => removePhoto(idx)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center" style={{ background: COLORS.ink, color: COLORS.surface }}>✕</button>
          </div>
        ))}
        {photos.length < 5 && (
          <label className="w-20 h-20 border rounded-lg flex flex-col items-center justify-center cursor-pointer" style={{ borderColor: COLORS.border, background: COLORS.cream, borderStyle: "dashed" }}>
            <span className="text-lg" style={{ color: COLORS.muted }}>{uploading ? "..." : "+"}</span>
            <span className="text-xs mt-0.5" style={{ color: COLORS.muted }}>{uploading ? "" : "Add"}</span>
            <input type="file" accept="image/*" multiple onChange={uploadPhoto} className="hidden" />
          </label>
        )}
      </div>
      <p className="text-xs mt-2" style={{ color: COLORS.muted, fontWeight: 300 }}>{photos.length}/5 photos</p>
    </div>
  )
}

// ─── upload form ──────────────────────────────────────────────────────────────
function UploadForm({ onClose, onSuccess, defaultCategory }) {
  const [form, setForm] = useState({ title: "", price: "", location: "", furnished: "Unfurnished", beds: "", baths: "", sqft: "", phone: "", owner_name: "", image_url: "", images: [], type: "rent", category: defaultCategory, latitude: null, longitude: null, amenities: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [locating, setLocating] = useState(false)
  const [locationSet, setLocationSet] = useState(false)
  const [showMapPicker, setShowMapPicker] = useState(false)

  function handle(e) { setForm({ ...form, [e.target.name]: e.target.value }) }
  function toggleAmenity(a) { setForm(f => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a] })) }
  function handlePhotos(urls) { setForm(f => ({ ...f, images: urls, image_url: urls[0] || "" })) }
  function getLocation() {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })); setLocationSet(true); setLocating(false) },
      () => { setError("Location denied. Try picking on map manually."); setLocating(false) }
    )
  }
  function handleMapPick(d) {
    setForm(f => ({ ...f, latitude: d.lat, longitude: d.lng, location: f.location || d.area }))
    setLocationSet(true)
    setShowMapPicker(false)
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

  if (showMapPicker) return <MapPicker initialLat={form.latitude} initialLng={form.longitude} onConfirm={handleMapPick} onClose={() => setShowMapPicker(false)} />

  const input = "w-full border rounded-xl px-4 py-3.5 text-sm focus:outline-none"
  const inputStyle = { borderColor: COLORS.border, background: COLORS.cream, color: COLORS.ink, fontFamily: "'DM Sans', sans-serif" }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto" style={{ background: COLORS.surface }}>
        <div className="sticky top-0 px-6 pt-6 pb-4 border-b flex justify-between items-start" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
          <div>
            <p className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: COLORS.terracotta, letterSpacing: "0.15em" }}>List Property</p>
            <h2 className="text-2xl" style={{ color: COLORS.ink, fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>Free. <em>Forever.</em></h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: COLORS.cream, color: COLORS.ink }}>✕</button>
        </div>
        <div className="px-6 pb-8 pt-5 flex flex-col gap-5">
          {error && <div className="text-sm px-4 py-3 rounded-lg" style={{ background: "#FBE9E5", color: "#A04A2E" }}>{error}</div>}

          <div className="flex gap-2">
            <button type="button" onClick={() => setForm({ ...form, category: "residential" })} className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all" style={{ borderColor: form.category === "residential" ? COLORS.terracotta : COLORS.border, color: form.category === "residential" ? COLORS.terracotta : COLORS.muted, background: form.category === "residential" ? COLORS.cream : COLORS.surface, letterSpacing: "0.15em" }}>Residential</button>
            <button type="button" onClick={() => setForm({ ...form, category: "commercial" })} className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all" style={{ borderColor: form.category === "commercial" ? COLORS.terracotta : COLORS.border, color: form.category === "commercial" ? COLORS.terracotta : COLORS.muted, background: form.category === "commercial" ? COLORS.cream : COLORS.surface, letterSpacing: "0.15em" }}>Commercial</button>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest font-bold mb-3" style={{ color: COLORS.muted, letterSpacing: "0.15em" }}>Photos · Up to 5</p>
            <PhotoUploader onPhotosChange={handlePhotos} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input name="owner_name" placeholder="Your name *" value={form.owner_name} onChange={handle} className={input} style={inputStyle} />
            <input name="phone" placeholder="WhatsApp number *" value={form.phone} onChange={handle} className={input} style={inputStyle} />
          </div>
          <input name="title" placeholder="Property title *" value={form.title} onChange={handle} className={input} style={inputStyle} />
          <input name="location" placeholder="Area / Locality *" value={form.location} onChange={handle} className={input} style={inputStyle} />
          <div className="grid grid-cols-2 gap-3">
            <input name="price" placeholder="Monthly rent ₹ *" type="number" value={form.price} onChange={handle} className={input} style={inputStyle} />
            <select name="furnished" value={form.furnished} onChange={handle} className={input} style={inputStyle}>
              <option value="Furnished">Furnished</option>
              <option value="Semi Furnished">Semi Furnished</option>
              <option value="Unfurnished">Unfurnished</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input name="beds" placeholder="Beds" type="number" value={form.beds} onChange={handle} className={input} style={inputStyle} />
            <input name="baths" placeholder="Baths" type="number" value={form.baths} onChange={handle} className={input} style={inputStyle} />
            <input name="sqft" placeholder="Sqft" type="number" value={form.sqft} onChange={handle} className={input} style={inputStyle} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest font-bold mb-3" style={{ color: COLORS.muted, letterSpacing: "0.15em" }}>Amenities</p>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map(a => (
                <button key={a} type="button" onClick={() => toggleAmenity(a)} className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all" style={{
                  borderColor: form.amenities.includes(a) ? COLORS.terracotta : COLORS.border,
                  background: form.amenities.includes(a) ? COLORS.terracotta : COLORS.surface,
                  color: form.amenities.includes(a) ? COLORS.surface : COLORS.muted,
                }}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest font-bold mb-3" style={{ color: COLORS.muted, letterSpacing: "0.15em" }}>Pin Location</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={getLocation} disabled={locating} className="py-3 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all" style={{ borderColor: locationSet ? COLORS.terracotta : COLORS.border, color: locationSet ? COLORS.terracotta : COLORS.muted, letterSpacing: "0.15em" }}>
                {locating ? "..." : locationSet ? "✓ Pinned" : "Use GPS"}
              </button>
              <button type="button" onClick={() => setShowMapPicker(true)} className="py-3 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all" style={{ borderColor: COLORS.border, color: COLORS.muted, letterSpacing: "0.15em" }}>
                Pick on Map
              </button>
            </div>
          </div>

          <button onClick={submit} disabled={loading} className="w-full py-4 rounded-xl text-sm font-bold uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-40" style={{ background: COLORS.ink, color: COLORS.surface, letterSpacing: "0.15em" }}>
            {loading ? "Publishing..." : "Publish Listing"}
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
  const [category, setCategory] = useState("residential")
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [listings, setListings] = useState([])
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem("homie_saved") || "[]"))
  const [activeTab, setActiveTab] = useState("residential")
  const [viewMode, setViewMode] = useState("swipe")
  const [showForm, setShowForm] = useState(false)
  const [openListing, setOpenListing] = useState(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("homie_setup") || "null")
    if (stored) {
      setUserLoc({ lat: stored.lat, lng: stored.lng })
      setArea(stored.area || "")
      setCategory(stored.category || "residential")
      setActiveTab(stored.category || "residential")
      setShowOnboarding(false)
      fetchListings({ lat: stored.lat, lng: stored.lng })
    }
  }, [])

  async function fetchListings(loc) {
    const { data } = await supabase.from("listings").select("*").eq("type", "rent").order("created_at", { ascending: false })
    const result = (data || []).map(l => ({
      ...l,
      distance: loc && l.latitude && l.longitude ? getDistanceKm(loc.lat, loc.lng, l.latitude, l.longitude).toFixed(1) : null
    })).sort((a, b) => {
      if (a.distance && b.distance) return a.distance - b.distance
      if (a.distance) return -1
      if (b.distance) return 1
      return 0
    })
    setListings(result)
  }

  function handleOnboardingDone(d) {
    localStorage.setItem("homie_setup", JSON.stringify(d))
    setUserLoc({ lat: d.lat, lng: d.lng })
    setArea(d.area); setCategory(d.category); setActiveTab(d.category); setShowOnboarding(false)
    fetchListings({ lat: d.lat, lng: d.lng })
  }

  function handleLocationChange(d) {
    const newSetup = { ...JSON.parse(localStorage.getItem("homie_setup") || "{}"), area: d.area, lat: d.lat, lng: d.lng }
    localStorage.setItem("homie_setup", JSON.stringify(newSetup))
    setArea(d.area)
    if (d.lat && d.lng) { setUserLoc({ lat: d.lat, lng: d.lng }); fetchListings({ lat: d.lat, lng: d.lng }) }
    setShowLocationPicker(false)
  }

  function handleSwipe(dir, listing) {
    if (dir === "right") {
      const newSaved = [...saved.filter(s => s.id !== listing.id), listing]
      setSaved(newSaved); localStorage.setItem("homie_saved", JSON.stringify(newSaved))
    }
  }
  function toggleSave(listing) {
    const isSaved = saved.some(s => s.id === listing.id)
    const newSaved = isSaved ? saved.filter(s => s.id !== listing.id) : [...saved, listing]
    setSaved(newSaved); localStorage.setItem("homie_saved", JSON.stringify(newSaved))
  }

  const filtered = listings.filter(l => (l.category || "residential") === activeTab)

  if (showOnboarding) return <Onboarding onDone={handleOnboardingDone} />

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: COLORS.cream, fontFamily: "'DM Sans', sans-serif" }}>
      {showForm && <UploadForm onClose={() => setShowForm(false)} onSuccess={() => fetchListings(userLoc)} defaultCategory={activeTab} />}
      {openListing && <ListingDetail listing={openListing} onClose={() => setOpenListing(null)} onSave={toggleSave} isSaved={saved.some(s => s.id === openListing.id)} />}
      {showLocationPicker && <LocationPicker currentArea={area} onPick={handleLocationChange} onClose={() => setShowLocationPicker(false)} />}

      {/* top bar */}
      <div className="px-5 py-4 border-b flex items-center gap-3 flex-shrink-0" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
        <button onClick={() => setShowLocationPicker(true)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs" style={{ background: COLORS.cream, color: COLORS.terracotta }}>◉</div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest font-medium" style={{ color: COLORS.muted, letterSpacing: "0.15em" }}>Showing rentals near</p>
            <p className="font-bold text-sm truncate" style={{ color: COLORS.ink }}>{area || "Set location"} <span style={{ color: COLORS.muted }}>▾</span></p>
          </div>
        </button>
        <div className="flex rounded-lg p-0.5 flex-shrink-0 border" style={{ background: COLORS.cream, borderColor: COLORS.border }}>
          <button onClick={() => setViewMode("swipe")} className="px-3 py-2 rounded-md text-xs font-bold uppercase tracking-widest" style={{
            background: viewMode === "swipe" ? COLORS.surface : "transparent",
            color: viewMode === "swipe" ? COLORS.ink : COLORS.muted,
            letterSpacing: "0.1em",
          }}>Swipe</button>
          <button onClick={() => setViewMode("map")} className="px-3 py-2 rounded-md text-xs font-bold uppercase tracking-widest" style={{
            background: viewMode === "map" ? COLORS.surface : "transparent",
            color: viewMode === "map" ? COLORS.ink : COLORS.muted,
            letterSpacing: "0.1em",
          }}>Map</button>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex-shrink-0" style={{ background: COLORS.ink, color: COLORS.surface, letterSpacing: "0.1em" }}>+ List</button>
      </div>

      {/* content */}
      {activeTab === "saved" ? (
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-8 pb-4">
            <p className="text-xs uppercase tracking-widest font-bold mb-2" style={{ color: COLORS.terracotta, letterSpacing: "0.15em" }}>Your collection</p>
            <h2 style={{ color: COLORS.ink, fontFamily: "'Instrument Serif', serif", fontSize: "36px", fontWeight: 400 }}>Saved <em>properties</em></h2>
          </div>
          {saved.length === 0 ? (
            <div className="text-center py-24 px-8">
              <p className="text-sm mb-2" style={{ color: COLORS.muted, fontWeight: 300 }}>Nothing saved yet.</p>
              <p className="text-xs" style={{ color: COLORS.muted, fontWeight: 300 }}>Swipe right or tap ♡ on listings you like.</p>
            </div>
          ) : (
            <div className="px-5 pb-6 flex flex-col gap-3">
              {saved.map(l => {
                const photos = getPhotos(l)
                return (
                  <button key={l.id} onClick={() => setOpenListing(l)} className="rounded-xl overflow-hidden border flex text-left w-full transition-all active:scale-[0.99]" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
                    <div className="w-28 h-28 flex-shrink-0" style={{ background: COLORS.cream }}>
                      {photos[0] ? <img src={photos[0]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl" style={{ color: COLORS.muted }}>—</div>}
                    </div>
                    <div className="flex-1 p-4 min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: COLORS.ink }}>{l.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: COLORS.muted, fontWeight: 300 }}>{l.location}</p>
                      <p className="font-bold mt-2" style={{ color: COLORS.ink, fontSize: "18px" }}>₹{Number(l.price).toLocaleString()}<span className="text-xs ml-1" style={{ color: COLORS.muted, fontWeight: 300 }}>/mo</span></p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : viewMode === "map" ? (
        <MapView listings={filtered} userLoc={userLoc} onOpen={setOpenListing} />
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <p className="text-xs uppercase tracking-widest font-bold mb-3" style={{ color: COLORS.terracotta, letterSpacing: "0.15em" }}>Quiet here</p>
          <h2 style={{ color: COLORS.ink, fontFamily: "'Instrument Serif', serif", fontSize: "40px", fontWeight: 400 }}>No {activeTab}<br /><em>listings yet.</em></h2>
          <p className="text-sm mb-8 mt-3" style={{ color: COLORS.muted, fontWeight: 300 }}>Be the first to list a {activeTab} property here.</p>
          <button onClick={() => setShowForm(true)} className="px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest" style={{ background: COLORS.ink, color: COLORS.surface, letterSpacing: "0.15em" }}>List Property</button>
        </div>
      ) : (
        <SwipeStack listings={filtered} onSwipe={handleSwipe} onOpen={setOpenListing} />
      )}

      {/* bottom tabs */}
      <div className="border-t flex-shrink-0" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
        <div className="flex justify-around items-center py-3 max-w-md mx-auto">
          {[
            { id: "residential", label: "Residential" },
            { id: "commercial", label: "Commercial" },
            { id: "saved", label: saved.length > 0 ? `Saved ${saved.length}` : "Saved" },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id !== "saved") setViewMode("swipe") }} className="flex flex-col items-center gap-1 px-6 py-1 transition-all">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: activeTab === tab.id ? COLORS.ink : COLORS.muted, letterSpacing: "0.15em", fontWeight: activeTab === tab.id ? 700 : 400 }}>{tab.label}</span>
              <div className="w-6 h-0.5 rounded-full" style={{ background: activeTab === tab.id ? COLORS.terracotta : "transparent" }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}