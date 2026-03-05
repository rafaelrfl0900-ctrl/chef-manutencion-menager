/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  orderBy, 
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { 
  ServiceRequest, 
  MaintenanceOrder, 
  Department, 
  RequestStatus 
} from './types';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Wrench, 
  PlusCircle, 
  LogOut, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  ChevronRight,
  ShieldAlert,
  Factory,
  Search,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Button = ({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline',
  size?: 'sm' | 'md' | 'lg'
}) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'hover:bg-slate-100 text-slate-600',
    outline: 'border border-slate-200 hover:bg-slate-50 text-slate-600'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };
  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )} 
      {...props} 
    />
  );
};

const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden', className)} {...props}>
    {children}
  </div>
);

const Input = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => (
  <div className="space-y-1">
    {label && <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>}
    <input 
      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
      {...props} 
    />
  </div>
);

const Select = ({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, options: { value: string, label: string }[] }) => (
  <div className="space-y-1">
    {label && <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>}
    <select 
      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
      {...props}
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

const TextArea = ({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) => (
  <div className="space-y-1">
    {label && <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>}
    <textarea 
      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px]"
      {...props} 
    />
  </div>
);

const Checkbox = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="flex items-center space-x-3 cursor-pointer group">
    <div className="relative flex items-center">
      <input 
        type="checkbox" 
        className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-slate-300 bg-slate-50 checked:bg-indigo-600 checked:border-indigo-600 transition-all"
        {...props} 
      />
      <CheckCircle2 className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 left-0.5 pointer-events-none" />
    </div>
    <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">{label}</span>
  </label>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'new-request' | 'requests' | 'orders'>('dashboard');
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Connection Test
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Firebase configuration error: client is offline.");
        }
      }
    };
    testConnection();
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    const qRequests = query(collection(db, 'serviceRequests'), orderBy('createdAt', 'desc'));
    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      setRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ServiceRequest)));
    }, (err) => console.error("Error fetching requests:", err));

    const qOrders = query(collection(db, 'maintenanceOrders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceOrder)));
    }, (err) => console.error("Error fetching orders:", err));

    return () => {
      unsubRequests();
      unsubOrders();
    };
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
            <Wrench className="w-8 h-8 text-indigo-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Chef Maintenance</h1>
            <p className="text-slate-500">Faça login para gerenciar as ordens de manutenção da fábrica.</p>
          </div>
          <Button onClick={handleLogin} className="w-full" size="lg">
            Entrar com Google
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-200 shadow-lg">
              <Factory className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900 hidden sm:block">Chef Maintenance</span>
          </div>

          <nav className="hidden md:flex items-center space-x-1">
            <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={18} />} label="Dashboard" />
            <NavButton active={view === 'requests'} onClick={() => setView('requests')} icon={<ClipboardList size={18} />} label="Solicitações" />
            <NavButton active={view === 'orders'} onClick={() => setView('orders')} icon={<Wrench size={18} />} label="Ordens de Serviço" />
          </nav>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold text-slate-900">{user.displayName}</span>
              <span className="text-xs text-slate-500">{user.email}</span>
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {view === 'dashboard' && <Dashboard requests={requests} orders={orders} setView={setView} />}
        {view === 'new-request' && <RequestForm user={user} onCancel={() => setView('dashboard')} onSuccess={() => setView('requests')} />}
        {view === 'requests' && <RequestList requests={requests} searchTerm={searchTerm} setSearchTerm={setSearchTerm} setView={setView} onStartMaintenance={(req) => setSelectedRequest(req)} />}
        {view === 'orders' && <OrderList orders={orders} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />}
        {selectedRequest && (
          <OrderForm 
            user={user} 
            request={selectedRequest} 
            onCancel={() => setSelectedRequest(null)} 
            onSuccess={() => {
              setSelectedRequest(null);
              setView('orders');
            }} 
          />
        )}
      </main>

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 flex justify-around z-30">
        <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20} />} vertical />
        <NavButton active={view === 'requests'} onClick={() => setView('requests')} icon={<ClipboardList size={20} />} vertical />
        <NavButton active={view === 'orders'} onClick={() => setView('orders')} icon={<Wrench size={20} />} vertical />
        <button 
          onClick={() => setView('new-request')}
          className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg -mt-6 border-4 border-slate-50"
        >
          <PlusCircle size={24} />
        </button>
      </div>
    </div>
  );
}

// --- Sub-components ---

function NavButton({ active, onClick, icon, label, vertical = false }: { active: boolean, onClick: () => void, icon: React.ReactNode, label?: string, vertical?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center transition-all rounded-lg",
        vertical ? "flex-col space-y-1 p-2 flex-1" : "space-x-2 px-4 py-2",
        active ? "text-indigo-600 bg-indigo-50" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
      )}
    >
      {icon}
      {label && <span className={cn("font-medium", vertical ? "text-[10px]" : "text-sm")}>{label}</span>}
    </button>
  );
}

