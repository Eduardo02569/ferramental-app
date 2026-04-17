import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';

const STATUS_CONFIG = {
  nao_iniciou: { label: 'Não Iniciou', color: '#E05C5C', bg: '#E05C5C18', icon: '○' },
  em_andamento: { label: 'Em Andamento', color: '#F5A623', bg: '#F5A62318', icon: '◐' },
  concluido: { label: 'Concluído', color: '#00C896', bg: '#00C89618', icon: '✓' },
};

const MACHINES = ['laser', 'torno', 'fresa', 'cnc'];
const MACHINE_LABELS = { laser: 'Laser', torno: 'Torno', fresa: 'Fresa', cnc: 'CNC' };

function compress(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
          else { w = Math.round((w * MAX) / h); h = MAX; }
        }
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cv.toBlob((blob) => resolve(blob), 'image/jpeg', 0.75);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function emptyMachines() {
  return MACHINES.reduce((acc, m) => ({ ...acc, [m]: null }), {});
}

function MachineRow({ machine, value, onChange }) {
  const st = value ? STATUS_CONFIG[value] : null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, minWidth: 50 }}>{MACHINE_LABELS[machine]}</span>
        {st
          ? <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: st.bg, border: `1px solid ${st.color}50`, color: st.color, fontWeight: 700 }}>{st.icon} {st.label}</span>
          : <span style={{ fontSize: 10, color: '#4B5563' }}>Não aplicável</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => onChange(machine, null)}
          style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', background: value === null ? '#2A2D3699' : 'transparent', border: `1.5px solid ${value === null ? '#6B7280' : '#2A2D36'}`, color: value === null ? '#E8EAF0' : '#4B5563', fontWeight: value === null ? 700 : 400 }}>
          —
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, s]) => (
          <button key={key} onClick={() => onChange(machine, key)}
            style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', background: value === key ? s.bg : 'transparent', border: `1.5px solid ${value === key ? s.color : '#2A2D36'}`, color: value === key ? s.color : '#4B5563', fontWeight: value === key ? 700 : 400 }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [addPanel, setAddPanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [form, setForm] = useState({ nome: '', codigo: '', status: 'nao_iniciou', obs: '', responsavel: '', ...emptyMachines() });
  const fileRef = useRef();

  useEffect(() => { loadItems(); }, []);

  async function loadItems() {
    setLoading(true);
    const { data: ferramentais } = await supabase.from('ferramentais').select('*, fotos(url)').order('created_at', { ascending: false });
    setItems(ferramentais || []);
    setLoading(false);
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const blob = await compress(file);
    setPreviewBlob(blob);
    setPreview(URL.createObjectURL(blob));
    setUploading(false);
  }

  async function handleAdd() {
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      const { data: item, error } = await supabase.from('ferramentais').insert([{
        nome: form.nome.trim(),
        codigo: form.codigo.trim(),
        status: form.status,
        obs: form.obs.trim(),
        responsavel: form.responsavel.trim(),
        laser: form.laser,
        torno: form.torno,
        fresa: form.fresa,
        cnc: form.cnc,
      }]).select().single();

      if (error) throw error;

      if (previewBlob) {
        const fileName = `${item.id}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('fotos').upload(fileName, previewBlob, { contentType: 'image/jpeg' });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(fileName);
          await supabase.from('fotos').insert([{ ferramental_id: item.id, url: urlData.publicUrl }]);
        }
      }

      setSaveMsg('Salvo ✓');
      setTimeout(() => setSaveMsg(''), 2500);
      setForm({ nome: '', codigo: '', status: 'nao_iniciou', obs: '', responsavel: '', ...emptyMachines() });
      setPreview(null);
      setPreviewBlob(null);
      setAddPanel(false);
      if (fileRef.current) fileRef.current.value = '';
      loadItems();
    } catch (e) {
      setSaveMsg('Erro ao salvar');
    }
    setSaving(false);
  }

  async function handleStatusChange(id, status) {
    await supabase.from('ferramentais').update({ status }).eq('id', id);
    setItems(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    if (modal?.id === id) setModal(m => ({ ...m, status }));
  }

  async function handleMachineChange(id, machine, value) {
    await supabase.from('ferramentais').update({ [machine]: value }).eq('id', id);
    setItems(prev => prev.map(p => p.id === id ? { ...p, [machine]: value } : p));
    if (modal?.id === id) setModal(m => ({ ...m, [machine]: value }));
  }

  async function handleDelete(id) {
    if (!window.confirm('Remover este ferramental?')) return;
    await supabase.from('ferramentais').delete().eq('id', id);
    setItems(prev => prev.filter(p => p.id !== id));
    setModal(null);
  }

  const filtered = items.filter(p => {
    const matchFilter = filter === 'todos' || p.status === filter;
    const matchSearch = !search || p.nome.toLowerCase().includes(search.toLowerCase()) || (p.codigo || '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    todos: items.length,
    nao_iniciou: items.filter(p => p.status === 'nao_iniciou').length,
    em_andamento: items.filter(p => p.status === 'em_andamento').length,
    concluido: items.filter(p => p.status === 'concluido').length,
  };

  const inputStyle = { width: '100%', background: '#0F1117', border: '1.5px solid #2A2D36', borderRadius: 10, padding: '10px 14px', color: '#E8EAF0', fontSize: 13, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: '100vh', background: '#0F1117', color: '#E8EAF0' }}>

      {/* HEADER */}
      <div style={{ background: '#16191F', borderBottom: '1px solid #2A2D36', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#00C896,#0082FF)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚙</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Ferramental DB</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>Controle de ferramentais</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {saveMsg && <span style={{ fontSize: 12, color: '#00C896' }}>{saveMsg}</span>}
          <button onClick={() => setAddPanel(true)}
            style={{ background: 'linear-gradient(135deg,#00C896,#0082FF)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            + Adicionar
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 10, padding: '16px 24px 0', flexWrap: 'wrap', alignItems: 'center' }}>
        {[['todos','#6B7280','Todos'],['nao_iniciou','#E05C5C','Não Iniciou'],['em_andamento','#F5A623','Em Andamento'],['concluido','#00C896','Concluído']].map(([key, color, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{ background: filter === key ? color + '22' : '#16191F', border: `1.5px solid ${filter === key ? color : '#2A2D36'}`, borderRadius: 10, padding: '8px 16px', cursor: 'pointer', color: filter === key ? color : '#9CA3AF', fontWeight: filter === key ? 700 : 400, fontSize: 13, display: 'flex', gap: 7, alignItems: 'center' }}>
            <span style={{ fontSize: 17, color }}>{counts[key]}</span>{label}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou código..."
          style={{ ...inputStyle, marginLeft: 'auto', minWidth: 210, padding: '9px 14px' }} />
      </div>

      {/* GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 16, padding: 24 }}>
        {loading && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: '#4B5563' }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
            <div>Carregando ferramentais...</div>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: '#4B5563' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
            <div style={{ fontSize: 15 }}>Nenhum ferramental encontrado</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Clique em "+ Adicionar" para registrar</div>
          </div>
        )}
        {filtered.map((p) => {
          const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.nao_iniciou;
          const foto = p.fotos?.[0]?.url;
          return (
            <div key={p.id} onClick={() => setModal(p)}
              style={{ background: '#16191F', border: '1.5px solid #2A2D36', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'transform .15s, border-color .15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = st.color + '60'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = '#2A2D36'; }}>
              <div style={{ height: 140, background: '#0F1117', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {foto
                  ? <img src={foto} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 32, color: '#2A2D36' }}>📷</span>}
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: st.bg, border: `1px solid ${st.color}40`, borderRadius: 20, padding: '3px 10px', marginBottom: 8 }}>
                  <span style={{ color: st.color, fontSize: 11, fontWeight: 700 }}>{st.icon} {st.label}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
                {p.codigo && <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>Cód: {p.codigo}</div>}
                <div style={{ borderTop: '1px solid #2A2D36', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {MACHINES.map(m => {
                    const ms = p[m] ? STATUS_CONFIG[p[m]] : null;
                    return (
                      <div key={m} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#6B7280' }}>{MACHINE_LABELS[m]}</span>
                        {ms ? <span style={{ fontSize: 10, color: ms.color, fontWeight: 700 }}>{ms.icon} {ms.label}</span>
                          : <span style={{ fontSize: 10, color: '#3A3D46' }}>—</span>}
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, color: '#4B5563', marginTop: 8 }}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DETALHE */}
      {modal && (() => {
        const st = STATUS_CONFIG[modal.status] || STATUS_CONFIG.nao_iniciou;
        const foto = modal.fotos?.[0]?.url;
        return (
          <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#16191F', borderRadius: 18, width: '100%', maxWidth: 500, border: '1.5px solid #2A2D36', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ height: 220, background: '#0F1117', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {foto ? <img src={foto} alt={modal.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 48, color: '#2A2D36' }}>📷</span>}
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{modal.nome}</div>
                    {modal.codigo && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Código: {modal.codigo}</div>}
                    {modal.responsavel && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Responsável: {modal.responsavel}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: '#4B5563' }}>{new Date(modal.created_at).toLocaleDateString('pt-BR')}</div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: 600 }}>Status Geral</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(STATUS_CONFIG).map(([key, s]) => (
                      <button key={key} onClick={() => handleStatusChange(modal.id, key)}
                        style={{ background: modal.status === key ? s.bg : 'transparent', border: `1.5px solid ${modal.status === key ? s.color : '#2A2D36'}`, borderRadius: 20, padding: '7px 14px', cursor: 'pointer', color: modal.status === key ? s.color : '#6B7280', fontSize: 12, fontWeight: modal.status === key ? 700 : 400 }}>
                        {s.icon} {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12, fontWeight: 600 }}>Status por Máquina</div>
                  <div style={{ background: '#0F1117', borderRadius: 12, padding: '14px 16px' }}>
                    {MACHINES.map(m => (
                      <MachineRow key={m} machine={m} value={modal[m]}
                        onChange={(machine, value) => handleMachineChange(modal.id, machine, value)} />
                    ))}
                  </div>
                </div>

                {modal.obs && (
                  <div style={{ background: '#0F1117', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#9CA3AF', marginBottom: 18 }}>
                    {modal.obs}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setModal(null)} style={{ flex: 1, background: '#2A2D36', border: 'none', borderRadius: 10, padding: '11px 0', color: '#9CA3AF', cursor: 'pointer', fontSize: 13 }}>Fechar</button>
                  <button onClick={() => handleDelete(modal.id)} style={{ background: '#E05C5C18', border: '1px solid #E05C5C40', borderRadius: 10, padding: '11px 18px', color: '#E05C5C', cursor: 'pointer', fontSize: 13 }}>Remover</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PAINEL ADICIONAR */}
      {addPanel && (
        <div onClick={() => setAddPanel(false)} style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#16191F', borderRadius: 18, width: '100%', maxWidth: 460, border: '1.5px solid #2A2D36', padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
              Adicionar Ferramental
              <button onClick={() => setAddPanel(false)} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>

            <div onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed #2A2D36', borderRadius: 12, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 16, overflow: 'hidden' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#00C896'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#2A2D36'}>
              {uploading ? <div style={{ color: '#6B7280', fontSize: 13 }}>Processando...</div>
                : preview ? <img src={preview} alt="preview" style={{ width: '100%', maxHeight: 180, objectFit: 'cover' }} />
                : <div style={{ textAlign: 'center', color: '#4B5563', padding: 20 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
                    <div style={{ fontSize: 13 }}>Clique para selecionar foto</div>
                  </div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />

            {[['Nome do Ferramental *','nome','Ex: Molde Painel Porta D/E'],['Código / Referência','codigo','Ex: FER-2024-001'],['Responsável','responsavel','Ex: João Silva']].map(([label, key, ph]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{label}</div>
                <input placeholder={ph} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
              </div>
            ))}

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Status Geral</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {Object.entries(STATUS_CONFIG).map(([key, st]) => (
                  <button key={key} onClick={() => setForm(f => ({ ...f, status: key }))}
                    style={{ flex: 1, background: form.status === key ? st.bg : 'transparent', border: `1.5px solid ${form.status === key ? st.color : '#2A2D36'}`, borderRadius: 10, padding: '8px 4px', cursor: 'pointer', color: form.status === key ? st.color : '#6B7280', fontSize: 11, fontWeight: form.status === key ? 700 : 400 }}>
                    {st.icon} {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10, fontWeight: 600 }}>Status por Máquina <span style={{ color: '#4B5563', fontWeight: 400 }}>(opcional)</span></div>
              <div style={{ background: '#0F1117', borderRadius: 12, padding: '14px 16px' }}>
                {MACHINES.map(m => (
                  <MachineRow key={m} machine={m} value={form[m]}
                    onChange={(machine, value) => setForm(f => ({ ...f, [machine]: value }))} />
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>Observações</div>
              <textarea placeholder="Informações adicionais..." value={form.obs}
                onChange={e => setForm(f => ({ ...f, obs: e.target.value }))}
                rows={2} style={{ ...inputStyle, resize: 'none' }} />
            </div>

            <button onClick={handleAdd} disabled={!form.nome.trim() || saving}
              style={{ width: '100%', background: (!form.nome.trim() || saving) ? '#2A2D36' : 'linear-gradient(135deg,#00C896,#0082FF)', border: 'none', borderRadius: 12, padding: '13px 0', color: (!form.nome.trim() || saving) ? '#4B5563' : '#fff', fontWeight: 700, fontSize: 14, cursor: (!form.nome.trim() || saving) ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Salvando...' : 'Salvar Ferramental'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
