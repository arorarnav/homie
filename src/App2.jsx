import { useState } from "react"
const L = [{id:1,title:"3BHK Apartment",price:18000,location:"Gomti Nagar",furnished:"Furnished",image:"https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400",owner:"Rajesh Sharma",phone:"9876543210"},{id:2,title:"2BHK Flat",price:12000,location:"Aliganj",furnished:"Semi Furnished",image:"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400",owner:"Priya Singh",phone:"9876543211"},{id:3,title:"1BHK Studio",price:8000,location:"Hazratganj",furnished:"Unfurnished",image:"https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=400",owner:"Amit Verma",phone:"9876543212"}]
function Card({l}) {
  const link = "https://wa.me/91"+l.phone+"?text=Hi I saw "+l.title+" on GharFind"
  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden">
      <img src={l.image} alt={l.title} className="w-full h-48 object-cover" />
      <div className="p-4">
        <div className="flex justify-between mb-2">
          <h2 className="font-bold text-gray-800">{l.title}</h2>
          <span className="text-green-600 font-bold">Rs.{l.price}/mo</span>
        </div>
        <p className="text-gray-500 text-sm">📍 {l.location}</p>
        <p className="text-gray-500 text-sm mb-4">🛋️ {l.furnished}</p>
        <a href={link} target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-green-500 text-white font-semibold py-2 rounded-xl">WhatsApp Owner</a>
      </div>
    </div>
  )
}
export default function App() {
  const [loc, setLoc] = useState("All")
  const [max, setMax] = useState(50000)
  const [fur, setFur] = useState("All")
  const filtered = L.filter(l => (loc==="All"||l.location===loc) && (fur==="All"||l.furnished===fur) && l.price<=max)
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600">GharFind</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">+ List Your House</button>
      </div>
      <div className="px-6 py-4 bg-white border-b flex gap-4 flex-wrap">
        <select value={loc} onChange={e => setLoc(e.target.value)} className="border rounded-xl px-3 py-2 text-sm">
          <option value="All">All Locations</option>
          <option value="Gomti Nagar">Gomti Nagar</option>
          <option value="Aliganj">Aliganj</option>
          <option value="Hazratganj">Hazratganj</option>
        </select>
        <select value={fur} onChange={e => setFur(e.target.value)} className="border rounded-xl px-3 py-2 text-sm">
          <option value="All">All Types</option>
          <option value="Furnished">Furnished</option>
          <option value="Semi Furnished">Semi Furnished</option>
          <option value="Unfurnished">Unfurnished</option>
        </select>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Max: Rs.{max}</span>
          <input type="range" min="5000" max="50000" step="1000" value={max} onChange={e => setMax(Number(e.target.value))} className="w-32" />
        </div>
      </div>
      <div className="px-6 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length > 0 ? filtered.map(l => <Card key={l.id} l={l} />) : <p className="text-gray-400 col-span-3 text-center py-20">No listings found.</p>}
      </div>
    </div>
  )
}