function Dashboard({ requests, orders, setView }: { requests: ServiceRequest[], orders: MaintenanceOrder[], setView: (v: any) => void }) {
  const pending = requests.filter(r => r.status === 'pending');
  const inProgress = requests.filter(r => r.status === 'in_progress');
  const critical = requests.filter(r => r.status === 'pending' && (r.affectsSafety || r.affectsProduction));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Visão Geral</h2>
        <Button onClick={() => setView('new-request')} className="hidden sm:flex space-x-2">
          <PlusCircle size={18} />
          <span>Nova Solicitação</span>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Pendentes" 
          value={pending.length} 
          icon={<Clock className="text-amber-500" />} 
          color="amber" 
          onClick={() => setView('requests')}
        />
        <StatCard 
          label="Em Execução" 
          value={inProgress.length} 
          icon={<Wrench className="text-indigo-500" />} 
          color="indigo" 
          onClick={() => setView('orders')}
        />
        <StatCard 
          label="Críticos" 
          value={critical.length} 
          icon={<ShieldAlert className="text-red-500" />} 
          color="red" 
          onClick={() => setView('requests')}
        />
        <StatCard 
          label="Concluídos (Mês)" 
          value={requests.filter(r => r.status === 'completed').length} 
          icon={<CheckCircle2 className="text-emerald-500" />} 
          color="emerald" 
          onClick={() => setView('requests')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Critical Requests */}
        <Card className="lg:col-span-2">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Solicitações Críticas</h3>
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">Urgente</span>
          </div>
          <div className="divide-y divide-slate-100">
            {critical.length > 0 ? critical.slice(0, 5).map(req => (
              <div key={req.id} className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => setView('requests')}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">{req.equipment}</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-medium text-slate-500">{req.area}</span>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-1">{req.description}</p>
                    <div className="flex items-center space-x-3 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                      <span>{req.requesterName}</span>
                      <span>{format(new Date(req.createdAt), 'dd/MM HH:mm')}</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-600 transition-all" />
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-slate-400">Nenhuma solicitação crítica pendente.</div>
            )}
          </div>
        </Card>

        {/* Quick Actions / Info */}
        <div className="space-y-6">
          <Card className="bg-indigo-600 text-white p-6 space-y-4">
            <h3 className="font-bold text-lg">Pronto para começar?</h3>
            <p className="text-indigo-100 text-sm">Registre uma nova solicitação de serviço para a equipe de manutenção.</p>
            <Button variant="secondary" className="w-full" onClick={() => setView('new-request')}>
              Criar Solicitação
            </Button>
          </Card>

          <Card>
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Impacto na Produção</h3>
            </div>
            <div className="p-6 flex flex-col items-center justify-center space-y-4">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                  <circle 
                    cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" 
                    strokeDasharray={364}
                    strokeDashoffset={364 - (364 * (critical.length / (requests.length || 1)))}
                    className="text-red-500" 
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900">{Math.round((critical.length / (requests.length || 1)) * 100)}%</span>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Crítico</span>
                </div>
              </div>
              <p className="text-xs text-center text-slate-500">Percentual de solicitações pendentes que afetam a segurança ou produção.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, onClick }: { label: string, value: number, icon: React.ReactNode, color: string, onClick?: () => void }) {
  const colors: any = {
    amber: 'bg-amber-50 border-amber-100',
    indigo: 'bg-indigo-50 border-indigo-100',
    red: 'bg-red-50 border-red-100',
    emerald: 'bg-emerald-50 border-emerald-100'
  };
  return (
    <Card className={cn("p-5 cursor-pointer hover:scale-[1.02] transition-transform", colors[color])} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-black text-slate-900">{value}</p>
        </div>
        <div className="p-2 bg-white rounded-lg shadow-sm">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function RequestForm({ user, onCancel, onSuccess }: { user: User, onCancel: () => void, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    requesterName: user.displayName || '',
    requesterDepartment: 'Produção' as Department,
    area: '',
    equipment: '',
    description: '',
    affectsSafety: false,
    affectsProduction: false
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const now = new Date();
      await addDoc(collection(db, 'serviceRequests'), {
        ...formData,
        date: format(now, 'yyyy-MM-dd'),
        time: format(now, 'HH:mm'),
        status: 'pending',
        createdAt: now.toISOString(),
        createdBy: user.uid
      });
      onSuccess();
    } catch (error) {
      console.error("Error adding request:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" onClick={onCancel}>Voltar</Button>
        <h2 className="text-2xl font-bold text-slate-900">Nova Solicitação de Serviço</h2>
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input 
              label="Nome do Solicitante" 
              value={formData.requesterName} 
              onChange={e => setFormData({...formData, requesterName: e.target.value})} 
              required 
            />
            <Select 
              label="Setor Solicitante" 
              value={formData.requesterDepartment} 
              onChange={e => setFormData({...formData, requesterDepartment: e.target.value as Department})}
              options={[
                { value: 'Produção', label: 'Produção' },
                { value: 'Qualidade', label: 'Qualidade' },
                { value: 'Administrativo', label: 'Administrativo' },
                { value: 'Outros', label: 'Outros' }
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input 
              label="Área" 
              placeholder="Ex: Linha 02" 
              value={formData.area} 
              onChange={e => setFormData({...formData, area: e.target.value})} 
              required 
            />
            <Input 
              label="Equipamento" 
              placeholder="Ex: Envasadora" 
              value={formData.equipment} 
              onChange={e => setFormData({...formData, equipment: e.target.value})} 
              required 
            />
          </div>

          <TextArea 
            label="Descrição da Solicitação" 
            placeholder="Descreva o problema detalhadamente..." 
            value={formData.description} 
            onChange={e => setFormData({...formData, description: e.target.value})} 
            required 
          />

          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Impacto do Problema</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Checkbox 
                label="Afeta Segurança ou Meio Ambiente?" 
                checked={formData.affectsSafety} 
                onChange={e => setFormData({...formData, affectsSafety: e.target.checked})} 
              />
              <Checkbox 
                label="Afeta Produção ou Qualidade?" 
                checked={formData.affectsProduction} 
                onChange={e => setFormData({...formData, affectsProduction: e.target.checked})} 
              />
            </div>
          </div>

          <div className="pt-6 flex items-center justify-end space-x-3">
            <Button variant="outline" type="button" onClick={onCancel}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Registrar Solicitação'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function RequestList({ requests, searchTerm, setSearchTerm, setView, onStartMaintenance }: { requests: ServiceRequest[], searchTerm: string, setSearchTerm: (s: string) => void, setView: (v: any) => void, onStartMaintenance: (req: ServiceRequest) => void }) {
  const filtered = requests.filter(r => 
    r.equipment.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.requesterName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900">Solicitações de Serviço</h2>
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por equipamento, descrição..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filtered.map(req => (
          <Card key={req.id} className="p-5 hover:border-indigo-200 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-3 flex-1">
                <div className="flex items-center flex-wrap gap-2">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                    req.status === 'pending' ? "bg-amber-100 text-amber-700" : 
                    req.status === 'in_progress' ? "bg-indigo-100 text-indigo-700" : 
                    "bg-emerald-100 text-emerald-700"
                  )}>
                    {req.status === 'pending' ? 'Pendente' : req.status === 'in_progress' ? 'Em Execução' : 'Concluído'}
                  </span>
                  {(req.affectsSafety || req.affectsProduction) && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                      <AlertTriangle size={10} /> Alta Prioridade
                    </span>
                  )}
                </div>
                
                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-slate-900">{req.equipment}</h3>
                  <p className="text-sm text-slate-600">{req.description}</p>
                </div>

                <div className="flex items-center flex-wrap gap-y-2 gap-x-6 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Factory size={14} />
                    <span>{req.area} ({req.requesterDepartment})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} />
                    <span>{format(new Date(req.createdAt), "dd 'de' MMMM, HH:mm", { locale: ptBR })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <PlusCircle size={14} />
                    <span>Solicitado por {req.requesterName}</span>
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col gap-2">
                {req.status === 'pending' && (
                  <Button size="sm" onClick={() => onStartMaintenance(req)}>
                    Iniciar Manutenção
                  </Button>
                )}
                {req.status === 'in_progress' && (
                  <Button size="sm" variant="secondary" onClick={() => onStartMaintenance(req)}>
                    Finalizar / Detalhes
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
            Nenhuma solicitação encontrada.
          </div>
        )}
      </div>
    </div>
  );
}

function OrderList({ orders, searchTerm, setSearchTerm }: { orders: MaintenanceOrder[], searchTerm: string, setSearchTerm: (s: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900">Ordens de Serviço</h2>
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por OS, equipamento..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {orders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
            Nenhuma ordem de serviço registrada ainda.
          </div>
        ) : (
          orders.map(order => (
            <Card key={order.id} className="p-5">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">OS #{order.osNumber}</span>
                    <span className="text-xs text-slate-400">{format(new Date(order.date), 'dd/MM/yyyy')}</span>
                  </div>
                  <h3 className="font-bold text-lg text-slate-900">{order.equipment}</h3>
                  <p className="text-sm text-slate-600">{order.defectDescription}</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function OrderForm({ user, request, onCancel, onSuccess }: { user: User, request: ServiceRequest, onCancel: () => void, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    osNumber: request.osNumber || `OS-${Date.now().toString().slice(-6)}`,
    date: format(new Date(), 'yyyy-MM-dd'),
    requester: request.requesterName,
    equipment: request.equipment,
    department: request.requesterDepartment,
    urgency: (request.affectsSafety || request.affectsProduction) ? 'Alta' : 'Normal',
    defectDescription: request.description,
    services: [{ date: format(new Date(), 'yyyy-MM-dd'), startTime: '', endTime: '', activity: '', responsible: user.displayName || '' }],
    partsUsed: [{ initialQty: 0, usedQty: 0, finalQty: 0, description: '' }],
    closure: { date: format(new Date(), 'yyyy-MM-dd'), requesterSignature: '', observations: '' },
    hygiene: { date: format(new Date(), 'yyyy-MM-dd'), department: request.requesterDepartment, equipment: request.equipment, qualityRelease: '' }
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'maintenanceOrders'), {
        ...formData,
        requestId: request.id,
        createdAt: new Date().toISOString(),
        createdBy: user.uid
      });
      
      await updateDoc(doc(db, 'serviceRequests', request.id), {
        status: 'completed',
        osNumber: formData.osNumber
      });

      onSuccess();
    } catch (error) {
      console.error("Error adding order:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 sticky top-0 bg-white z-10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Ordem de Serviço de Manutenção</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-2">
            <PlusCircle className="rotate-45" size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Número OS" value={formData.osNumber} readOnly />
            <Input label="Data" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            <Input label="Solicitante" value={formData.requester} onChange={e => setFormData({...formData, requester: e.target.value})} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Equipamento" value={formData.equipment} onChange={e => setFormData({...formData, equipment: e.target.value})} />
            <Input label="Setor" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
            <Input label="Urgência" value={formData.urgency} onChange={e => setFormData({...formData, urgency: e.target.value})} />
          </div>

          <TextArea label="Defeito ou Ocorrência" value={formData.defectDescription} onChange={e => setFormData({...formData, defectDescription: e.target.value})} />

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900 border-b pb-2">Serviços Executados</h4>
            {formData.services.map((service, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
                <Input label="Data" type="date" value={service.date} onChange={e => {
                  const newServices = [...formData.services];
                  newServices[idx].date = e.target.value;
                  setFormData({...formData, services: newServices});
                }} />
                <Input label="Início" type="time" value={service.startTime} onChange={e => {
                  const newServices = [...formData.services];
                  newServices[idx].startTime = e.target.value;
                  setFormData({...formData, services: newServices});
                }} />
                <Input label="Término" type="time" value={service.endTime} onChange={e => {
                  const newServices = [...formData.services];
                  newServices[idx].endTime = e.target.value;
                  setFormData({...formData, services: newServices});
                }} />
                <Input label="Atividade" value={service.activity} onChange={e => {
                  const newServices = [...formData.services];
                  newServices[idx].activity = e.target.value;
                  setFormData({...formData, services: newServices});
                }} />
                <Input label="Responsável" value={service.responsible} onChange={e => {
                  const newServices = [...formData.services];
                  newServices[idx].responsible = e.target.value;
                  setFormData({...formData, services: newServices});
                }} />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900 border-b pb-2">Peças / Materiais Utilizados</h4>
            {formData.partsUsed.map((part, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                <Input label="Qtd Inicial" type="number" value={part.initialQty} onChange={e => {
                  const newParts = [...formData.partsUsed];
                  newParts[idx].initialQty = Number(e.target.value);
                  setFormData({...formData, partsUsed: newParts});
                }} />
                <Input label="Qtd Usada" type="number" value={part.usedQty} onChange={e => {
                  const newParts = [...formData.partsUsed];
                  newParts[idx].usedQty = Number(e.target.value);
                  setFormData({...formData, partsUsed: newParts});
                }} />
                <Input label="Qtd Final" type="number" value={part.finalQty} onChange={e => {
                  const newParts = [...formData.partsUsed];
                  newParts[idx].finalQty = Number(e.target.value);
                  setFormData({...formData, partsUsed: newParts});
                }} />
                <Input label="Descrição" value={part.description} onChange={e => {
                  const newParts = [...formData.partsUsed];
                  newParts[idx].description = e.target.value;
                  setFormData({...formData, partsUsed: newParts});
                }} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-900 border-b pb-2">Higienização Pós-Manutenção</h4>
              <Input label="Liberação da Qualidade" value={formData.hygiene.qualityRelease} onChange={e => setFormData({...formData, hygiene: {...formData.hygiene, qualityRelease: e.target.value}})} />
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-900 border-b pb-2">Fechamento</h4>
              <TextArea label="Observações" value={formData.closure.observations} onChange={e => setFormData({...formData, closure: {...formData.closure, observations: e.target.value}})} />
            </div>
          </div>

          <div className="pt-6 flex items-center justify-end space-x-3 border-t">
            <Button variant="outline" type="button" onClick={onCancel}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Finalizar OS'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
