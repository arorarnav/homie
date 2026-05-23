import { useState } from "react"
const L = [
  {id:1,title:"3BHK Apartment",price:18000,location:"Gomti Nagar",furnished:"Furnished",image:"https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",phone:"9876543210",beds:3,baths:2,sqft:1450},
  {id:2,title:"2BHK Flat",price:12000,location:"Aliganj",furnished:"Semi Furnished",image:"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",phone:"9876543211",beds:2,baths:2,sqft:950},
  {id:3,title:"1BHK Studio",price:8000,location:"Hazratganj",furnished:"Unfurnished",image:"https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800",phone:"9876543212",beds:1,baths:1,sqft:550},
  {id:4,title:"3BHK Penthouse",price:35000,location:"Gomti Nagar",furnished:"Furnished",image:"https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",phone:"9876543213",beds:3,baths:3,sqft:2100},
  {id:5,title:"2BHK Independent",price:15000,location:"Hazratganj",furnished:"Furnished",image:"https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800",phone:"9876543214",beds:2,baths:1,sqft:1100},
  {id:6,title:"1BHK Flat",price:7000,location:"Aliganj",furnished:"Unfurnished",image:"https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800",phone:"9876543215",beds:1,baths:1,sqft:480}
]

function Card({l}) {
  const badge = l.furnished==="Furnished" ? "bg-emerald-100 text-emerald-700" : l.furnished==="Semi Furnished" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
  function openWA() {
    window.open("https://wa.me/91"+l.phone+"?text=Hi, I saw "+l.title+" in "+l.location+" on GharFind. Still available?")
  }
  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer group border border-gray-100 hover:-translate-y-1">
      <div className="relative overflow-hidden h-52">
        <img src={l.image} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute top-3 left-3">
          <span className={"text-xs font-semibold px-3 py-1 rounded-full " + badge}>{l.furnished}</span>
        </div>
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1">
          <span className="text-sm font-bold text-gray-800">₹{l.price.toLocaleString()}<span className="text-gray-400 font-normal">/mo</span></span>
        </div>
      </div>
      <div className="p-5">
        <h2 className="font-bold text-gray-900 text-lg mb-1">{l.title}</h2>
        <p className="text-gray-400 text-sm mb-4">📍 {l.location}</p>
        <div className="flex gap-4 text-sm text-gray-500 mb-5 border-t border-gray-50 pt-4">
          <span>🛏 {l.beds} Beds</span>
          <span>🚿 {l.baths} Baths</span>
          <span>📐 {l.sqft} sqft</span>
        </div>
        <button onClick={openWA} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-2xl transition-colors duration-200 text-sm">
          WhatsApp Owner
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [loc, setLoc] = useState("All")
  const [max, setMax] = useState(50000)
  const [fur, setFur] = useState("All")
  const [search, setSearch] = useState("")
  const filtered = L.filter(l =>
    (loc==="All"||l.location===loc) &&
    (fur==="All"||l.furnished===fur) &&
    l.price<=max &&
    (search===""||l.title.toLowerCase().includes(search.toLowerCase())||l.location.toLowerCase().includes(search.toLowerCase()))
  )
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Ghar<span className="text-blue-600">Find</span></h1>
          <p className="text-xs text-gray-400">No brokers. No BS.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl text-sm font-semibold transition-colors shadow-lg shadow-blue-200">
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
      <div className="px-6 py-8 max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length > 0 ? filtered.map(l => <Card key={l.id} l={l} />) : (
          <div className="col-span-3 text-center py-24">
            <p className="text-5xl mb-4">🏠</p>
            <p className="text-gray-400 font-medium">No listings match your filters.</p>
          </div>
        )}
      </div>
      <div className="text-center py-8 text-gray-300 text-xs border-t border-gray-100">
        GharFind — Lucknow's no-broker rental platform
      </div>
    </div>
  )
}