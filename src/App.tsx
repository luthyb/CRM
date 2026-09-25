import { ChangeEvent, FormEvent, useMemo, useState } from 'react'

type Prospect = {
  id: number
  company: string
  owner: string
  revenue: number
  clientValue?: number
  weeklyMediaInvestment?: number
  sector: string
  content: boolean
  media: boolean
  createdAt: string
}

type ProspectForm = Omit<Prospect, 'id' | 'createdAt'>
type Lead = {
  id: number
  company: string
  email: string
  phone: string
  sector: string
  location: string
  source: string
  owner: string
  nextContact: string
  notes: string
  createdAt: string
}

type LeadForm = Omit<Lead, 'id' | 'createdAt'>
type FollowUp = {
  id: number
  leadId: number
  company: string
  email: string
  phone: string
  owner: string
  action: string
  nextContact: string
  createdAt: string
}
type UserProfile = {
  name: string
  role: string
  email: string
  status: string
  timezone: string
  photo: string
}
type UserAccount = UserProfile & { id: number; password: string }
type AuthMode = 'login' | 'register'
type ReportKind = 'companies' | 'leads'
type CompanyChange = {
  id: number
  companyId: number
  company: string
  field: string
  previousValue: string
  newValue: string
  changedAt: string
}
type NavPage = 'overview' | 'companies' | 'leads' | 'pipeline' | 'followups' | 'reports' | 'settings'

const pageInfo: Record<NavPage, { label: string; group: string; description: string }> = {
  overview: { label: 'Visão geral', group: 'Operação', description: 'Aqui está o panorama dos seus potenciais clientes.' },
  companies: { label: 'Empresas', group: 'Operação', description: 'Gerencie e qualifique seus potenciais clientes.' },
  leads: { label: 'Leads', group: 'Operação', description: 'Cadastre e organize novos potenciais clientes.' },
  pipeline: { label: 'Pipeline', group: 'Operação', description: 'Acompanhe as oportunidades por etapa.' },
  followups: { label: 'Follow-ups', group: 'Operação', description: 'Organize os próximos contatos da sua operação.' },
  reports: { label: 'Relatórios', group: 'Gestão', description: 'Consulte os indicadores da sua operação.' },
  settings: { label: 'Configurações', group: 'Gestão', description: 'Ajuste as preferências do workspace.' },
}

const initialProspects: Prospect[] = [
  { id: 1, company: 'Clínica Horizonte', owner: 'Marina Alves', revenue: 1800000, sector: 'Saúde', content: true, media: true, createdAt: '2026-09-21' },
  { id: 2, company: 'Casa Nativa', owner: 'Rafael Moura', revenue: 920000, sector: 'Varejo', content: false, media: true, createdAt: '2026-09-19' },
  { id: 3, company: 'Lume Arquitetura', owner: 'Bianca Reis', revenue: 640000, sector: 'Serviços', content: true, media: false, createdAt: '2026-09-17' },
  { id: 4, company: 'Atlas Educação', owner: 'Diego Nunes', revenue: 2400000, sector: 'Educação', content: true, media: true, createdAt: '2026-09-14' },
  { id: 5, company: 'Vitta Pet', owner: 'Carolina Freire', revenue: 410000, sector: 'Pet', content: false, media: false, createdAt: '2026-09-12' },
]

const emptyForm: ProspectForm = { company: '', owner: '', revenue: 0, clientValue: 0, weeklyMediaInvestment: 0, sector: '', content: false, media: false }
const emptyLeadForm: LeadForm = { company: '', email: '', phone: '', sector: '', location: '', source: '', owner: '', nextContact: '', notes: '' }
const defaultProfile: UserProfile = { name: 'Lucas Silva', role: 'Administrador', email: '', status: 'Disponível', timezone: 'Brasília (GMT-3)', photo: '' }

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
const initials = (name: string) => name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()

