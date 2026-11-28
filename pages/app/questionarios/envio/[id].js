import Link from 'next/link';
import Layout from '../../../../components/Layout';
import { numerarPerguntas } from '../../../../components/QuestionarioCampos';
import { requireUsuario, bloquearSeNaoForAdmin } from '../../../../lib/sessaoUsuario';
import { getUnidade } from '../../../../lib/data';
import { getEnvio } from '../../../../lib/questionariosServer';
import { formatarResposta } from '../../../../lib/questionarios';
import { supabaseAdmin } from '../../../../lib/supabase';
import { PAPEL_LABEL } from '../../../../lib/domain';

function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// Respostas de um gerente, na íntegra, num formato que dá pra imprimir ou salvar em PDF.
export default function EnvioRespostas({ envio, gerente, unidadeNome, usuario }) {
  const perguntas = numerarPerguntas(envio.perguntas || []);
  const titulo = envio.questionarios?.titulo || 'Questionário';
  return (
    <Layout active="questionarios" crumb={`Questionários · ${titulo}`} title={gerente?.nome || 'Respostas'} usuario={usuario}>
      <div className="toolbar" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Link href={`/app/questionarios/${envio.questionario_id}`} className="btn btn-ghost btn-sm">
          ← Voltar ao questionário
        </Link>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()}>
          Imprimir / salvar PDF
        </button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-pad">
          <div className="kicker">{titulo}</div>
          <h2 style={{ margin: '4px 0' }}>{gerente?.nome || 'Gerente'}</h2>
          <p className="row-sub">
            {[gerente ? PAPEL_LABEL[gerente.papel] : null, unidadeNome, envio.status === 'respondido' ? `Respondido em ${fmtData(envio.respondido_em)}` : 'Ainda não enviado (rascunho)', envio.origem === 'importado' ? 'respondido fora do painel e importado' : null]
              .filter(Boolean)
              .join(' · ')}
          </p>

          {perguntas.map((p) =>
            p.tipo === 'secao' ? (
              <h3 key={p.id} className="resp-secao">
                {p.titulo}
              </h3>
            ) : (
              <div key={p.id} className="resp-item">
                <b>
                  {p.numero}. {p.titulo}
                </b>
                <div className={formatarResposta(p, envio.respostas?.[p.id]) ? 'resp-texto' : 'resp-texto resp-vazia'}>
                  {formatarResposta(p, envio.respostas?.[p.id]) || 'sem resposta'}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <style jsx global>{`
        .resp-secao {
          margin: 24px 0 4px;
          padding-top: 12px;
          border-top: 2px solid var(--border);
          font-size: 15px;
        }
        .resp-item {
          margin: 14px 0;
          font-size: 13.3px;
        }
        .resp-texto {
          margin-top: 4px;
          white-space: pre-line;
          color: var(--ink);
        }
        .resp-vazia {
          color: var(--ink-faint);
          font-style: italic;
        }
        @media print {
          .sidebar,
          .topbar,
          .toolbar,
          .btn {
            display: none !important;
          }
        }
      `}</style>
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const { usuario, redirect } = await requireUsuario(context);
  if (!usuario) return { redirect };
  const bloqueio = bloquearSeNaoForAdmin(usuario);
  if (bloqueio) return bloqueio;
  const envio = await getEnvio(context.params.id);
  if (!envio) return { notFound: true };
  let gerente = null;
  if (envio.pessoa_id) {
    const { data } = await supabaseAdmin().from('pessoas').select('id,nome,papel,unidade_id').eq('id', envio.pessoa_id).maybeSingle();
    gerente = data;
  }
  const unidade = gerente?.unidade_id ? await getUnidade(gerente.unidade_id) : null;
  return { props: { envio, gerente, unidadeNome: unidade?.nome || null, usuario } };
}
