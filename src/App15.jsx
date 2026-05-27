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

const C = {
  bg: "#1C1C1E", surface: "#2C2C2E", surfaceLift: "#3A3A3C",
  border: "#38383A", borderSubtle: "#2C2C2E",
  text: "#FFFFFF", textMuted: "#8E8E93", textSubtle: "#636366",
  accent: "#FF6F4D", accentDark: "#E0593A",
}
const FONT = "'Geist', -apple-system, BlinkMacSystemFont, sans-serif"

// custom map markers
const userIcon = new L.DivIcon({
  className: "homie-user-marker",
  html: `<div style="width:20px;height:20px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
})
const listingIcon = new L.DivIcon({
  className: "homie-listing-marker",
  html: `<div style="width:24px;height:24px;background:#FF3B30;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [24, 24], iconAnchor: [12, 24],
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
    return data.address?.suburb || data.address?.neighbourhood || data.address?.city_district || data.address?.city || "Selected Location"
  } catch { return "Selected Location" }
}
async function fetchNearby(lat, lng, type) {
  const queries = {
    hospital: `[out:json];node["amenity"~"hospital|clinic|pharmacy"](around:1500,${lat},${lng});out 5;`,
    cafe: `[out:json];node["amenity"~"cafe|restaurant|food_court"](around:1000,${lat},${lng});out 5;`,
    gym: `[out:json];(node["leisure"~"fitness_centre|sports_centre"](around:2000,${lat},${lng});node["amenity"="gym"](around:2000,${lat},${lng}););out 5;`,
    education: `[out:json];node["amenity"~"school|college|university|kindergarten"](around:2000,${lat},${lng});out 5;`,
  }
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: queries[type] })
    const data = await res.json()
    return data.elements || []
  } catch { return [] }
}

async function calculateWalkScore(lat, lng) {
  const categories = [
    { key: "grocery", label: "Grocery & supermarkets", filter: 'shop~"supermarket|convenience|grocery"', weight: 3.0 },
    { key: "pharmacy", label: "Pharmacies", filter: 'amenity=pharmacy', weight: 2.5 },
    { key: "transit", label: "Metro & bus stops", filter: 'public_transport~"station|stop_position|platform"', weight: 3.0 },
    { key: "cafe", label: "Cafes", filter: 'amenity=cafe', weight: 1.5 },
    { key: "restaurant", label: "Restaurants", filter: 'amenity=restaurant', weight: 1.5 },
    { key: "atm", label: "ATMs & banks", filter: 'amenity~"atm|bank"', weight: 1.5 },
    { key: "park", label: "Parks & green spaces", filter: 'leisure=park', weight: 2.0 },
    { key: "gym", label: "Gyms & fitness", filter: 'leisure=fitness_centre', weight: 1.5 },
    { key: "school", label: "Schools", filter: 'amenity~"school|college"', weight: 2.0 },
    { key: "hospital", label: "Hospitals & clinics", filter: 'amenity~"hospital|clinic"', weight: 2.0 },
  ]
  // build single combined query with named results
  const queryParts = categories.map((cat, i) =>
    `node[${cat.filter}](around:1600,${lat},${lng})->.r${i};`
  ).join("")
  const outParts = categories.map((cat, i) =>
    `.r${i} out;`
  ).join("")
  const fullQuery = `[out:json][timeout:25];(${queryParts});out;`

  // try multiple endpoints
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
  ]

  let allPlaces = []
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { method: "POST", body: fullQuery })
      if (!res.ok) continue
      const data = await res.json()
      allPlaces = data.elements || []
      if (allPlaces.length > 0) break
    } catch { continue }
  }

  // categorize results
  const breakdown = []
  let totalScore = 0
  for (const cat of categories) {
    const matches = allPlaces.filter(p => {
      if (!p.tags) return false
      if (cat.key === "grocery") return p.tags.shop && ["supermarket","convenience","grocery"].includes(p.tags.shop)
      if (cat.key === "pharmacy") return p.tags.amenity === "pharmacy"
      if (cat.key === "transit") return p.tags.public_transport
      if (cat.key === "cafe") return p.tags.amenity === "cafe"
      if (cat.key === "restaurant") return p.tags.amenity === "restaurant"
      if (cat.key === "atm") return p.tags.amenity === "atm" || p.tags.amenity === "bank"
      if (cat.key === "park") return p.tags.leisure === "park"
      if (cat.key === "gym") return p.tags.leisure === "fitness_centre"
      if (cat.key === "school") return p.tags.amenity === "school" || p.tags.amenity === "college"
      if (cat.key === "hospital") return p.tags.amenity === "hospital" || p.tags.amenity === "clinic"
      return false
    })
    let categoryScore = 0
    let within400 = 0, within800 = 0, within1600 = 0
    const placesScored = matches.slice(0, 3)
    for (const place of placesScored) {
      const dist = getDistanceKm(lat, lng, place.lat, place.lon) * 1000
      if (dist < 400) { categoryScore += cat.weight * 1.0; within400++ }
      else if (dist < 800) { categoryScore += cat.weight * 0.5; within800++ }
      else if (dist < 1600) { categoryScore += cat.weight * 0.25; within1600++ }
    }
    totalScore += categoryScore
    if (matches.length > 0) {
      breakdown.push({ label: cat.label, count: matches.length, within400, within800, within1600 })
    }
  }
  const finalScore = Math.min(100, Math.round(totalScore * 1.8))
  return { score: finalScore, breakdown }
}

function getWalkScoreLabel(score) {
  if (score >= 90) return { label: "Walker's Paradise", desc: "Daily errands don't need a vehicle" }
  if (score >= 70) return { label: "Very Walkable", desc: "Most errands can be done on foot" }
  if (score >= 50) return { label: "Somewhat Walkable", desc: "Some errands on foot, others need transport" }
  if (score >= 25) return { label: "Car-Dependent", desc: "Most errands need a vehicle" }
  return { label: "Car-Required", desc: "Almost nothing within walking distance" }
}

async function shareListing(listing) {
  const url = window.location.origin
  const text = `Check out this property on Homie — ${listing.title} in ${listing.location} for ₹${Number(listing.price).toLocaleString()}/mo. ${url}`
  if (navigator.share) {
    try { await navigator.share({ title: listing.title, text, url }); return } catch {}
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
}
async function shareApp() {
  const url = window.location.origin
  const text = `Hey, check out Homie — Lucknow's no-broker rental platform. ${url}`
  if (navigator.share) {
    try { await navigator.share({ title: "Homie", text, url }); return } catch {}
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
}

const AMENITIES = ["Parking", "Lift", "Generator", "24/7 Water", "WiFi", "Gas Pipeline", "Security", "CCTV", "Pets Allowed", "Bachelors OK", "AC", "Furnished"]

// ─── wordmark ─────────────────────────────────────────────────────────────────
function Wordmark({ size = 18, color }) {
  return (
    <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: size, letterSpacing: "-0.04em", color: color || C.text, lineHeight: 1 }}>
      Homie<span style={{ color: C.accent }}>.</span>
    </p>
  )
}

