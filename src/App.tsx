import { FormEvent, useMemo, useState } from 'react'

type Prospect = {
  id: number
  company: string
  owner: string
  revenue: number
  sector: string
  content: boolean
  media: boolean
  createdAt: string
}

type ProspectForm = Omit<Prospect, 'id' | 'createdAt'>

const initialProspects: Prospect[] = [
  { id: 1, company: 'Clínica Horizonte', owner: 'Marina Alves', revenue: 1800000, sector: 'Saúde', content: true, media: true, createdAt: '2026-09-21' },
  { id: 2, company: 'Casa Nativa', owner: 'Rafael Moura', revenue: 920000, sector: 'Varejo', content: false, media: true, createdAt: '2026-09-19' },
  { id: 3, company: 'Lume Arquitetura', owner: 'Bianca Reis', revenue: 640000, sector: 'Serviços', content: true, media: false, createdAt: '2026-09-17' },
  { id: 4, company: 'Atlas Educação', owner: 'Diego Nunes', revenue: 2400000, sector: 'Educação', content: true, media: true, createdAt: '2026-09-14' },
  { id: 5, company: 'Vitta Pet', owner: 'Carolina Freire', revenue: 410000, sector: 'Pet', content: false, media: false, createdAt: '2026-09-12' },
]

const emptyForm: ProspectForm = { company: '', owner: '', revenue: 0, sector: '', content: false, media: false }

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
const initials = (name: string) => name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()

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

  const saveProspects = (next: Prospect[]) => {
    setProspects(next)
    localStorage.setItem('clareza-prospects', JSON.stringify(next))
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
    setDrawerOpen(true)
  }

  const openEdit = (prospect: Prospect) => {
    setEditingId(prospect.id)
    setForm({ company: prospect.company, owner: prospect.owner, revenue: prospect.revenue, sector: prospect.sector, content: prospect.content, media: prospect.media })
    setDrawerOpen(true)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.company.trim() || !form.owner.trim() || !form.sector.trim()) return
    if (editingId) {
      saveProspects(prospects.map((prospect) => prospect.id === editingId ? { ...prospect, ...form } : prospect))
    } else {
      saveProspects([{ ...form, id: Date.now(), createdAt: new Date().toISOString() }, ...prospects])
    }
    setDrawerOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">C</span><span>clareza<span className="brand-dot">.</span></span></div>
        <div className="workspace-switcher"><span className="workspace-avatar">AG</span><span><strong>Agência Aurora</strong><small>Workspace principal</small></span><span className="chevron">⌄</span></div>
        <nav className="main-nav" aria-label="Navegação principal">
          <p className="nav-label">Operação</p>
          <button className="nav-item active"><span>◈</span> Visão geral</button>
          <button className="nav-item"><span>◎</span> Empresas <b>{prospects.length}</b></button>
          <button className="nav-item"><span>◇</span> Pipeline</button>
          <button className="nav-item"><span>◷</span> Follow-ups <b className="alert-count">4</b></button>
          <p className="nav-label second">Gestão</p>
          <button className="nav-item"><span>▦</span> Relatórios</button>
          <button className="nav-item"><span>⚙</span> Configurações</button>
        </nav>
        <div className="sidebar-bottom"><div className="help-card"><span className="help-icon">?</span><div><strong>Precisa de ajuda?</strong><small>Fale com seu time</small></div></div><div className="profile"><span className="profile-avatar">LS</span><span><strong>Lucas Silva</strong><small>Administrador</small></span><span className="more">•••</span></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumbs"><span>Operação</span><b>/</b><strong>Visão geral</strong></div><div className="top-actions"><button className="icon-button" title="Notificações">♢<i /></button><button className="top-avatar">LS</button></div></header>
        <div className="page-content">
          <section className="welcome"><div><p className="eyebrow">QUARTA-FEIRA, 25 DE SETEMBRO DE 2026</p><h1>Bom dia, Lucas <span>↗</span></h1><p className="subtitle">Aqui está o panorama dos seus potenciais clientes.</p></div><button className="primary-button" onClick={openCreate}><span>＋</span> Nova empresa</button></section>
          <section className="metric-grid" aria-label="Resumo da operação">
            <article className="metric-card featured"><div className="metric-heading"><span>Empresas cadastradas</span><span className="metric-icon">◎</span></div><strong>{prospects.length}</strong><p><span className="trend">↑ 12%</span> <span>vs. mês passado</span></p><div className="mini-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></article>
            <article className="metric-card"><div className="metric-heading"><span>Faturamento mapeado</span><span className="metric-icon green">◒</span></div><strong>{formatCurrency(totalRevenue)}</strong><p><span className="trend">↑ 8,4%</span> <span>vs. mês passado</span></p></article>
            <article className="metric-card"><div className="metric-heading"><span>Compram mídia</span><span className="metric-icon orange">◉</span></div><strong>{mediaReady}<small>/{prospects.length}</small></strong><p><span className="trend orange-text">{Math.round((mediaReady / Math.max(prospects.length, 1)) * 100)}%</span> <span>da base qualificada</span></p></article>
            <article className="metric-card"><div className="metric-heading"><span>Produzem conteúdo</span><span className="metric-icon blue">✦</span></div><strong>{contentReady}<small>/{prospects.length}</small></strong><p><span className="trend blue-text">{Math.round((contentReady / Math.max(prospects.length, 1)) * 100)}%</span> <span>da base qualificada</span></p></article>
          </section>

          <section className="section-header"><div><h2>Empresas recentes</h2><p>Gerencie e qualifique seus potenciais clientes.</p></div><button className="text-button">Ver todas <span>→</span></button></section>
          <section className="table-card">
            <div className="table-toolbar"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar empresa, dono ou nicho..." /></div><div className="toolbar-actions"><select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)} aria-label="Filtrar por nicho"><option>Todos os nichos</option>{sectors.map((sector) => <option key={sector}>{sector}</option>)}</select><button className="filter-button" onClick={() => { setQuery(''); setSectorFilter('Todos os nichos') }}>≡ <span>Limpar</span></button><button className="export-button" onClick={exportCsv}>↓ <span>Exportar</span></button></div></div>
            <div className="table-wrap"><table><thead><tr><th>EMPRESA</th><th>DONO</th><th>FATURAMENTO ANUAL</th><th>NICHO / SETOR</th><th>CONTEÚDO</th><th>COMPRA MÍDIA</th><th /></tr></thead><tbody>{filteredProspects.map((prospect) => <tr key={prospect.id} onClick={() => openEdit(prospect)}><td><div className="company-cell"><span className="company-avatar">{initials(prospect.company)}</span><strong>{prospect.company}</strong></div></td><td>{prospect.owner}</td><td className="revenue">{formatCurrency(prospect.revenue)}</td><td><span className="sector-pill">{prospect.sector}</span></td><td><span className={`status ${prospect.content ? 'yes' : 'no'}`}><i />{prospect.content ? 'Sim' : 'Não'}</span></td><td><span className={`status ${prospect.media ? 'yes' : 'no'}`}><i />{prospect.media ? 'Sim' : 'Não'}</span></td><td><button className="row-more" onClick={(event) => { event.stopPropagation(); openEdit(prospect) }}>•••</button></td></tr>)}</tbody></table>{filteredProspects.length === 0 && <div className="empty-state"><strong>Nenhuma empresa encontrada</strong><span>Tente mudar a busca ou o filtro selecionado.</span></div>}</div><div className="table-footer"><span>Mostrando <strong>{filteredProspects.length}</strong> de <strong>{prospects.length}</strong> empresas</span><div className="pagination"><button disabled>‹</button><button className="current">1</button><button disabled>›</button></div></div>
          </section>
        </div>
      </main>

      {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}><aside className="drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><p className="eyebrow">QUALIFICAÇÃO</p><h2>{editingId ? 'Editar empresa' : 'Nova empresa'}</h2><p>Preencha os dados essenciais para qualificar este contato.</p></div><button className="close-button" onClick={() => setDrawerOpen(false)}>×</button></div><form onSubmit={handleSubmit}><label>Nome da Empresa<input required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Ex.: Clínica Horizonte" /></label><label>Nome do Dono<input required value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} placeholder="Ex.: Marina Alves" /></label><label>Faturamento anual<input required type="number" min="0" value={form.revenue || ''} onChange={(event) => setForm({ ...form, revenue: Number(event.target.value) })} placeholder="0" /></label><label>Nicho / Setor<input required value={form.sector} onChange={(event) => setForm({ ...form, sector: event.target.value })} placeholder="Ex.: Saúde" /></label><div className="toggle-row"><div><strong>Produz conteúdo?</strong><small>A empresa mantém uma rotina de conteúdo.</small></div><button type="button" className={`toggle ${form.content ? 'on' : ''}`} onClick={() => setForm({ ...form, content: !form.content })} aria-pressed={form.content}><span /></button></div><div className="toggle-row"><div><strong>Compra mídia?</strong><small>Investe atualmente em anúncios pagos.</small></div><button type="button" className={`toggle ${form.media ? 'on' : ''}`} onClick={() => setForm({ ...form, media: !form.media })} aria-pressed={form.media}><span /></button></div><div className="drawer-actions"><button type="button" className="secondary-button" onClick={() => setDrawerOpen(false)}>Cancelar</button><button className="primary-button" type="submit">{editingId ? 'Salvar alterações' : 'Cadastrar empresa'}</button></div></form></aside></div>}
    </div>
  )
}

export default App
