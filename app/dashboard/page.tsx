"use client"

import { useState } from "react"
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from "recharts"
import { FileText, Calendar, Scale, AlertTriangle, MapPin } from "lucide-react"
import { ArgentinaMap } from "@/components/dashboard/argentina-map"
import { CasesByYearChart } from "@/components/dashboard/cases-by-year-chart"
import { StatusDistributionChart } from "@/components/dashboard/status-distribution-chart"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"

const DATA_BARRAS = [
  { year: "2020", casos: 12 },
  { year: "2021", casos: 18 },
  { year: "2022", casos: 15 },
  { year: "2023", casos: 28 },
  { year: "2024", casos: 42 },
]

const DATA_DONA = [
  { name: "En Investigación", value: 12, color: "#64748B" },
  { name: "Juicio Oral", value: 8, color: "#94A3B8" },
  { name: "Sentencia Firme", value: 15, color: "#CBD5E1" },
  { name: "Archivado", value: 5, color: "#E2E8F0" },
]

interface KPICardProps {
  title: string
  value: string
  subtext: string
  icon: any
  color: string
}

const KPICard = ({ title, value, subtext, icon: Icon, color }: KPICardProps) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{value}</h3>
      </div>
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5 text-current opacity-80" />
      </div>
    </div>
    <p className="text-xs text-slate-400 font-medium">{subtext}</p>
  </div>
)

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 font-sans text-slate-800">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-2">
          Dashboard Estadístico
        </h1>
        <p className="text-slate-500">
          Monitoreo en tiempo real de la base de datos de víctimas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard 
          title="Total de Casos" 
          value="142" 
          subtext="+12% vs año anterior" 
          icon={FileText} 
          color="bg-slate-100 text-slate-600" 
        />
        <KPICard 
          title="Casos Activos" 
          value="38" 
          subtext="Requieren seguimiento" 
          icon={Calendar} 
          color="bg-slate-100 text-slate-600" 
        />
        <KPICard 
          title="Sin Condena" 
          value="27" 
          subtext="Pendientes de resolución" 
          icon={Scale} 
          color="bg-slate-100 text-slate-600" 
        />
        <KPICard 
          title="Urgentes" 
          value="5" 
          subtext="Acción requerida hoy" 
          icon={AlertTriangle} 
          color="bg-slate-100 text-slate-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-7 space-y-6">
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Evolución Anual</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={DATA_BARRAS} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="year" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#64748B", fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#64748B", fontSize: 12 }} 
                  />
                  <Tooltip cursor={{ fill: "#F1F5F9" }} />
                  <Bar dataKey="casos" fill="#64748B" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 w-full">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Estado Procesal</h3>
              <p className="text-sm text-slate-500 mb-6">Distribución actual de los expedientes.</p>
              
              <div className="space-y-3">
                {DATA_DONA.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-600">{item.name}</span>
                    </div>
                    <span className="font-semibold text-slate-900">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-[200px] h-[200px] flex-shrink-0 relative">
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={DATA_DONA}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {DATA_DONA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-2xl font-bold text-slate-800">100%</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest">Total</span>
              </div>
            </div>
          </div>

        </div>

        <div className="lg:col-span-5">
          <ArgentinaMap />
        </div>

      </div>
    </div>
  )
}