function AuthScreen({ mode, name, email, password, error, message, hasUsers, onModeChange, onSubmit, onNameChange, onEmailChange, onPasswordChange }: { mode: AuthMode; name: string; email: string; password: string; error: string; message: string; hasUsers: boolean; onModeChange: (mode: AuthMode) => void; onSubmit: (event: FormEvent) => void; onNameChange: (value: string) => void; onEmailChange: (value: string) => void; onPasswordChange: (value: string) => void }) {
  const isRegister = mode === 'register'
  return <main className="auth-shell"><section className="auth-card"><div className="brand auth-brand"><span className="brand-mark">N</span><span>NewType <span className="brand-dot">CRM</span></span></div><p className="eyebrow">WORKSPACE PRINCIPAL</p><h1>{isRegister ? 'Crie sua conta' : 'Bem-vindo de volta'}</h1><p className="auth-subtitle">{isRegister ? 'Cadastre seu acesso para começar a organizar sua operação.' : 'Entre para acessar seu CRM e continuar sua operação.'}</p><form onSubmit={onSubmit}>{isRegister && <label>Nome completo<input required value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Ex.: Lucas Silva" /></label>}<label>E-mail<input required type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="voce@empresa.com" /></label><label>Senha<input required type="password" minLength={6} value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Mínimo de 6 caracteres" /></label>{message && <p className="auth-message">{message}</p>}{error && <p className="auth-error">{error}</p>}<button className="primary-button auth-submit" type="submit">{isRegister ? 'Criar conta' : 'Entrar'}</button></form><button className="auth-switch" type="button" onClick={() => onModeChange(isRegister ? 'login' : 'register')}>{isRegister ? 'Já tenho uma conta' : hasUsers ? 'Criar uma nova conta' : 'Ainda não tenho uma conta'}</button><small className="auth-note">Protótipo local: os dados de acesso ficam armazenados apenas neste navegador.</small></section></main>
}

function App() {
  const [prospects, setProspects] = useState<Prospect[]>(() => {
    const saved = localStorage.getItem('clareza-prospects')
    return saved ? JSON.parse(saved) : initialProspects
  })
  const [query, setQuery] = useState('')
  const [sectorFilter, setSectorFilter] = useState('Todos os nichos')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ProspectForm>(emptyForm)
  const [activePage, setActivePage] = useState<NavPage>('overview')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [leads, setLeads] = useState<Lead[]>(() => {
    const saved = localStorage.getItem('clareza-leads')
    return saved ? JSON.parse(saved) : []
  })
  const [leadForm, setLeadForm] = useState<LeadForm>(emptyLeadForm)
  const [leadQuery, setLeadQuery] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [followUps, setFollowUps] = useState<FollowUp[]>(() => {
    const saved = localStorage.getItem('clareza-followups')
    return saved ? JSON.parse(saved) : []
  })
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('clareza-profile')
    return saved ? JSON.parse(saved) : defaultProfile
  })
  const [profileDraft, setProfileDraft] = useState<UserProfile>(profile)
  const [profileOpen, setProfileOpen] = useState(false)
  const [workspaceName, setWorkspaceName] = useState(() => localStorage.getItem('newtype-workspace-name') || 'Agência Aurora')
  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('clareza-users')
    return saved ? JSON.parse(saved) : []
  })
  const [sessionUserId, setSessionUserId] = useState<number | null>(() => {
    const saved = localStorage.getItem('clareza-session')
    return saved ? Number(saved) : null
  })
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Colaborador', password: '' })
  const [newUserPhoto, setNewUserPhoto] = useState('')
  const [financialCompanyId, setFinancialCompanyId] = useState<number | null>(null)
  const [financialValue, setFinancialValue] = useState(0)
  const [financialMedia, setFinancialMedia] = useState(0)
  const [companyChanges, setCompanyChanges] = useState<CompanyChange[]>(() => {
    const saved = localStorage.getItem('newtype-company-changes')
    return saved ? JSON.parse(saved) : []
  })
  const [financeSavedAt, setFinanceSavedAt] = useState<number | null>(null)
  const [accountPassword, setAccountPassword] = useState('')

  const saveProspects = (next: Prospect[]) => {
    setProspects(next)
    localStorage.setItem('clareza-prospects', JSON.stringify(next))
  }

  const saveCompanyChanges = (next: CompanyChange[]) => {
    setCompanyChanges(next)
    localStorage.setItem('newtype-company-changes', JSON.stringify(next))
  }

  const recordCompanyChanges = (before: Prospect, after: Prospect) => {
    const fields: Array<[keyof Prospect, string, (value: unknown) => string]> = [
      ['company', 'Nome da empresa', (value) => String(value)],
      ['owner', 'Dono', (value) => String(value)],
      ['revenue', 'Faturamento anual', (value) => formatCurrency(Number(value) || 0)],
      ['clientValue', 'Valor que paga', (value) => formatCurrency(Number(value) || 0)],
      ['weeklyMediaInvestment', 'Mídia semanal', (value) => formatCurrency(Number(value) || 0)],
      ['sector', 'Nicho / setor', (value) => String(value)],
      ['content', 'Produz conteúdo?', (value) => value ? 'Sim' : 'Não'],
      ['media', 'Compra mídia?', (value) => value ? 'Sim' : 'Não'],
    ]
    const changes = fields.filter(([field]) => before[field] !== after[field]).map(([field, label, format]) => ({ id: Date.now() + Math.random(), companyId: after.id, company: after.company, field: label, previousValue: format(before[field]), newValue: format(after[field]), changedAt: new Date().toISOString() }))
    if (changes.length > 0) saveCompanyChanges([...changes, ...companyChanges])
  }

  const exportCsv = () => {
    const header = ['Nome da Empresa', 'Nome do Dono', 'Faturamento anual', 'Nicho/Setor', 'Produz conteúdo?', 'Compra mídia?']
    const rows = filteredProspects.map((prospect) => [
      prospect.company,
      prospect.owner,
      String(prospect.revenue),
      prospect.sector,
      prospect.content ? 'Sim' : 'Não',
      prospect.media ? 'Sim' : 'Não',
    ])
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(';')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }))
    link.download = 'empresas-clareza.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const reportData = (kind: ReportKind) => {
    if (kind === 'companies') {
      return {
        title: 'Relatório de empresas',
        headers: ['Nome da Empresa', 'Nome do Dono', 'Faturamento anual', 'Valor pago', 'Mídia semanal', 'Nicho/Setor', 'Produz conteúdo?', 'Compra mídia?'],
        rows: prospects.map((prospect) => [prospect.company, prospect.owner, formatCurrency(prospect.revenue), formatCurrency(prospect.clientValue || 0), formatCurrency(prospect.weeklyMediaInvestment || 0), prospect.sector, prospect.content ? 'Sim' : 'Não', prospect.media ? 'Sim' : 'Não']),
      }
    }
    return {
      title: 'Relatório de leads',
      headers: ['Empresa', 'E-mail', 'Telefone', 'Nicho/Setor', 'Cidade/Estado', 'Origem', 'Responsável', 'Próximo contato', 'Observações'],
      rows: leads.map((lead) => [lead.company, lead.email, lead.phone, lead.sector, lead.location, lead.source || 'Não informado', lead.owner || 'Não definido', lead.nextContact || 'Não agendado', lead.notes || '']),
    }
  }

  const downloadReportCsv = (kind: ReportKind) => {
    const report = reportData(kind)
    const csv = [report.headers, ...report.rows].map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(';')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }))
    link.download = `${kind === 'companies' ? 'relatorio-empresas' : 'relatorio-leads'}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const downloadReportExcel = (kind: ReportKind) => {
    const report = reportData(kind)
    const cells = (row: string[]) => row.map((value) => `<td>${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')
    const html = `<table><thead><tr>${cells(report.headers)}</tr></thead><tbody>${report.rows.map((row) => `<tr>${cells(row)}</tr>`).join('')}</tbody></table>`
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([`<html><head><meta charset="utf-8"></head><body>${html}</body></html>`], { type: 'application/vnd.ms-excel' }))
    link.download = `${kind === 'companies' ? 'relatorio-empresas' : 'relatorio-leads'}.xls`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const printReport = (kind: ReportKind) => {
    const report = reportData(kind)
    const popup = window.open('', '_blank', 'width=1100,height=800')
    if (!popup) return
    const cells = (row: string[]) => row.map((value) => `<td>${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')
    popup.document.write(`<html><head><title>${report.title}</title><style>body{font-family:Arial,sans-serif;color:#243331;padding:28px}h1{font-size:22px}p{color:#718179;font-size:12px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #dce5dc;padding:8px;text-align:left}th{background:#edf3ed}</style></head><body><h1>${report.title}</h1><p>Gerado em ${new Intl.DateTimeFormat('pt-BR').format(new Date())}</p><table><thead><tr>${cells(report.headers)}</tr></thead><tbody>${report.rows.map((row) => `<tr>${cells(row)}</tr>`).join('')}</tbody></table></body></html>`)
    popup.document.close()
    popup.focus()
    popup.print()
  }

  const companyReportData = (company: Prospect) => {
    const changes = companyChanges.filter((change) => change.companyId === company.id)
    return {
      title: `Relatório - ${company.company}`,
      headers: ['Empresa', 'Dono', 'Faturamento anual', 'Valor pago', 'Mídia semanal', 'Nicho/Setor', 'Conteúdo', 'Compra mídia'],
      rows: [[company.company, company.owner, formatCurrency(company.revenue), formatCurrency(company.clientValue || 0), formatCurrency(company.weeklyMediaInvestment || 0), company.sector, company.content ? 'Sim' : 'Não', company.media ? 'Sim' : 'Não']],
      changes,
    }
  }

  const downloadCompanyReport = (company: Prospect, format: 'csv' | 'excel' | 'pdf') => {
    const report = companyReportData(company)
    const logRows = report.changes.map((change) => [change.field, change.previousValue, change.newValue, new Intl.DateTimeFormat('pt-BR').format(new Date(change.changedAt))])
    if (format === 'csv') {
      const rows = [report.headers, ...report.rows, [], ['Histórico de alterações', 'Valor anterior', 'Valor novo', 'Data'], ...logRows]
      const csv = rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(';')).join('\n')
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }))
      link.download = `relatorio-${company.company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
      return
    }
    const cells = (row: string[]) => row.map((value) => `<td>${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')
    const tables = `<h2>Dados atuais</h2><table><thead><tr>${cells(report.headers)}</tr></thead><tbody>${report.rows.map((row) => `<tr>${cells(row)}</tr>`).join('')}</tbody></table><h2>Histórico de alterações</h2><table><thead><tr>${cells(['Campo', 'Valor anterior', 'Valor novo', 'Data'])}</tr></thead><tbody>${logRows.map((row) => `<tr>${cells(row)}</tr>`).join('')}</tbody></table>`
    if (format === 'excel') {
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([`<html><head><meta charset="utf-8"></head><body>${tables}</body></html>`], { type: 'application/vnd.ms-excel' }))
      link.download = `relatorio-${company.company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xls`
      link.click()
      URL.revokeObjectURL(link.href)
      return
    }
    const popup = window.open('', '_blank', 'width=1100,height=800')
    if (!popup) return
    popup.document.write(`<html><head><title>${report.title}</title><style>body{font-family:Arial,sans-serif;color:#243331;padding:28px}h1{font-size:22px}h2{font-size:15px;margin-top:28px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #dce5dc;padding:8px;text-align:left}th{background:#edf3ed}</style></head><body><h1>${report.title}</h1>${tables}</body></html>`)
    popup.document.close()
    popup.focus()
    popup.print()
  }

  const sectors = [...new Set(prospects.map((prospect) => prospect.sector))].sort()
  const filteredProspects = useMemo(() => prospects.filter((prospect) => {
    const searchable = `${prospect.company} ${prospect.owner} ${prospect.sector}`.toLowerCase()
    return searchable.includes(query.toLowerCase()) && (sectorFilter === 'Todos os nichos' || prospect.sector === sectorFilter)
  }), [prospects, query, sectorFilter])

  const totalRevenue = prospects.reduce((sum, prospect) => sum + prospect.revenue, 0)
  const mediaReady = prospects.filter((prospect) => prospect.media).length
  const contentReady = prospects.filter((prospect) => prospect.content).length

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setConfirmDelete(false)
    setDrawerOpen(true)
  }

  const openEdit = (prospect: Prospect) => {
    setEditingId(prospect.id)
    setForm({ company: prospect.company, owner: prospect.owner, revenue: prospect.revenue, clientValue: prospect.clientValue || 0, weeklyMediaInvestment: prospect.weeklyMediaInvestment || 0, sector: prospect.sector, content: prospect.content, media: prospect.media })
    setConfirmDelete(false)
    setDrawerOpen(true)
  }

  const deleteProspect = () => {
    if (!editingId) return
    saveProspects(prospects.filter((prospect) => prospect.id !== editingId))
    setConfirmDelete(false)
    setDrawerOpen(false)
    setEditingId(null)
  }

  const saveLeads = (next: Lead[]) => {
    setLeads(next)
    localStorage.setItem('clareza-leads', JSON.stringify(next))
  }

  const handleLeadSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!leadForm.company.trim() || !leadForm.email.trim() || !leadForm.phone.trim() || !leadForm.sector.trim() || !leadForm.location.trim()) return
    saveLeads([{ ...leadForm, id: Date.now(), createdAt: new Date().toISOString() }, ...leads])
    setLeadForm(emptyLeadForm)
  }

  const deleteLead = (id: number) => {
    saveLeads(leads.filter((lead) => lead.id !== id))
  }

  const saveFollowUps = (next: FollowUp[]) => {
    setFollowUps(next)
    localStorage.setItem('clareza-followups', JSON.stringify(next))
  }

  const completePipelineAction = (lead: Lead) => {
    const action = lead.notes || 'Realizar contato de qualificação'
    saveLeads(leads.map((item) => item.id === lead.id ? { ...item, nextContact: '' } : item))
    saveFollowUps([{ id: Date.now(), leadId: lead.id, company: lead.company, email: lead.email, phone: lead.phone, owner: lead.owner, action, nextContact: '', createdAt: new Date().toISOString() }, ...followUps])
    navigateTo('followups')
  }

  const scheduleFollowUp = (followUpId: number, nextContact: string) => {
    saveFollowUps(followUps.map((followUp) => followUp.id === followUpId ? { ...followUp, nextContact } : followUp))
  }

  const openProfile = () => {
    setProfileDraft(profile)
    setNotificationsOpen(false)
    setProfileOpen(true)
  }

  const saveProfile = (event: FormEvent) => {
    event.preventDefault()
    const next = { ...profileDraft, name: profileDraft.name.trim() || defaultProfile.name }
    setProfile(next)
    localStorage.setItem('clareza-profile', JSON.stringify(next))
    if (sessionUserId) saveUsers(users.map((user) => user.id === sessionUserId ? { ...user, name: next.name, role: next.role, email: next.email, status: next.status, timezone: next.timezone, photo: next.photo } : user))
    setProfileOpen(false)
  }

  const handleProfilePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setProfileDraft({ ...profileDraft, photo: String(reader.result) })
    reader.readAsDataURL(file)
  }

  const handleNewUserPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setNewUserPhoto(String(reader.result))
    reader.readAsDataURL(file)
  }

  const saveUsers = (next: UserAccount[]) => {
    setUsers(next)
    localStorage.setItem('clareza-users', JSON.stringify(next))
  }

  const startSession = (user: UserAccount) => {
    setSessionUserId(user.id)
    localStorage.setItem('clareza-session', String(user.id))
    setProfile({ name: user.name, role: user.role, email: user.email, status: user.status, timezone: user.timezone, photo: user.photo })
    setProfileDraft({ name: user.name, role: user.role, email: user.email, status: user.status, timezone: user.timezone, photo: user.photo })
    setAuthEmail('')
    setAuthPassword('')
    setAuthError('')
  }

  const handleAuthSubmit = (event: FormEvent) => {
    event.preventDefault()
    const email = authEmail.trim().toLowerCase()
    if (!email || !authPassword) return
    if (authMode === 'register') {
      if (!authName.trim()) {
        setAuthError('Informe seu nome para criar a conta.')
        return
      }
      if (users.some((user) => user.email.toLowerCase() === email)) {
        setAuthError('Já existe uma conta com este e-mail.')
        return
      }
      const user: UserAccount = { id: Date.now(), name: authName.trim(), role: 'Administrador', email, password: authPassword, status: 'Disponível', timezone: 'Brasília (GMT-3)', photo: '' }
      saveUsers([...users, user])
      setAuthMode('login')
      setAuthName('')
      setAuthPassword('')
      setAuthError('')
      setAuthMessage('Conta criada. Entre com seu e-mail e senha.')
      return
    }
    const user = users.find((item) => item.email.toLowerCase() === email && item.password === authPassword)
    if (!user) {
      setAuthError('E-mail ou senha inválidos.')
      setAuthMessage('')
      return
    }
    startSession(user)
  }

  const logout = () => {
    setSessionUserId(null)
    localStorage.removeItem('clareza-session')
    setAuthMode('login')
  }

  const addUser = (event: FormEvent) => {
    event.preventDefault()
    const email = newUser.email.trim().toLowerCase()
    if (!newUser.name.trim() || !email || !newUser.password) return
    if (users.some((user) => user.email.toLowerCase() === email)) return
    saveUsers([...users, { id: Date.now(), name: newUser.name.trim(), role: newUser.role, email, password: newUser.password, status: 'Disponível', timezone: 'Brasília (GMT-3)', photo: newUserPhoto }])
    setNewUser({ name: '', email: '', role: 'Colaborador', password: '' })
    setNewUserPhoto('')
  }

  const deleteUser = (userId: number) => {
    const currentUser = users.find((user) => user.id === sessionUserId)
    const user = users.find((item) => item.id === userId)
    if (!currentUser || !user || currentUser.email.toLowerCase() !== 'lucasthyagootk@gmail.com' || user.id === sessionUserId) return
    if (!window.confirm(`Excluir o usuário ${user.name}?`)) return
    saveUsers(users.filter((item) => item.id !== userId))
  }

  const updateAccount = (event: FormEvent) => {
    event.preventDefault()
    if (!sessionUserId) return
    const nextEmail = profileDraft.email.trim().toLowerCase()
    if (!nextEmail) return
    const nextUsers = users.map((user) => user.id === sessionUserId ? { ...user, name: profileDraft.name.trim() || user.name, role: profileDraft.role, email: nextEmail, status: profileDraft.status, timezone: profileDraft.timezone, photo: profileDraft.photo, password: accountPassword || user.password } : user)
    saveUsers(nextUsers)
    setProfile({ ...profileDraft, email: nextEmail })
    setAccountPassword('')
  }

  const saveWorkspaceName = (event: FormEvent) => {
    event.preventDefault()
    const nextName = workspaceName.trim() || 'Agência Aurora'
    setWorkspaceName(nextName)
    localStorage.setItem('newtype-workspace-name', nextName)
  }

  const saveCompanyFinance = (event: FormEvent) => {
    event.preventDefault()
    if (!financialCompanyId) return
    const current = prospects.find((prospect) => prospect.id === financialCompanyId)
    const updated = prospects.map((prospect) => prospect.id === financialCompanyId ? { ...prospect, clientValue: financialValue, weeklyMediaInvestment: financialMedia } : prospect)
    saveProspects(updated)
    const nextCompany = updated.find((prospect) => prospect.id === financialCompanyId)
    if (current && nextCompany) recordCompanyChanges(current, nextCompany)
    setFinanceSavedAt(Date.now())
  }

  const selectFinancialCompany = (id: number) => {
    const prospect = prospects.find((item) => item.id === id)
    setFinancialCompanyId(id)
    setFinancialValue(prospect?.clientValue || 0)
    setFinancialMedia(prospect?.weeklyMediaInvestment || 0)
  }

  const visibleLeads = leads.filter((lead) => `${lead.company} ${lead.email} ${lead.phone} ${lead.sector} ${lead.location}`.toLowerCase().includes(leadQuery.toLowerCase()))
  const today = new Date().toISOString().slice(0, 10)
  const dueLeads = leads.filter((lead) => lead.nextContact && lead.nextContact <= today)
  const notifications = dueLeads.map((lead) => ({ id: lead.id, title: `Contatar ${lead.company}`, detail: lead.nextContact === today ? 'Contato agendado para hoje' : 'Contato atrasado' }))
  const pipelineLeads = leads.filter((lead) => lead.nextContact)
  const selectedFinancialCompany = prospects.find((prospect) => prospect.id === financialCompanyId)
  const selectedCompanyChanges = companyChanges.filter((change) => change.companyId === financialCompanyId)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.company.trim() || !form.owner.trim() || !form.sector.trim()) return
    if (editingId) {
      const current = prospects.find((prospect) => prospect.id === editingId)
      const updated = prospects.map((prospect) => prospect.id === editingId ? { ...prospect, ...form } : prospect)
      saveProspects(updated)
      const nextCompany = updated.find((prospect) => prospect.id === editingId)
      if (current && nextCompany) recordCompanyChanges(current, nextCompany)
    } else {
      saveProspects([{ ...form, id: Date.now(), createdAt: new Date().toISOString() }, ...prospects])
    }
    setDrawerOpen(false)
  }

  const navigateTo = (page: NavPage) => {
    setActivePage(page)
    setDrawerOpen(false)
    setNotificationsOpen(false)
    setProfileOpen(false)
  }

  const currentPage = pageInfo[activePage]
  const currentUser = users.find((user) => user.id === sessionUserId)

  if (!currentUser) return <AuthScreen mode={authMode} name={authName} email={authEmail} password={authPassword} error={authError} message={authMessage} hasUsers={users.length > 0} onModeChange={(mode) => { setAuthMode(mode); setAuthError(''); setAuthMessage('') }} onSubmit={handleAuthSubmit} onNameChange={setAuthName} onEmailChange={setAuthEmail} onPasswordChange={setAuthPassword} />

  return (
    <div className="app-shell">
      {editingId && drawerOpen && <button className="drawer-delete-button" type="button" onClick={() => setConfirmDelete(true)}>Excluir empresa</button>}
      {confirmDelete && editingId && <div className="confirm-backdrop" role="presentation"><div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><div className="confirm-icon">!</div><h2 id="delete-title">Excluir empresa?</h2><p>Essa ação removerá <strong>{form.company}</strong> da sua base de empresas.</p><div className="confirm-actions"><button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)}>Cancelar</button><button type="button" className="danger-button" onClick={deleteProspect}>Excluir empresa</button></div></div></div>}
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">N</span><span>NewType <span className="brand-dot">CRM</span></span></div>
        <div className="workspace-switcher"><span className="workspace-avatar">{initials(workspaceName)}</span><span><strong>{workspaceName}</strong><small>Workspace principal</small></span><span className="chevron">⌄</span></div>
        <nav className="main-nav" aria-label="Navegação principal">
          <p className="nav-label">Operação</p>
          <button className={`nav-item ${activePage === 'overview' ? 'active' : ''}`} onClick={() => navigateTo('overview')} aria-current={activePage === 'overview' ? 'page' : undefined}><span>◈</span> Visão geral</button>
          <button className={`nav-item ${activePage === 'companies' ? 'active' : ''}`} onClick={() => navigateTo('companies')} aria-current={activePage === 'companies' ? 'page' : undefined}><span>◎</span> Empresas <b>{prospects.length}</b></button>
          <button className={`nav-item ${activePage === 'leads' ? 'active' : ''}`} onClick={() => navigateTo('leads')} aria-current={activePage === 'leads' ? 'page' : undefined}><span>＋</span> Leads <b>{leads.length}</b></button>
          <button className={`nav-item ${activePage === 'pipeline' ? 'active' : ''}`} onClick={() => navigateTo('pipeline')} aria-current={activePage === 'pipeline' ? 'page' : undefined}><span>◇</span> Pipeline</button>
          <button className={`nav-item ${activePage === 'followups' ? 'active' : ''}`} onClick={() => navigateTo('followups')} aria-current={activePage === 'followups' ? 'page' : undefined}><span>◷</span> Follow-ups <b className="alert-count">4</b></button>
          <p className="nav-label second">Gestão</p>
          <button className={`nav-item ${activePage === 'reports' ? 'active' : ''}`} onClick={() => navigateTo('reports')} aria-current={activePage === 'reports' ? 'page' : undefined}><span>▦</span> Relatórios</button>
          <button className={`nav-item ${activePage === 'settings' ? 'active' : ''}`} onClick={() => navigateTo('settings')} aria-current={activePage === 'settings' ? 'page' : undefined}><span>⚙</span> Configurações</button>
        </nav>
        <div className="sidebar-bottom"><div className="help-card"><span className="help-icon">?</span><div><strong>Precisa de ajuda?</strong><small>Fale com seu time</small></div></div><button className="profile" type="button" onClick={openProfile}><span className="profile-avatar">{profile.photo ? <img src={profile.photo} alt="" /> : initials(profile.name)}</span><span><strong>{profile.name}</strong><small>{profile.role}</small></span><span className="more">•••</span></button></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumbs"><span>{currentPage.group}</span><b>/</b><strong>{currentPage.label}</strong></div><div className="top-actions"><button className="icon-button" title="Notificações" aria-label="Abrir notificações" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false) }}>♢{notifications.length > 0 && <i />}</button><button className="top-avatar" type="button" onClick={openProfile} aria-label="Abrir configurações do perfil">{profile.photo ? <img src={profile.photo} alt="" /> : initials(profile.name)}</button>{notificationsOpen && <div className="notification-panel"><div className="notification-heading"><div><strong>Notificações</strong><span>{notifications.length > 0 ? `${notifications.length} pendência${notifications.length > 1 ? 's' : ''}` : 'Tudo em dia'}</span></div><button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Fechar notificações">×</button></div><div className="notification-list">{notifications.length > 0 ? notifications.map((notification) => <button className="notification-item" type="button" key={notification.id} onClick={() => navigateTo('pipeline')}><span className="notification-dot" /><span><strong>{notification.title}</strong><small>{notification.detail}</small></span></button>) : <div className="notification-empty"><span>✓</span><strong>Nenhuma pendência</strong><small>Você está em dia com os contatos.</small></div>}</div></div>}{profileOpen && <form className="profile-panel" onSubmit={saveProfile}><div className="profile-panel-heading"><div><strong>Meu perfil</strong><span>Personalize como você aparece no workspace.</span></div><button type="button" onClick={() => setProfileOpen(false)} aria-label="Fechar perfil">×</button></div><div className="profile-photo-row"><span className="profile-panel-avatar">{profileDraft.photo ? <img src={profileDraft.photo} alt="Prévia da foto" /> : initials(profileDraft.name)}</span><label className="photo-button">Trocar foto<input type="file" accept="image/*" onChange={handleProfilePhoto} /></label>{profileDraft.photo && <button type="button" className="remove-photo" onClick={() => setProfileDraft({ ...profileDraft, photo: '' })}>Remover</button>}</div><label>Nome exibido<input required value={profileDraft.name} onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} /></label><label>Cargo<input value={profileDraft.role} onChange={(event) => setProfileDraft({ ...profileDraft, role: event.target.value })} placeholder="Ex.: Administrador" /></label><label>E-mail<input type="email" value={profileDraft.email} onChange={(event) => setProfileDraft({ ...profileDraft, email: event.target.value })} placeholder="seu@email.com" /></label><div className="profile-fields-row"><label>Status<select value={profileDraft.status} onChange={(event) => setProfileDraft({ ...profileDraft, status: event.target.value })}><option>Disponível</option><option>Ausente</option><option>Ocupado</option></select></label><label>Fuso horário<select value={profileDraft.timezone} onChange={(event) => setProfileDraft({ ...profileDraft, timezone: event.target.value })}><option>Brasília (GMT-3)</option><option>Fernando de Noronha (GMT-2)</option><option>Amazonas (GMT-4)</option></select></label></div><button className="primary-button profile-save" type="submit">Salvar perfil</button></form>}</div></header>
        <div className={`page-content ${activePage === 'companies' ? 'companies-page' : ''} ${activePage === 'reports' ? 'reports-page' : ''} ${activePage === 'settings' ? 'settings-page' : ''}`}>
          {activePage === 'overview' || activePage === 'companies' ? <>
          <section className="welcome"><div><p className="eyebrow">QUARTA-FEIRA, 25 DE SETEMBRO DE 2026</p><h1>Bom dia, Lucas <span>↗</span></h1><p className="subtitle">Aqui está o panorama dos seus potenciais clientes.</p></div><button className="primary-button" onClick={openCreate}><span>＋</span> Nova empresa</button></section>
          <section className="metric-grid" aria-label="Resumo da operação">
            <article className="metric-card featured"><div className="metric-heading"><span>Empresas cadastradas</span><span className="metric-icon">◎</span></div><strong>{prospects.length}</strong><p><span className="trend">↑ 12%</span> <span>vs. mês passado</span></p><div className="mini-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></article>
            <article className="metric-card"><div className="metric-heading"><span>Faturamento mapeado</span><span className="metric-icon green">◒</span></div><strong>{formatCurrency(totalRevenue)}</strong><p><span className="trend">↑ 8,4%</span> <span>vs. mês passado</span></p></article>
            <article className="metric-card"><div className="metric-heading"><span>Compram mídia</span><span className="metric-icon orange">◉</span></div><strong>{mediaReady}<small>/{prospects.length}</small></strong><p><span className="trend orange-text">{Math.round((mediaReady / Math.max(prospects.length, 1)) * 100)}%</span> <span>da base qualificada</span></p></article>
            <article className="metric-card"><div className="metric-heading"><span>Produzem conteúdo</span><span className="metric-icon blue">✦</span></div><strong>{contentReady}<small>/{prospects.length}</small></strong><p><span className="trend blue-text">{Math.round((contentReady / Math.max(prospects.length, 1)) * 100)}%</span> <span>da base qualificada</span></p></article>
          </section>

          <section className="section-header"><div><h2>{activePage === 'companies' ? 'Todas as empresas' : 'Empresas recentes'}</h2><p>Gerencie e qualifique seus potenciais clientes.</p></div>{activePage === 'overview' && <button className="text-button" onClick={() => setActivePage('companies')}>Ver todas <span>→</span></button>}</section>
          <section className="table-card">
            <div className="table-toolbar"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar empresa, dono ou nicho..." /></div><div className="toolbar-actions"><select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)} aria-label="Filtrar por nicho"><option>Todos os nichos</option>{sectors.map((sector) => <option key={sector}>{sector}</option>)}</select><button className="filter-button" onClick={() => { setQuery(''); setSectorFilter('Todos os nichos') }}>≡ <span>Limpar</span></button><button className="export-button" onClick={exportCsv}>↓ <span>Exportar</span></button></div></div>
            <div className="table-wrap"><table><thead><tr><th>EMPRESA</th><th>DONO</th><th>FATURAMENTO ANUAL</th><th>NICHO / SETOR</th><th>CONTEÚDO</th><th>COMPRA MÍDIA</th><th /></tr></thead><tbody>{filteredProspects.map((prospect) => <tr key={prospect.id} onClick={() => openEdit(prospect)}><td><div className="company-cell"><span className="company-avatar">{initials(prospect.company)}</span><strong>{prospect.company}</strong></div></td><td>{prospect.owner}</td><td className="revenue">{formatCurrency(prospect.revenue)}</td><td><span className="sector-pill">{prospect.sector}</span></td><td><span className={`status ${prospect.content ? 'yes' : 'no'}`}><i />{prospect.content ? 'Sim' : 'Não'}</span></td><td><span className={`status ${prospect.media ? 'yes' : 'no'}`}><i />{prospect.media ? 'Sim' : 'Não'}</span></td><td><button className="row-more" onClick={(event) => { event.stopPropagation(); openEdit(prospect) }}>•••</button></td></tr>)}</tbody></table>{filteredProspects.length === 0 && <div className="empty-state"><strong>Nenhuma empresa encontrada</strong><span>Tente mudar a busca ou o filtro selecionado.</span></div>}</div><div className="table-footer"><span>Mostrando <strong>{filteredProspects.length}</strong> de <strong>{prospects.length}</strong> empresas</span><div className="pagination"><button disabled>‹</button><button className="current">1</button><button disabled>›</button></div></div>
          </section>
          </> : activePage === 'leads' ? <section className="leads-page">
            <div className="leads-heading"><div><p className="eyebrow">PROSPECÇÃO</p><h1>Leads</h1><p className="subtitle">Cadastre contatos novos e mantenha as próximas oportunidades organizadas.</p></div><div className="lead-count"><strong>{leads.length}</strong><span>leads cadastrados</span></div></div>
            <form className="lead-form" onSubmit={handleLeadSubmit}>
              <div className="lead-form-heading"><div><h2>Novo lead</h2><p>Registre as informações essenciais para iniciar a qualificação.</p></div><button className="primary-button" type="submit"><span>＋</span> Cadastrar lead</button></div>
              <div className="lead-fields">
                <label>Nome da empresa<input required value={leadForm.company} onChange={(event) => setLeadForm({ ...leadForm, company: event.target.value })} placeholder="Ex.: Clínica Horizonte" /></label>
                <label>E-mail de contato<input required type="email" value={leadForm.email} onChange={(event) => setLeadForm({ ...leadForm, email: event.target.value })} placeholder="contato@empresa.com" /></label>
                <label>Telefone<input required type="tel" value={leadForm.phone} onChange={(event) => setLeadForm({ ...leadForm, phone: event.target.value })} placeholder="(11) 99999-9999" /></label>
                <label>Nicho / setor<input required value={leadForm.sector} onChange={(event) => setLeadForm({ ...leadForm, sector: event.target.value })} placeholder="Ex.: Saúde" /></label>
                <label>Cidade / estado<input required value={leadForm.location} onChange={(event) => setLeadForm({ ...leadForm, location: event.target.value })} placeholder="Ex.: São Paulo, SP" /></label>
                <label>Origem do lead<select value={leadForm.source} onChange={(event) => setLeadForm({ ...leadForm, source: event.target.value })}><option value="">Selecione uma origem</option><option>Indicação</option><option>Instagram</option><option>Google</option><option>Site</option><option>Evento</option><option>Outro</option></select></label>
                <label>Responsável<input value={leadForm.owner} onChange={(event) => setLeadForm({ ...leadForm, owner: event.target.value })} placeholder="Ex.: Lucas Silva" /></label>
                <label>Próximo contato<input type="date" value={leadForm.nextContact} onChange={(event) => setLeadForm({ ...leadForm, nextContact: event.target.value })} /></label>
                <label className="lead-notes">Observações<textarea value={leadForm.notes} onChange={(event) => setLeadForm({ ...leadForm, notes: event.target.value })} placeholder="Contexto, necessidade ou oportunidade identificada..." /></label>
              </div>
            </form>
            <div className="leads-list-header"><div><h2>Leads cadastrados</h2><p>Consulte os contatos e seus dados de qualificação.</p></div><div className="lead-search"><span>⌕</span><input value={leadQuery} onChange={(event) => setLeadQuery(event.target.value)} placeholder="Buscar lead..." /></div></div>
            <div className="lead-list">{visibleLeads.map((lead) => <article className="lead-card" key={lead.id}><div className="lead-card-main"><span className="company-avatar">{initials(lead.company)}</span><div><h3>{lead.company}</h3><p>{lead.sector} <span>•</span> {lead.location}</p></div></div><div className="lead-contact"><span>{lead.email}</span><span>{lead.phone}</span></div><div className="lead-meta"><span>{lead.source || 'Origem não informada'}</span>{lead.nextContact && <small>Próximo contato: {new Intl.DateTimeFormat('pt-BR').format(new Date(`${lead.nextContact}T12:00:00`))}</small>}</div><button className="lead-delete" type="button" onClick={() => deleteLead(lead.id)} aria-label={`Excluir ${lead.company}`} title="Excluir lead">×</button></article>)}{visibleLeads.length === 0 && <div className="empty-state"><strong>{leads.length === 0 ? 'Nenhum lead cadastrado' : 'Nenhum lead encontrado'}</strong><span>{leads.length === 0 ? 'Use o formulário acima para adicionar seu primeiro contato.' : 'Tente buscar por outro termo.'}</span></div>}</div>
          </section> : activePage === 'pipeline' ? <section className="pipeline-page"><div className="pipeline-heading"><div><p className="eyebrow">OPERAÇÃO</p><h1>Pipeline</h1><p className="subtitle">Organize as próximas ações para transformar leads em oportunidades.</p></div><div className="pipeline-count"><strong>{pipelineLeads.length}</strong><span>ações cadastradas</span></div></div><div className="pipeline-list"><div className="pipeline-list-header"><div><h2>Próximas ações</h2><p>Empresas com contato previsto ou em acompanhamento.</p></div></div>{pipelineLeads.length > 0 ? pipelineLeads.map((lead) => <article className="pipeline-item" key={lead.id}><div className="pipeline-company"><span className="company-avatar">{initials(lead.company)}</span><div><h3>{lead.company}</h3><p>{lead.company}</p></div></div><div className="pipeline-contact"><small>CONTATO</small><strong>{lead.email}</strong><span>{lead.phone}</span></div><div className="pipeline-action"><small>AÇÃO</small><strong>{lead.notes || 'Realizar contato de qualificação'}</strong></div><div className="pipeline-owner"><small>RESPONSÁVEL</small><strong>{lead.owner || 'Não definido'}</strong></div><div className="pipeline-date"><small>DATA</small><strong className={lead.nextContact < today ? 'overdue' : ''}>{new Intl.DateTimeFormat('pt-BR').format(new Date(`${lead.nextContact}T12:00:00`))}</strong><span>{lead.nextContact < today ? 'Atrasado' : lead.nextContact === today ? 'Hoje' : 'Agendado'}</span></div><button className="pipeline-done" type="button" onClick={() => completePipelineAction(lead)}>Feito</button></article>) : <div className="empty-state"><strong>Nenhuma ação no pipeline</strong><span>Cadastre um próximo contato em Leads para acompanhar uma oportunidade aqui.</span></div>}</div></section> : activePage === 'followups' ? <section className="followups-page"><div className="followups-heading"><div><p className="eyebrow">OPERAÇÃO</p><h1>Follow-ups</h1><p className="subtitle">Configure quando cada contato deverá acontecer novamente.</p></div><div className="pipeline-count"><strong>{followUps.length}</strong><span>ações concluídas</span></div></div><div className="followup-list">{followUps.length > 0 ? followUps.map((followUp) => <article className="followup-item" key={followUp.id}><div className="pipeline-company"><span className="company-avatar">{initials(followUp.company)}</span><div><h3>{followUp.company}</h3><p>{followUp.email} <span>•</span> {followUp.phone}</p></div></div><div className="followup-action"><small>AÇÃO CONCLUÍDA</small><strong>{followUp.action}</strong><span>Responsável: {followUp.owner || 'Não definido'}</span></div><label className="followup-date"><small>PRÓXIMO CONTATO</small><input type="date" value={followUp.nextContact} onChange={(event) => scheduleFollowUp(followUp.id, event.target.value)} /><span>{followUp.nextContact ? 'Agendado' : 'Defina uma data'}</span></label></article>) : <div className="empty-state"><strong>Nenhum follow-up pendente</strong><span>Conclua uma ação no Pipeline para configurá-la aqui.</span></div>}</div></section> : <section className="placeholder-page"><p className="eyebrow">{currentPage.group.toUpperCase()}</p><div className="placeholder-icon">{activePage === 'reports' ? '▦' : '⚙'}</div><h1>{currentPage.label}</h1><p>{currentPage.description}</p><span>Esta área está pronta para receber os próximos recursos.</span></section>}
        </div>
        {activePage === 'reports' && <section className="report-panel"><div className="report-heading"><div><p className="eyebrow">GESTÃO</p><h1>Relatórios</h1><p className="subtitle">Exporte os dados do CRM no formato que precisar.</p></div></div><div className="report-cards"><article className="report-card"><div className="report-card-icon">◎</div><div><h2>Empresas</h2><p>Dados cadastrais, faturamento, nicho e qualificação.</p></div><div className="report-actions"><button type="button" onClick={() => downloadReportCsv('companies')}>CSV</button><button type="button" onClick={() => downloadReportExcel('companies')}>Excel</button><button type="button" onClick={() => printReport('companies')}>PDF</button></div></article><article className="report-card"><div className="report-card-icon blue">＋</div><div><h2>Leads</h2><p>Contatos, origem, responsável e próximos contatos.</p></div><div className="report-actions"><button type="button" onClick={() => downloadReportCsv('leads')}>CSV</button><button type="button" onClick={() => downloadReportExcel('leads')}>Excel</button><button type="button" onClick={() => printReport('leads')}>PDF</button></div></article></div></section>}
        {activePage === 'settings' && <section className="settings-panel"><div className="settings-heading"><div><p className="eyebrow">GESTÃO</p><h1>Configurações</h1><p className="subtitle">Administre sua conta e as pessoas que acessam o workspace.</p></div><button className="logout-button" type="button" onClick={logout}>Sair da conta</button></div><div className="settings-grid"><form className="settings-card" onSubmit={updateAccount}><div className="settings-card-heading"><div><h2>Minha conta</h2><p>Atualize seus dados de acesso.</p></div></div><label>Nome exibido<input required value={profileDraft.name} onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} /></label><label>E-mail de acesso<input required type="email" value={profileDraft.email} onChange={(event) => setProfileDraft({ ...profileDraft, email: event.target.value })} placeholder="voce@empresa.com" /></label><label>Nova senha<input type="password" minLength={6} value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} placeholder="Deixe em branco para manter" /></label><button className="primary-button" type="submit">Salvar alterações</button></form><div className="settings-card"><div className="settings-card-heading"><div><h2>Usuários do workspace</h2><p>Cadastre pessoas para utilizar o CRM.</p></div><span className="user-count">{users.length}</span></div><form className="new-user-form" onSubmit={addUser}><input required value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} placeholder="Nome completo" /><input required type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} placeholder="E-mail" /><select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}><option>Colaborador</option><option>Administrador</option><option>Gestor</option></select><input required type="password" minLength={6} value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} placeholder="Senha inicial" /><label className="new-user-photo">Foto do perfil<input type="file" accept="image/*" onChange={handleNewUserPhoto} /><span>{newUserPhoto ? 'Foto selecionada' : 'Escolher foto'}</span></label><button className="secondary-button" type="submit">Adicionar usuário</button></form><div className="user-list">{users.map((user) => <div className="user-row" key={user.id}><span className="company-avatar">{user.photo ? <img src={user.photo} alt="" /> : initials(user.name)}</span><div><strong>{user.name}</strong><small>{user.email} · {user.role}</small></div>{user.id !== sessionUserId && currentUser?.email.toLowerCase() === 'lucasthyagootk@gmail.com' && <button className="user-delete" type="button" onClick={() => deleteUser(user.id)}>Excluir</button>}{user.id === sessionUserId && <span className="current-user-tag">Você</span>}</div>)}</div></div></div></section>}
        {activePage === 'settings' && <form className="workspace-settings" onSubmit={saveWorkspaceName}><div><h2>Workspace</h2><p>Defina o nome da agência exibido no menu lateral.</p></div><div className="workspace-settings-controls"><input aria-label="Nome da agência" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} /><button className="primary-button" type="submit">Salvar nome</button></div></form>}
      {activePage === 'companies' && <><form className="company-finance-panel" onSubmit={saveCompanyFinance}><div><p className="eyebrow">GESTÃO FINANCEIRA</p><h2>Valores por empresa</h2><p>Registre quanto cada cliente paga e quanto investe em mídia por semana.</p></div><div className="company-finance-fields"><select required value={financialCompanyId || ''} onChange={(event) => selectFinancialCompany(Number(event.target.value))}><option value="">Selecione uma empresa</option>{prospects.map((prospect) => <option key={prospect.id} value={prospect.id}>{prospect.company}</option>)}</select><label>Valor que paga<input type="number" min="0" value={financialValue || ''} onChange={(event) => setFinancialValue(Number(event.target.value))} placeholder="R$ 0" /></label><label>Mídia por semana<input type="number" min="0" value={financialMedia || ''} onChange={(event) => setFinancialMedia(Number(event.target.value))} placeholder="R$ 0" /></label><button className="primary-button" type="submit">Salvar valores</button></div></form>{selectedFinancialCompany && <section className="company-history-panel"><div className="company-history-heading"><div><p className="eyebrow">HISTÓRICO</p><h2>Registro de {selectedFinancialCompany.company}</h2><p>Alterações recentes nos dados desta empresa.</p></div><div className="company-report-actions"><button type="button" onClick={() => downloadCompanyReport(selectedFinancialCompany, 'csv')}>CSV</button><button type="button" onClick={() => downloadCompanyReport(selectedFinancialCompany, 'excel')}>Excel</button><button type="button" onClick={() => downloadCompanyReport(selectedFinancialCompany, 'pdf')}>PDF</button></div></div>{selectedCompanyChanges.length > 0 ? <div className="company-history-list">{selectedCompanyChanges.map((change, index) => <div className={`company-change ${index === 0 ? 'latest' : ''}`} key={change.id}><div><strong>{change.field}</strong><small>{new Intl.DateTimeFormat('pt-BR').format(new Date(change.changedAt))}</small></div><span>{change.previousValue}</span><b>→</b><strong className="new-value">{change.newValue}</strong></div>)}</div> : <div className="empty-state"><strong>Nenhuma alteração registrada</strong><span>As próximas mudanças aparecerão aqui.</span></div>}</section>}</>}
      </main>

      {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}><aside className="drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><p className="eyebrow">QUALIFICAÇÃO</p><h2>{editingId ? 'Editar empresa' : 'Nova empresa'}</h2><p>Preencha os dados essenciais para qualificar este contato.</p></div><button className="close-button" onClick={() => setDrawerOpen(false)}>×</button></div><form onSubmit={handleSubmit}><label>Nome da Empresa<input required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Ex.: Clínica Horizonte" /></label><label>Nome do Dono<input required value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} placeholder="Ex.: Marina Alves" /></label><label>Faturamento anual<input required type="number" min="0" value={form.revenue || ''} onChange={(event) => setForm({ ...form, revenue: Number(event.target.value) })} placeholder="0" /></label><label>Nicho / Setor<input required value={form.sector} onChange={(event) => setForm({ ...form, sector: event.target.value })} placeholder="Ex.: Saúde" /></label><div className="toggle-row"><div><strong>Produz conteúdo?</strong><small>A empresa mantém uma rotina de conteúdo.</small></div><button type="button" className={`toggle ${form.content ? 'on' : ''}`} onClick={() => setForm({ ...form, content: !form.content })} aria-pressed={form.content}><span /></button></div><div className="toggle-row"><div><strong>Compra mídia?</strong><small>Investe atualmente em anúncios pagos.</small></div><button type="button" className={`toggle ${form.media ? 'on' : ''}`} onClick={() => setForm({ ...form, media: !form.media })} aria-pressed={form.media}><span /></button></div><div className="drawer-actions"><button type="button" className="secondary-button" onClick={() => setDrawerOpen(false)}>Cancelar</button><button className="primary-button" type="submit">{editingId ? 'Salvar alterações' : 'Cadastrar empresa'}</button></div></form></aside></div>}
    </div>
  )
}

export default App
