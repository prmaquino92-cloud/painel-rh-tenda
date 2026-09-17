export const PAPEL_LABEL = {
  coordenador: 'Coordenador',
  supervisor: 'Supervisor',
  gerente_comercial: 'Gerente Comercial',
  corretor: 'Corretor de Imóveis',
};
export const PAPEL_ORDEM = ['coordenador', 'supervisor', 'gerente_comercial', 'corretor'];

export const STATUS_CANDIDATO = {
  inscrito: { label: 'Inscrito', cls: 'pill-muted' },
  entrevista_agendada: { label: 'Entrevista agendada', cls: 'pill-info' },
  entrevistado: { label: 'Entrevistado', cls: 'pill-warning' },
  segunda_entrevista_agendada: { label: '2ª entrevista agendada', cls: 'pill-info' },
  aprovado: { label: 'Aprovado', cls: 'pill-success' },
  contratado: { label: 'Contratado', cls: 'pill-success' },
  declinado: { label: 'Reprovado/Declinado', cls: 'pill-danger' },
};

export const DIA_SEMANA_LABEL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const FEEDBACK_DECISAO = {
  aprovado: { label: 'Gerente aprovou', cls: 'pill-success' },
  reprovado: { label: 'Gerente reprovou', cls: 'pill-danger' },
};

export const STATUS_LEAD = {
  novo: { label: 'Novo · precisa ser tratado', cls: 'pill-warning' },
  sem_contato: { label: 'Sem contato', cls: 'pill-muted' },
  declinado: { label: 'Declinado', cls: 'pill-danger' },
  convertido: { label: 'Convertido em candidato', cls: 'pill-success' },
};

export function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function fmtData(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function hhmmToMin(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

// Data/hora "de parede" em São Paulo, agora. O Brasil não usa mais horário de verão, então o
// deslocamento de -3h é fixo o ano todo. É um Date cujos métodos UTC (getUTCHours, getUTCDay...)
// devem ser lidos como se já fossem os campos em horário de Brasília.
export function agoraSaoPaulo() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
}

export function diasUteisDisponiveis(diasSemana, count, startIso, incluirHoje) {
  const dias = [];
  const cur = startIso ? new Date(`${startIso}T00:00:00`) : agoraSaoPaulo();
  if (!incluirHoje) cur.setDate(cur.getDate() + 1);
  let guard = 0;
  while (dias.length < count && guard < 60) {
    guard++;
    const wd = cur.getDay();
    if (diasSemana.includes(wd)) {
      dias.push({
        iso: cur.toISOString().slice(0, 10),
        label: `${String(cur.getDate()).padStart(2, '0')}/${String(cur.getMonth() + 1).padStart(2, '0')}`,
        weekday: wd,
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dias;
}

export function gerarHorarios(inicio, fim) {
  const horarios = [];
  const [h1] = inicio.split(':').map(Number);
  const [h2] = fim.split(':').map(Number);
  for (let h = h1; h < h2; h++) {
    horarios.push(`${String(h).padStart(2, '0')}:00`);
    horarios.push(`${String(h).padStart(2, '0')}:30`);
  }
  return horarios;
}

// Verifica se um horário está bloqueado manualmente (independe de já estar ocupado por entrevista)
export function isSlotBloqueado(bloqueios, iso, hora) {
  const min = hhmmToMin(hora);
  const wd = new Date(`${iso}T00:00:00`).getDay();
  return bloqueios.some((b) => {
    const mesmaData = b.tipo === 'recorrente' ? b.dia_semana === wd : b.data === iso;
    if (!mesmaData) return false;
    return min >= hhmmToMin(b.inicio) && min < hhmmToMin(b.fim);
  });
}

export function gerarToken(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${(prefix || 'tok').slice(0, 3)}-${rand}`;
}