// ─── map picker ───────────────────────────────────────────────────────────────
function MapClickHandler({ onPick }) { useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng) } }); return null }
function RecenterMap({ center }) {
  const map = useMap()
  useEffect(() => { if (center) map.setView(center, 14) }, [center])
  return null
}

function MapPicker({ initialLat, initialLng, onConfirm, onClose }) {
  const [position, setPosition] = useState(initialLat && initialLng ? [initialLat, initialLng] : [26.8467, 80.9462])
  const [areaName, setAreaName] = useState("Tap the map to drop pin")
  const [confirming, setConfirming] = useState(false)

  async function updatePosition(lat, lng) { setPosition([lat, lng]); const name = await reverseGeocode(lat, lng); setAreaName(name) }
  function useGPS() {
    navigator.geolocation.getCurrentPosition(
      pos => updatePosition(pos.coords.latitude, pos.coords.longitude),
      () => alert("Location denied. Tap on the map.")
    )
  }
  async function confirm() { setConfirming(true); const name = await reverseGeocode(position[0], position[1]); onConfirm({ lat: position[0], lng: position[1], area: name }) }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: C.bg, fontFamily: FONT }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: C.border, background: C.surface }}>
        <button onClick={onClose} className="text-2xl" style={{ color: C.text }}>←</button>
        <div className="flex-1 min-w-0">
          <p style={{ color: C.textMuted, fontSize: 12, fontWeight: 500 }}>Pin location</p>
          <p style={{ color: C.text, fontSize: 15, fontWeight: 600 }} className="truncate">{areaName}</p>
        </div>
        <button onClick={useGPS} className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: C.surfaceLift, color: C.text }}>Use GPS</button>
      </div>
      <div className="flex-1 relative">
        <MapContainer center={position} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <RecenterMap center={position} />
          <Marker position={position} icon={listingIcon} draggable eventHandlers={{ dragend: e => updatePosition(e.target.getLatLng().lat, e.target.getLatLng().lng) }}>
            <Popup>{areaName}</Popup>
          </Marker>
          <MapClickHandler onPick={updatePosition} />
        </MapContainer>
      </div>
      <div className="px-5 py-4 border-t" style={{ borderColor: C.border, background: C.surface }}>
        <button onClick={confirm} disabled={confirming} className="w-full py-4 rounded-xl text-base font-semibold active:scale-[0.98]" style={{ background: C.text, color: C.bg }}>
          {confirming ? "Confirming..." : "Confirm location"}
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

  function pickCategory(cat) { setCategory(cat); setStep(2) }
  function getLocation() {
    setLocating(true); setError("")
    navigator.geolocation.getCurrentPosition(
      async pos => { const area = await reverseGeocode(pos.coords.latitude, pos.coords.longitude); onDone({ category, lat: pos.coords.latitude, lng: pos.coords.longitude, area }) },
      () => { setError("Location denied. Pick on map."); setLocating(false) }
    )
  }
  if (showMapPicker) return <MapPicker onConfirm={d => onDone({ category, ...d })} onClose={() => setShowMapPicker(false)} />

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: C.bg, fontFamily: FONT }}>
      {step === 1 && (
        <div className="w-full max-w-sm px-7 pb-10 flex flex-col items-center text-center">
          <div className="flex-1" />
          <Wordmark size={80} />
          <p style={{ color: C.textMuted, fontSize: 17, lineHeight: 1.45, marginTop: 24, maxWidth: 280, fontWeight: 400 }}>
            Changing the way you interact with real estate.
          </p>
          <div className="flex-1" />
          <div className="w-full">
            <p style={{ color: C.textMuted, fontSize: 13, fontWeight: 500, marginBottom: 14 }}>What are you looking for?</p>
            <div className="flex flex-col gap-2.5">
              <button onClick={() => pickCategory("residential")} className="text-center rounded-2xl px-5 py-4 active:scale-[0.99] transition-all w-full" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <p style={{ color: C.text, fontSize: 17, fontWeight: 600 }}>Residential</p>
                <p style={{ color: C.textMuted, fontSize: 13, marginTop: 2 }}>Homes, flats, PGs to live in</p>
              </button>
              <button onClick={() => pickCategory("commercial")} className="text-center rounded-2xl px-5 py-4 active:scale-[0.99] transition-all w-full" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <p style={{ color: C.text, fontSize: 17, fontWeight: 600 }}>Commercial</p>
                <p style={{ color: C.textMuted, fontSize: 13, marginTop: 2 }}>Offices, shops, warehouses</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="w-full max-w-sm px-7 pb-10 flex flex-col items-center text-center">
          <button onClick={() => setStep(1)} className="text-2xl self-start mb-6 -mt-12" style={{ color: C.text }}>←</button>
          <div className="flex-1 flex flex-col justify-center items-center w-full">
            <h1 style={{ color: C.text, fontSize: 44, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.05 }}>Where are you<br />looking?</h1>
            <p style={{ color: C.textMuted, fontSize: 16, lineHeight: 1.5, marginTop: 16, maxWidth: 300 }}>
              We'll surface {category} properties closest to you first.
            </p>
            {error && <p style={{ color: "#FF6B6B", fontSize: 14, marginTop: 16 }}>{error}</p>}
          </div>
          <div className="flex flex-col gap-2.5 w-full mt-8">
            <button onClick={getLocation} disabled={locating} className="w-full py-4 rounded-xl text-base font-semibold active:scale-[0.98]" style={{ background: C.text, color: C.bg }}>
              {locating ? "Locating..." : "Use my location"}
            </button>
            <button onClick={() => setShowMapPicker(true)} className="w-full py-4 rounded-xl text-base font-semibold" style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}` }}>
              Pick on map
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── location picker ──────────────────────────────────────────────────────────
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
      async pos => { const area = await reverseGeocode(pos.coords.latitude, pos.coords.longitude); pickArea(area, pos.coords.latitude, pos.coords.longitude) },
      () => setLocating(false)
    )
  }
  if (showMap) return <MapPicker onConfirm={d => pickArea(d.area, d.lat, d.lng)} onClose={() => setShowMap(false)} />

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: C.bg, fontFamily: FONT }}>
      <div className="px-5 pt-5 pb-3 border-b flex items-center gap-3" style={{ borderColor: C.border }}>
        <button onClick={onClose} className="text-2xl" style={{ color: C.text }}>←</button>
        <input autoFocus value={search} onChange={e => { setSearch(e.target.value); searchAreas(e.target.value) }} placeholder="Search area or locality"
          className="flex-1 rounded-xl px-4 py-3 text-sm focus:outline-none" style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}` }} />
      </div>
      <div className="flex-1 overflow-y-auto">
        <button onClick={useGPS} disabled={locating} className="w-full px-5 py-4 flex items-center gap-4 border-b text-left" style={{ borderColor: C.border }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.accent }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
          </div>
          <div>
            <p style={{ color: C.accent, fontSize: 15, fontWeight: 600 }}>{locating ? "Detecting..." : "Use current location"}</p>
            <p style={{ color: C.textMuted, fontSize: 13, marginTop: 2 }}>{currentArea || "Allow location access"}</p>
          </div>
        </button>
        <button onClick={() => setShowMap(true)} className="w-full px-5 py-4 flex items-center gap-4 border-b text-left" style={{ borderColor: C.border }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2"><path d="M12 2 4 6v14l8-4 8 4V6Z"/></svg>
          </div>
          <div>
            <p style={{ color: C.text, fontSize: 15, fontWeight: 600 }}>Pick on map</p>
            <p style={{ color: C.textMuted, fontSize: 13, marginTop: 2 }}>Drop a pin anywhere</p>
          </div>
        </button>
        {search.length >= 3 && results.length > 0 && <>
          <p className="px-5 pt-5 pb-2" style={{ color: C.textMuted, fontSize: 12, fontWeight: 600 }}>Search results</p>
          {results.map((r, i) => (
            <button key={i} onClick={() => pickArea(r.display_name.split(",")[0], parseFloat(r.lat), parseFloat(r.lon))} className="w-full px-5 py-3 border-b text-left" style={{ borderColor: C.border }}>
              <p style={{ color: C.text, fontSize: 15, fontWeight: 500 }}>{r.display_name.split(",")[0]}</p>
              <p style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }} className="truncate">{r.display_name}</p>
            </button>
          ))}
        </>}
        {recent.length > 0 && search.length === 0 && <>
          <p className="px-5 pt-5 pb-2" style={{ color: C.textMuted, fontSize: 12, fontWeight: 600 }}>Recent</p>
          {recent.map((r, i) => (
            <button key={i} onClick={() => pickArea(r, null, null)} className="w-full px-5 py-3 border-b text-left" style={{ borderColor: C.border }}>
              <p style={{ color: C.text, fontSize: 15, fontWeight: 500 }}>{r}</p>
            </button>
          ))}
        </>}
        {search.length === 0 && <>
          <p className="px-5 pt-5 pb-2" style={{ color: C.textMuted, fontSize: 12, fontWeight: 600 }}>Popular areas</p>
          <div className="px-5 pb-5 flex flex-wrap gap-2">
            {POPULAR.map(p => <button key={p} onClick={() => pickArea(p, null, null)} className="px-4 py-2 rounded-full text-sm" style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}` }}>{p}</button>)}
          </div>
        </>}
      </div>
    </div>
  )
}

// ─── listing detail ───────────────────────────────────────────────────────────
function ListingDetail({ listing, onClose, onSave, isSaved }) {
  const [tab, setTab] = useState("overview")
  const [nearby, setNearby] = useState({ hospital: [], cafe: [], gym: [], education: [] })
  const [loadingNearby, setLoadingNearby] = useState(false)
  const [walkScore, setWalkScore] = useState(null)
  const [loadingWalk, setLoadingWalk] = useState(false)
  const photos = getPhotos(listing)

  useEffect(() => {
    if (tab === "walk score" && !walkScore) {
      // use saved walk score from DB if available
      if (listing.walk_score !== null && listing.walk_score !== undefined) {
        setWalkScore({ score: listing.walk_score, breakdown: listing.walk_score_breakdown || [] })
        return
      }
      // fallback: compute on the fly if not saved (old listings)
      if (listing.latitude && listing.longitude) {
        const cacheKey = `homie_walkscore_${listing.id}`
        const cached = localStorage.getItem(cacheKey)
        if (cached) { setWalkScore(JSON.parse(cached)); return }
        setLoadingWalk(true)
        calculateWalkScore(listing.latitude, listing.longitude).then(result => {
          setWalkScore(result)
          localStorage.setItem(cacheKey, JSON.stringify(result))
          setLoadingWalk(false)
        })
      }
    }
  }, [tab])

  useEffect(() => {
    if (tab === "neighborhood" && listing.latitude && listing.longitude) {
      // use saved data if available
      if (listing.nearby_places) {
        setNearby({
          hospital: listing.nearby_places.hospital || [],
          cafe: listing.nearby_places.cafe || [],
          gym: listing.nearby_places.gym || [],
          education: listing.nearby_places.education || [],
        })
        return
      }
      // fallback: fetch live for old listings
      setLoadingNearby(true)
      Promise.all([
        fetchNearby(listing.latitude, listing.longitude, "hospital"),
        fetchNearby(listing.latitude, listing.longitude, "cafe"),
        fetchNearby(listing.latitude, listing.longitude, "gym"),
        fetchNearby(listing.latitude, listing.longitude, "education"),
      ]).then(([hospital, cafe, gym, education]) => { setNearby({ hospital, cafe, gym, education }); setLoadingNearby(false) })
    }
  }, [tab])

  const tabs = ["overview", "walk score", "amenities", "neighborhood", "location"]

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: C.bg, fontFamily: FONT }}>
      <button onClick={onClose} className="absolute top-4 left-4 z-30 w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: "rgba(28,28,30,0.85)", backdropFilter: "blur(20px)", color: C.text }}>←</button>
      <div className="absolute top-4 right-4 z-30 flex gap-2">
        <button onClick={() => shareListing(listing)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(28,28,30,0.85)", backdropFilter: "blur(20px)", color: C.text }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        </button>
        <button onClick={() => onSave(listing)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: isSaved ? C.accent : "rgba(28,28,30,0.85)", backdropFilter: "blur(20px)", color: isSaved ? "#000" : C.text }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {photos.length > 0 ? (
          <div style={{ background: "#000" }}>
            {photos.map((url, i) => <img key={i} src={url} alt="" className="w-full h-auto" style={{ maxHeight: "75vh", objectFit: "contain" }} />)}
          </div>
        ) : (
          <div className="w-full h-80 flex items-center justify-center" style={{ background: C.surface }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
        )}

        <div className="px-6 pt-8 pb-6">
          <p style={{ color: C.textMuted, fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
            {listing.category === "commercial" ? "Commercial" : "Residential"} · {timeAgo(listing.created_at)}
          </p>
          <h1 style={{ color: C.text, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{listing.title}</h1>
          <p style={{ color: C.textMuted, fontSize: 15, marginTop: 8 }}>{listing.location}{listing.distance && ` · ${listing.distance} km away`}</p>
          <div className="flex items-baseline gap-2 mt-6 pt-6 border-t" style={{ borderColor: C.border }}>
            <p style={{ color: C.text, fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em" }}>₹{Number(listing.price).toLocaleString()}</p>
            <p style={{ color: C.textMuted, fontSize: 15 }}>per month</p>
          </div>
        </div>

        <div className="flex border-b sticky top-0 z-10 px-3" style={{ borderColor: C.border, background: C.bg }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} className="px-4 py-3.5 text-sm font-semibold capitalize border-b-2 transition-all" style={{
              borderColor: tab === t ? C.accent : "transparent",
              color: tab === t ? C.text : C.textMuted,
            }}>{t}</button>
          ))}
        </div>

        <div className="px-6 py-6">
          {tab === "overview" && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-2">
                {listing.beds && <div className="rounded-xl p-4 text-center" style={{ background: C.surface }}><p style={{ color: C.textMuted, fontSize: 12 }}>Beds</p><p style={{ color: C.text, fontSize: 22, fontWeight: 600, marginTop: 4 }}>{listing.beds}</p></div>}
                {listing.baths && <div className="rounded-xl p-4 text-center" style={{ background: C.surface }}><p style={{ color: C.textMuted, fontSize: 12 }}>Baths</p><p style={{ color: C.text, fontSize: 22, fontWeight: 600, marginTop: 4 }}>{listing.baths}</p></div>}
                {listing.sqft && <div className="rounded-xl p-4 text-center" style={{ background: C.surface }}><p style={{ color: C.textMuted, fontSize: 12 }}>Sqft</p><p style={{ color: C.text, fontSize: 22, fontWeight: 600, marginTop: 4 }}>{listing.sqft}</p></div>}
              </div>
              {listing.furnished && (
                <div className="flex items-center justify-between py-4 border-t" style={{ borderColor: C.border }}>
                  <p style={{ color: C.textMuted, fontSize: 14 }}>Furnishing</p>
                  <p style={{ color: C.text, fontSize: 15, fontWeight: 500 }}>{listing.furnished}</p>
                </div>
              )}
              <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: C.border }}>
                <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: C.surface, color: C.accent, fontSize: 18, fontWeight: 600 }}>
                  {listing.owner_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p style={{ color: C.text, fontSize: 15, fontWeight: 600 }}>{listing.owner_name}</p>
                  <p style={{ color: C.textMuted, fontSize: 13 }}>Direct owner · No broker</p>
                </div>
              </div>
            </div>
          )}
{tab === "walk score" && (
            <div>
              {!listing.latitude ? (
                <p className="text-center py-12" style={{ color: C.textMuted, fontSize: 14 }}>Owner hasn't pinned this property — walk score unavailable</p>
              ) : loadingWalk ? (
                <p className="text-center py-12 animate-pulse" style={{ color: C.textMuted, fontSize: 14 }}>Calculating walkability...</p>
              ) : walkScore ? (
                <div className="flex flex-col gap-6">
                  {/* big score */}
                  <div className="rounded-2xl p-6 text-center" style={{ background: C.surface }}>
                    <p style={{ color: C.text, fontSize: 72, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>
                      {walkScore.score}
                    </p>
                    <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>out of 100</p>
                    <p style={{ color: C.accent, fontSize: 18, fontWeight: 600, marginTop: 16 }}>
                      {getWalkScoreLabel(walkScore.score).label}
                    </p>
                    <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
                      {getWalkScoreLabel(walkScore.score).desc}
                    </p>
                  </div>

                  {/* breakdown */}
                  <div>
                    <p style={{ color: C.textMuted, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>What's around you</p>
                    <div className="flex flex-col gap-2">
                      {walkScore.breakdown.length === 0 ? (
                        <p style={{ color: C.textSubtle, fontSize: 13 }}>Nothing significant within walking distance</p>
                      ) : walkScore.breakdown.map((cat, i) => (
                        <div key={i} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: C.surface }}>
                          <div>
                            <p style={{ color: C.text, fontSize: 14, fontWeight: 500 }}>{cat.label}</p>
                            <p style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>
                              {cat.within400 > 0 && `${cat.within400} within 5 min`}
                              {cat.within400 > 0 && cat.within800 > 0 && " · "}
                              {cat.within800 > 0 && `${cat.within800} within 10 min`}
                              {(cat.within400 > 0 || cat.within800 > 0) && cat.within1600 > 0 && " · "}
                              {cat.within1600 > 0 && `${cat.within1600} within 20 min`}
                            </p>
                          </div>
                          <p style={{ color: C.accent, fontSize: 18, fontWeight: 700 }}>{cat.count}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p style={{ color: C.textSubtle, fontSize: 11, lineHeight: 1.5, marginTop: 8 }}>
                    Walk Score is based on points of interest within walking distance. Real-world walkability varies based on weather, footpaths, and safety.
                  </p>
                </div>
              ) : null}
            </div>
          )}
          {tab === "amenities" && (
            listing.amenities && listing.amenities.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {listing.amenities.map(a => <div key={a} className="px-4 py-3 rounded-xl text-sm font-medium" style={{ background: C.surface, color: C.text }}>{a}</div>)}
              </div>
            ) : <p className="text-center py-12" style={{ color: C.textMuted, fontSize: 14 }}>No amenities listed</p>
          )}

          {tab === "neighborhood" && (
            <div>
              {!listing.latitude ? (
                <p className="text-center py-12" style={{ color: C.textMuted, fontSize: 14 }}>Owner hasn't pinned this property</p>
              ) : loadingNearby ? (
                <p className="text-center py-12 animate-pulse" style={{ color: C.textMuted, fontSize: 14 }}>Finding what's nearby...</p>
              ) : (
                <div className="flex flex-col gap-7">
                  {[
                    { key: "hospital", label: "Healthcare" },
                    { key: "education", label: "Schools & Colleges" },
                    { key: "cafe", label: "Food & cafes" },
                    { key: "gym", label: "Fitness" },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <p style={{ color: C.textMuted, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{label}</p>
                      {nearby[key].length === 0 ? <p style={{ color: C.textSubtle, fontSize: 13 }}>None found nearby</p> : (
                        <div>
                          {nearby[key].slice(0, 4).map((place, i) => (
                            <div key={i} className="flex items-center justify-between py-3 border-b" style={{ borderColor: C.border }}>
                              <p style={{ color: C.text, fontSize: 14 }}>{place.tags?.name || "Unnamed"}</p>
                              {place.lat && <p style={{ color: C.textMuted, fontSize: 12 }}>{getDistanceKm(listing.latitude, listing.longitude, place.lat, place.lon).toFixed(1)} km</p>}
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

          {tab === "location" && (
            <div className="rounded-xl overflow-hidden h-72">
              {listing.latitude && listing.longitude ? (
                <MapContainer center={[listing.latitude, listing.longitude]} zoom={15} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[listing.latitude, listing.longitude]} icon={listingIcon}><Popup>{listing.title}</Popup></Marker>
                  <Circle center={[listing.latitude, listing.longitude]} radius={200} pathOptions={{ color: C.accent, fillColor: C.accent, fillOpacity: 0.15 }} />
                </MapContainer>
              ) : <p className="text-center pt-24" style={{ color: C.textMuted, fontSize: 14 }}>No exact location shared</p>}
            </div>
          )}
        </div>
        <div className="h-24" />
      </div>

      <div className="px-5 py-4 border-t flex gap-2" style={{ borderColor: C.border, background: C.bg }}>
        <button
          onClick={() => window.open("https://wa.me/91" + listing.phone + "?text=Hi " + listing.owner_name + ", I saw your listing on Homie — " + listing.title + " in " + listing.location + ". Is it still available?")}
          className="flex-1 py-4 rounded-xl text-base font-semibold active:scale-[0.98]"
          style={{ background: C.text, color: C.bg }}
        >
          Message {listing.owner_name?.split(" ")[0]}
        </button>
        <button onClick={() => shareListing(listing)} className="py-4 px-5 rounded-xl text-sm font-semibold active:scale-[0.98]" style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}` }}>
          Share
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
  const startY = useRef(0)
  const offsetX = useRef(0)
  const isDragging = useRef(false)
  const didDrag = useRef(false)
  const [dragState, setDragState] = useState({ x: 0, dir: null, animating: false })
  const listing = cards[current]

  function handleStart(clientX, clientY) {
    if (dragState.animating) return
    startX.current = clientX; startY.current = clientY
    offsetX.current = 0; isDragging.current = true; didDrag.current = false
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
    if (Math.abs(offsetX.current) > 90) {
      const dir = offsetX.current > 0 ? "right" : "left"
      setDragState({ x: dir === "right" ? 700 : -700, dir, animating: true })
      setTimeout(() => { onSwipe(dir, listing); setCurrent(c => c + 1); setDragState({ x: 0, dir: null, animating: false }) }, 280)
    } else { setDragState({ x: 0, dir: null, animating: false }); offsetX.current = 0 }
  }
  function buttonSwipe(dir) {
    if (dragState.animating) return
    setDragState({ x: dir === "right" ? 700 : -700, dir, animating: true })
    setTimeout(() => { onSwipe(dir, listing); setCurrent(c => c + 1); setDragState({ x: 0, dir: null, animating: false }) }, 280)
  }

  if (!listing || current >= cards.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8" style={{ fontFamily: FONT }}>
        <p style={{ color: C.textMuted, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>All done</p>
        <h2 style={{ color: C.text, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em" }}>You've seen everything.</h2>
        <p style={{ color: C.textMuted, fontSize: 15, marginTop: 8, marginBottom: 24 }}>Check back soon. New listings drop daily.</p>
        <button onClick={() => setCurrent(0)} className="px-7 py-3 rounded-xl text-sm font-semibold" style={{ background: C.text, color: C.bg }}>Start over</button>
      </div>
    )
  }

  const photos = getPhotos(listing)
  const rotate = dragState.x / 22
  const opacity = Math.min(Math.abs(dragState.x) / 90, 1)
  const isNew = (new Date() - new Date(listing.created_at)) < 86400000
  const nextCard = cards[current + 1]

  return (
    <div className="flex-1 flex flex-col items-center justify-start px-4 pt-4 pb-3 overflow-hidden" style={{ fontFamily: FONT }}>
      <div className="relative w-full max-w-sm flex-1" style={{ maxHeight: 600 }}>
        {nextCard && <div className="absolute inset-x-4 top-3 bottom-0 rounded-2xl z-0" style={{ background: C.surface, border: `1px solid ${C.border}`, transform: "scale(0.95)" }} />}

        <div
          onClick={() => !didDrag.current && onOpen(listing)}
          onTouchStart={e => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={e => handleMove(e.touches[0].clientX)}
          onTouchEnd={handleEnd}
          onMouseDown={e => handleStart(e.clientX, e.clientY)}
          onMouseMove={e => { if (isDragging.current) handleMove(e.clientX) }}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          style={{
            transform: `translateX(${dragState.x}px) rotate(${rotate}deg)`,
            transition: isDragging.current ? "none" : "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
            zIndex: 10, background: C.surface, border: `1px solid ${C.border}`,
          }}
          className="absolute inset-0 rounded-2xl overflow-hidden select-none cursor-pointer"
        >
          {dragState.dir === "right" && <div style={{ opacity, borderColor: C.accent, color: C.accent, background: "rgba(28,28,30,0.9)" }} className="absolute top-8 left-5 z-20 border-2 font-bold text-sm px-4 py-2 rounded-lg -rotate-12">SAVE</div>}
          {dragState.dir === "left" && <div style={{ opacity, borderColor: C.textMuted, color: C.textMuted, background: "rgba(28,28,30,0.9)" }} className="absolute top-8 right-5 z-20 border-2 font-bold text-sm px-4 py-2 rounded-lg rotate-12">SKIP</div>}

          <div className="relative h-80" style={{ background: "#000" }}>
            {photos.length > 0 ? <img src={photos[0]} alt="" className="w-full h-full object-cover pointer-events-none" /> : (
              <div className="w-full h-full flex items-center justify-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            {isNew && <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full" style={{ background: C.accent, color: "#000" }}><p style={{ fontSize: 11, fontWeight: 700 }}>NEW</p></div>}
            <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.95)" }}>
              <span style={{ color: "#000", fontSize: 14, fontWeight: 700 }}>₹{Number(listing.price).toLocaleString()}</span>
              <span style={{ color: "#666", fontSize: 11, marginLeft: 2 }}>/mo</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h2 style={{ color: "#FFF", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15 }}>{listing.title}</h2>
              <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 }}>{listing.location}{listing.distance ? ` · ${listing.distance} km away` : ""}</p>
            </div>
          </div>

          <div className="p-5">
            <div className="flex gap-2 flex-wrap mb-4">
              {listing.beds && <span className="px-3 py-1 rounded-full text-xs" style={{ background: C.bg, color: C.textMuted, border: `1px solid ${C.border}` }}>{listing.beds} Beds</span>}
              {listing.baths && <span className="px-3 py-1 rounded-full text-xs" style={{ background: C.bg, color: C.textMuted, border: `1px solid ${C.border}` }}>{listing.baths} Baths</span>}
              {listing.sqft && <span className="px-3 py-1 rounded-full text-xs" style={{ background: C.bg, color: C.textMuted, border: `1px solid ${C.border}` }}>{listing.sqft} sqft</span>}
              {listing.furnished && <span className="px-3 py-1 rounded-full text-xs" style={{ background: "rgba(255,111,77,0.15)", color: C.accent }}>{listing.furnished}</span>}
            </div>

            <div className="flex items-center justify-between mb-4 pt-3 border-t" style={{ borderColor: C.border }}>
              <p style={{ color: C.textMuted, fontSize: 12 }}>{listing.owner_name} · {timeAgo(listing.created_at)}</p>
              <p style={{ color: C.accent, fontSize: 12, fontWeight: 600 }}>Tap for details →</p>
            </div>

            <div className="flex gap-2">
              <button onClick={e => { e.stopPropagation(); buttonSwipe("left") }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} className="flex-1 py-3.5 rounded-xl text-sm font-semibold active:scale-95" style={{ background: C.bg, color: C.textMuted, border: `1px solid ${C.border}` }}>Skip</button>
              <button onClick={e => { e.stopPropagation(); window.open("https://wa.me/91" + listing.phone) }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} className="flex-1 py-3.5 rounded-xl text-sm font-semibold active:scale-95" style={{ background: C.text, color: C.bg }}>Message</button>
              <button onClick={e => { e.stopPropagation(); buttonSwipe("right") }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} className="flex-1 py-3.5 rounded-xl text-sm font-semibold active:scale-95" style={{ background: C.accent, color: "#000" }}>Save</button>
            </div>
          </div>
        </div>
      </div>
      <p style={{ color: C.textSubtle, fontSize: 12, marginTop: 12 }}>{cards.length - current} remaining</p>
    </div>
  )
}

// ─── map view ─────────────────────────────────────────────────────────────────
function MapView({ listings, userLoc, onOpen }) {
  const center = userLoc ? [userLoc.lat, userLoc.lng] : [26.8467, 80.9462]
  const pinned = listings.filter(l => l.latitude && l.longitude)
  return (
    <div className="relative flex-1 overflow-hidden" style={{ fontFamily: FONT }}>
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {userLoc && (
          <>
            <Circle center={[userLoc.lat, userLoc.lng]} radius={400} pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.1, weight: 1.5 }} />
            <Marker position={[userLoc.lat, userLoc.lng]} icon={userIcon}><Popup>You are here</Popup></Marker>
          </>
        )}
        {pinned.map(l => (
          <Marker key={l.id} position={[l.latitude, l.longitude]} icon={listingIcon}>
            <Popup>
              <div className="min-w-[160px]">
                {getPhotos(l)[0] && <img src={getPhotos(l)[0]} alt="" className="w-full h-20 object-cover rounded-lg mb-2" />}
                <p style={{ fontWeight: 600, fontSize: 13 }}>{l.title}</p>
                <p style={{ color: C.accentDark, fontSize: 13, fontWeight: 600 }}>₹{Number(l.price).toLocaleString()}/mo</p>
                <p style={{ color: "#666", fontSize: 11, marginBottom: 8 }}>{l.location}</p>
                <button onClick={() => onOpen(l)} className="w-full text-xs font-semibold py-2 rounded-lg" style={{ background: "#000", color: "#FFF" }}>View Details</button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="absolute top-4 left-4 right-4 px-4 py-3 rounded-xl z-10 flex items-center justify-between pointer-events-none" style={{ background: "rgba(28,28,30,0.85)", backdropFilter: "blur(20px)", border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
            <p style={{ color: C.textMuted, fontSize: 11 }}>You</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF3B30" }} />
            <p style={{ color: C.textMuted, fontSize: 11 }}>Listings</p>
          </div>
        </div>
        <p style={{ color: C.textMuted, fontSize: 12 }}>{pinned.length} pinned</p>
      </div>
    </div>
  )
}

// ─── photo uploader ───────────────────────────────────────────────────────────
function PhotoUploader({ onPhotosChange }) {
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  async function compressImage(file) {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const maxWidth = 1200
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement("canvas")
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext("2d")
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(blob => resolve(blob), "image/jpeg", 0.82)
      }
      img.src = URL.createObjectURL(file)
    })
  }

  async function uploadPhoto(e) {
    const files = Array.from(e.target.files)
    if (photos.length + files.length > 5) { alert("Max 5 photos"); return }
    setUploading(true)
    const urls = []
    for (const file of files) {
      const compressed = await compressImage(file)
      const filename = Date.now() + "-" + Math.random().toString(36).slice(2) + ".jpg"
      const { error } = await supabase.storage.from("photos").upload(filename, compressed, { contentType: "image/jpeg" })
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
            <button onClick={() => removePhoto(idx)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center" style={{ background: C.text, color: C.bg }}>×</button>
          </div>
        ))}
        {photos.length < 5 && (
          <label className="w-20 h-20 rounded-lg flex flex-col items-center justify-center cursor-pointer" style={{ background: C.surface, border: `1px dashed ${C.border}` }}>
            <span style={{ color: C.textMuted, fontSize: 20 }}>{uploading ? "•••" : "+"}</span>
            <span style={{ color: C.textMuted, fontSize: 10, marginTop: 2 }}>{uploading ? "" : "Add"}</span>
            <input type="file" accept="image/*" multiple onChange={uploadPhoto} className="hidden" />
          </label>
        )}
      </div>
      <p style={{ color: C.textMuted, fontSize: 11, marginTop: 8 }}>{photos.length}/5</p>
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
      () => { setError("Location denied. Pick on map."); setLocating(false) }
    )
  }
  function handleMapPick(d) { setForm(f => ({ ...f, latitude: d.lat, longitude: d.lng, location: f.location || d.area })); setLocationSet(true); setShowMapPicker(false) }
  async function submit() {
    if (!form.title || !form.price || !form.phone || !form.owner_name || !form.location) { setError("Please fill all required fields."); return }
    setLoading(true)
    let walkData = { score: null, breakdown: null }
    let nearbyPlaces = null
    if (form.latitude && form.longitude) {
      try {
        const result = await calculateWalkScore(form.latitude, form.longitude)
        walkData = { score: result.score, breakdown: result.breakdown }
      } catch {}
      try {
        const [hospital, cafe, gym, education] = await Promise.all([
          fetchNearby(form.latitude, form.longitude, "hospital"),
          fetchNearby(form.latitude, form.longitude, "cafe"),
          fetchNearby(form.latitude, form.longitude, "gym"),
          fetchNearby(form.latitude, form.longitude, "education"),
        ])
        nearbyPlaces = {
          hospital: hospital.slice(0, 4).map(p => ({ name: p.tags?.name || "Unnamed", lat: p.lat, lon: p.lon })),
          cafe: cafe.slice(0, 4).map(p => ({ name: p.tags?.name || "Unnamed", lat: p.lat, lon: p.lon })),
          gym: gym.slice(0, 4).map(p => ({ name: p.tags?.name || "Unnamed", lat: p.lat, lon: p.lon })),
          education: education.slice(0, 4).map(p => ({ name: p.tags?.name || "Unnamed", lat: p.lat, lon: p.lon })),
        }
      } catch {}
    }
    const cleaned = {
      ...form,
      price: Number(form.price),
      beds: form.beds === "" ? null : Number(form.beds),
      baths: form.baths === "" ? null : Number(form.baths),
      sqft: form.sqft === "" ? null : Number(form.sqft),
      walk_score: walkData.score,
      walk_score_breakdown: walkData.breakdown,
      nearby_places: nearbyPlaces,
    }
    const { error } = await supabase.from("listings").insert([cleaned]).select()
    setLoading(false)
    if (error) { setError(error.message); return }
    onSuccess(); onClose()
  }
  if (showMapPicker) return <MapPicker initialLat={form.latitude} initialLng={form.longitude} onConfirm={handleMapPick} onClose={() => setShowMapPicker(false)} />

  const inputStyle = { background: C.surface, color: C.text, border: `1px solid ${C.border}`, fontFamily: FONT }
  const inputCls = "w-full rounded-xl px-4 py-3.5 text-sm focus:outline-none"

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)", fontFamily: FONT }}>
      <div className="rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto" style={{ background: C.bg }}>
        <div className="sticky top-0 px-6 pt-6 pb-4 border-b flex justify-between items-start" style={{ borderColor: C.border, background: C.bg }}>
          <div>
            <p style={{ color: C.accent, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>List property</p>
            <h2 style={{ color: C.text, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>Free. Forever.</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-base" style={{ background: C.surface, color: C.text }}>×</button>
        </div>
        <div className="px-6 pb-8 pt-5 flex flex-col gap-5">
          {error && <div className="text-sm px-4 py-3 rounded-lg" style={{ background: "rgba(255,107,107,0.15)", color: "#FF6B6B" }}>{error}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm({ ...form, category: "residential" })} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: form.category === "residential" ? C.text : C.surface, color: form.category === "residential" ? C.bg : C.textMuted, border: `1px solid ${C.border}` }}>Residential</button>
            <button type="button" onClick={() => setForm({ ...form, category: "commercial" })} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: form.category === "commercial" ? C.text : C.surface, color: form.category === "commercial" ? C.bg : C.textMuted, border: `1px solid ${C.border}` }}>Commercial</button>
          </div>
          <div>
            <p style={{ color: C.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Photos · up to 5</p>
            <PhotoUploader onPhotosChange={handlePhotos} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input name="owner_name" placeholder="Your name" value={form.owner_name} onChange={handle} className={inputCls} style={inputStyle} />
            <input name="phone" placeholder="WhatsApp" value={form.phone} onChange={handle} className={inputCls} style={inputStyle} />
          </div>
          <input name="title" placeholder="Property title" value={form.title} onChange={handle} className={inputCls} style={inputStyle} />
          <input name="location" placeholder="Area / Locality" value={form.location} onChange={handle} className={inputCls} style={inputStyle} />
          <div className="grid grid-cols-2 gap-2">
            <input name="price" placeholder="Monthly rent ₹" type="number" value={form.price} onChange={handle} className={inputCls} style={inputStyle} />
            <select name="furnished" value={form.furnished} onChange={handle} className={inputCls} style={inputStyle}>
              <option value="Furnished">Furnished</option>
              <option value="Semi Furnished">Semi Furnished</option>
              <option value="Unfurnished">Unfurnished</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input name="beds" placeholder="Beds" type="number" value={form.beds} onChange={handle} className={inputCls} style={inputStyle} />
            <input name="baths" placeholder="Baths" type="number" value={form.baths} onChange={handle} className={inputCls} style={inputStyle} />
            <input name="sqft" placeholder="Sqft" type="number" value={form.sqft} onChange={handle} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <p style={{ color: C.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Amenities</p>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map(a => (
                <button key={a} type="button" onClick={() => toggleAmenity(a)} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{
                  background: form.amenities.includes(a) ? C.accent : C.surface,
                  color: form.amenities.includes(a) ? "#000" : C.textMuted,
                  border: `1px solid ${form.amenities.includes(a) ? C.accent : C.border}`,
                }}>{a}</button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ color: C.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Pin location</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={getLocation} disabled={locating} className="py-3 rounded-xl text-sm font-semibold" style={{ background: locationSet ? C.accent : C.surface, color: locationSet ? "#000" : C.textMuted, border: `1px solid ${locationSet ? C.accent : C.border}` }}>{locating ? "..." : locationSet ? "✓ Pinned" : "Use GPS"}</button>
              <button type="button" onClick={() => setShowMapPicker(true)} className="py-3 rounded-xl text-sm font-semibold" style={{ background: C.surface, color: C.textMuted, border: `1px solid ${C.border}` }}>Pick on map</button>
            </div>
          </div>
          <button onClick={submit} disabled={loading} className="w-full py-4 rounded-xl text-base font-semibold active:scale-[0.98] disabled:opacity-40" style={{ background: C.text, color: C.bg }}>
            {loading ? "Publishing... (calculating walkability)" : "Publish listing"}
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
    // 1. instantly show cached listings if we have them
    const cached = JSON.parse(localStorage.getItem("homie_listings_cache") || "null")
    if (cached) {
      const cachedWithDistance = cached.map(l => ({
        ...l,
        distance: loc && l.latitude && l.longitude ? getDistanceKm(loc.lat, loc.lng, l.latitude, l.longitude).toFixed(1) : null
      })).sort((a, b) => { if (a.distance && b.distance) return a.distance - b.distance; if (a.distance) return -1; if (b.distance) return 1; return 0 })
      setListings(cachedWithDistance)
    }
    // 2. fetch fresh data in background
    const { data } = await supabase.from("listings").select("*").eq("type", "rent").order("created_at", { ascending: false })
    if (!data) return
    localStorage.setItem("homie_listings_cache", JSON.stringify(data))
    const result = data.map(l => ({ ...l, distance: loc && l.latitude && l.longitude ? getDistanceKm(loc.lat, loc.lng, l.latitude, l.longitude).toFixed(1) : null }))
      .sort((a, b) => { if (a.distance && b.distance) return a.distance - b.distance; if (a.distance) return -1; if (b.distance) return 1; return 0 })
    setListings(result)
  }
  function handleOnboardingDone(d) { localStorage.setItem("homie_setup", JSON.stringify(d)); setUserLoc({ lat: d.lat, lng: d.lng }); setArea(d.area); setCategory(d.category); setActiveTab(d.category); setShowOnboarding(false); fetchListings({ lat: d.lat, lng: d.lng }) }
  function handleLocationChange(d) {
    const newSetup = { ...JSON.parse(localStorage.getItem("homie_setup") || "{}"), area: d.area, lat: d.lat, lng: d.lng }
    localStorage.setItem("homie_setup", JSON.stringify(newSetup))
    setArea(d.area)
    if (d.lat && d.lng) { setUserLoc({ lat: d.lat, lng: d.lng }); fetchListings({ lat: d.lat, lng: d.lng }) }
    setShowLocationPicker(false)
  }
  function handleSwipe(dir, listing) {
    if (dir === "right") { const newSaved = [...saved.filter(s => s.id !== listing.id), listing]; setSaved(newSaved); localStorage.setItem("homie_saved", JSON.stringify(newSaved)) }
  }
  function toggleSave(listing) {
    const isSaved = saved.some(s => s.id === listing.id)
    const newSaved = isSaved ? saved.filter(s => s.id !== listing.id) : [...saved, listing]
    setSaved(newSaved); localStorage.setItem("homie_saved", JSON.stringify(newSaved))
  }

  const filtered = listings.filter(l => (l.category || "residential") === activeTab)
  if (showOnboarding) return <Onboarding onDone={handleOnboardingDone} />

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: C.bg, fontFamily: FONT, color: C.text }}>
      {showForm && <UploadForm onClose={() => setShowForm(false)} onSuccess={() => fetchListings(userLoc)} defaultCategory={activeTab} />}
      {openListing && <ListingDetail listing={openListing} onClose={() => setOpenListing(null)} onSave={toggleSave} isSaved={saved.some(s => s.id === openListing.id)} />}
      {showLocationPicker && <LocationPicker currentArea={area} onPick={handleLocationChange} onClose={() => setShowLocationPicker(false)} />}

      <div className="px-5 py-3.5 border-b flex items-center gap-3 flex-shrink-0" style={{ borderColor: C.border, background: C.bg }}>
        <Wordmark size={18} />
        <button onClick={() => setShowLocationPicker(true)} className="flex-1 min-w-0 flex items-center gap-2 text-left ml-1 rounded-xl px-3 py-1.5" style={{ background: C.surface }}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: C.accent }} />
          <p className="truncate" style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>{area || "Set location"}</p>
          <span style={{ color: C.textMuted, fontSize: 10 }}>▾</span>
        </button>
        <div className="flex rounded-lg p-0.5 flex-shrink-0" style={{ background: C.surface }}>
          <button onClick={() => setViewMode("swipe")} className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: viewMode === "swipe" ? C.text : "transparent", color: viewMode === "swipe" ? C.bg : C.textMuted }}>Swipe</button>
          <button onClick={() => setViewMode("map")} className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: viewMode === "map" ? C.text : "transparent", color: viewMode === "map" ? C.bg : C.textMuted }}>Map</button>
        </div>
        <button onClick={() => setShowForm(true)} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0" style={{ background: C.accent, color: "#000" }}>+ List</button>
      </div>

      {activeTab === "saved" ? (
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-7 pb-4 flex items-end justify-between">
            <div>
              <p style={{ color: C.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Your collection</p>
              <h2 style={{ color: C.text, fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>Saved</h2>
            </div>
            <button onClick={shareApp} className="px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5" style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}` }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              Share with friend
            </button>
          </div>
          {saved.length === 0 ? (
            <div className="text-center py-20 px-8">
              <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 4 }}>Nothing saved yet</p>
              <p style={{ color: C.textSubtle, fontSize: 12 }}>Swipe right or tap ♡ on listings you like</p>
            </div>
          ) : (
            <div className="px-5 pb-6 flex flex-col gap-2">
              {saved.map(l => {
                const photos = getPhotos(l)
                return (
                  <button key={l.id} onClick={() => setOpenListing(l)} className="rounded-2xl overflow-hidden flex text-left w-full active:scale-[0.99]" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                    <div className="w-28 h-28 flex-shrink-0" style={{ background: "#000" }}>
                      {photos[0] ? <img src={photos[0]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>}
                    </div>
                    <div className="flex-1 p-4 min-w-0">
                      <p className="truncate" style={{ color: C.text, fontSize: 15, fontWeight: 600 }}>{l.title}</p>
                      <p style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{l.location}</p>
                      <p style={{ color: C.text, fontSize: 18, fontWeight: 700, marginTop: 6 }}>₹{Number(l.price).toLocaleString()}<span style={{ color: C.textMuted, fontSize: 11, marginLeft: 4, fontWeight: 400 }}>/mo</span></p>
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
          <p style={{ color: C.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Quiet here</p>
          <h2 style={{ color: C.text, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>No {activeTab} listings yet.</h2>
          <p style={{ color: C.textMuted, fontSize: 14, marginTop: 8, marginBottom: 24 }}>Be the first to list one here.</p>
          <button onClick={() => setShowForm(true)} className="px-7 py-3 rounded-xl text-sm font-semibold" style={{ background: C.text, color: C.bg }}>List property</button>
        </div>
      ) : (
        <SwipeStack listings={filtered} onSwipe={handleSwipe} onOpen={setOpenListing} />
      )}

      <div className="border-t flex-shrink-0" style={{ borderColor: C.border, background: C.bg }}>
        <div className="flex justify-around items-center py-3 max-w-md mx-auto">
          {[
            { id: "residential", label: "Residential" },
            { id: "commercial", label: "Commercial" },
            { id: "saved", label: saved.length > 0 ? `Saved · ${saved.length}` : "Saved" },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id !== "saved") setViewMode("swipe") }} className="flex flex-col items-center gap-1.5 px-6 py-1">
              <span style={{ color: activeTab === tab.id ? C.text : C.textMuted, fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 500 }}>{tab.label}</span>
              <div className="w-1 h-1 rounded-full" style={{ background: activeTab === tab.id ? C.accent : "transparent" }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}