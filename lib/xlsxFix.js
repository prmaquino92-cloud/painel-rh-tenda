import { inflateRawSync, deflateRawSync } from 'zlib';

// Alguns exportadores de .xlsx (não o Excel nem o LibreOffice — algum gerador de planilha
// programático, provavelmente o mesmo que gera o "modelo-leads-preenchido.xlsx") escrevem o XML
// interno das planilhas com o namespace principal (schemas.openxmlformats.org/.../main) como
// prefixo "x:" em vez de namespace padrão (ex.: "<x:row>" em vez de "<row>"). O arquivo é um
// .xlsx XML-válido, mas a biblioteca 'xlsx' (SheetJS) que usamos pra importar planilhas não
// reconhece as tags prefixadas ao montar a planilha — ela lê o workbook (nomes das abas) só que
// monta cada aba com zero linhas, sem erro nenhum (silencioso: "Nenhuma linha válida
// encontrada"). Essa função detecta esse padrão e, só quando ele aparece, reescreve as partes
// XML do .xlsx removendo o prefixo "x:" antes de entregar pro XLSX.read. Arquivos normais
// (Excel, LibreOffice, Google Sheets) não têm esse prefixo e passam por aqui sem nenhuma
// alteração.

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let acc = n;
    for (let k = 0; k < 8; k++) acc = acc & 1 ? 0xedb88320 ^ (acc >>> 1) : acc >>> 1;
    table[n] = acc >>> 0;
  }
  return table;
})();

function readZipEntries(buf) {
  const EOCD_SIG = 0x06054b50;
  let eocdOffset = -1;
  const minScan = Math.max(0, buf.length - 22 - 65557);
  for (let i = buf.length - 22; i >= minScan; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('EOCD não encontrado — zip inválido');

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('entrada de diretório central inválida');
    const versionMadeBy = buf.readUInt16LE(p + 4);
    const method = buf.readUInt16LE(p + 10);
    const modTime = buf.readUInt16LE(p + 12);
    const modDate = buf.readUInt16LE(p + 14);
    const crc = buf.readUInt32LE(p + 16);
    const compSize = buf.readUInt32LE(p + 20);
    const uncompSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const extAttr = buf.readUInt32LE(p + 38);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p = p + 46 + nameLen + extraLen + commentLen;

    const lp = localOffset;
    if (buf.readUInt32LE(lp) !== 0x04034b50) throw new Error('cabeçalho local inválido');
    const lNameLen = buf.readUInt16LE(lp + 26);
    const lExtraLen = buf.readUInt16LE(lp + 28);
    const dataStart = lp + 30 + lNameLen + lExtraLen;
    const dataRaw = buf.subarray(dataStart, dataStart + compSize);

    entries.push({ name, method, modTime, modDate, crc, uncompSize, extAttr, versionMadeBy, dataRaw });
  }
  return entries;
}

function decompressEntry(entry) {
  if (entry.method === 0) return Buffer.from(entry.dataRaw);
  if (entry.method === 8) return inflateRawSync(entry.dataRaw);
  throw new Error('método de compressão não suportado: ' + entry.method);
}

function writeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(e.method, 8);
    localHeader.writeUInt16LE(e.modTime, 10);
    localHeader.writeUInt16LE(e.modDate, 12);
    localHeader.writeUInt32LE(e.crc, 14);
    localHeader.writeUInt32LE(e.dataRaw.length, 18);
    localHeader.writeUInt32LE(e.uncompSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localOffset = offset;
    localParts.push(localHeader, nameBuf, e.dataRaw);
    offset += localHeader.length + nameBuf.length + e.dataRaw.length;

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(e.versionMadeBy || 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(e.method, 10);
    central.writeUInt16LE(e.modTime, 12);
    central.writeUInt16LE(e.modDate, 14);
    central.writeUInt32LE(e.crc, 16);
    central.writeUInt32LE(e.dataRaw.length, 20);
    central.writeUInt32LE(e.uncompSize, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(e.extAttr || 0, 38);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, nameBuf);
  }

  const centralDir = Buffer.concat(centralParts);
  const cdOffset = offset;
  const cdSize = centralDir.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

// Diagnóstico temporário — não mexe em nada, só inspeciona e devolve um resumo legível
// (nomes de entrada, tamanhos, se bateu o regex do prefixo "x:", erro de descompressão se
// houver, e um preview de texto de até 300 caracteres pra cada entrada xml/rels relevante).
// Criada pra investigar por que o buffer "corrigido" gerado em produção (Vercel) fica
// diferente do gerado localmente com o mesmo código-fonte. Remover depois de achar a causa.
function debugInspecionar(buf) {
  const resumo = { nodeVersion: process.version, tamanho: buf.length };
  let entries;
  try {
    entries = readZipEntries(buf);
  } catch (e) {
    resumo.readZipEntriesError = e.message;
    return resumo;
  }
  resumo.entryCount = entries.length;
  resumo.entries = entries.map((e) => {
    const info = { name: e.name, method: e.method, compSize: e.dataRaw.length, uncompSize: e.uncompSize };
    if (!/\.(xml|rels)$/i.test(e.name)) return info;
    let raw;
    try {
      raw = decompressEntry(e);
    } catch (eDecomp) {
      info.decompressError = eDecomp.message;
      return info;
    }
    const text = raw.toString('utf8');
    info.decompressedLen = text.length;
    info.matchedRegex = /<x:|xmlns:x="/.test(text);
    if (e.name === 'xl/worksheets/sheet1.xml' || e.name === 'xl/workbook.xml') {
      info.preview = text.slice(0, 300);
    }
    return info;
  });
  return resumo;
}

function normalizarXlsxNamespacePrefixado(buf) {
  let entries;
  try {
    entries = readZipEntries(buf);
  } catch {
    // não é um zip bem-formado do jeito que sabemos ler — devolve como veio e deixa o
    // XLSX.read tentar (e, se for o caso, falhar com o erro de sempre)
    return buf;
  }

  let mudou = false;
  const newEntries = entries.map((e) => {
    if (!/\.(xml|rels)$/i.test(e.name)) return e;
    let raw;
    try {
      raw = decompressEntry(e);
    } catch {
      return e;
    }
    const text = raw.toString('utf8');
    if (!/<x:|xmlns:x="/.test(text)) return e;
    mudou = true;
    const fixed = text.replace(/xmlns:x="/g, 'xmlns="').replace(/<\/?x:/g, (m) => m.replace('x:', ''));
    const fixedBuf = Buffer.from(fixed, 'utf8');
    const compressed = deflateRawSync(fixedBuf, { level: 6 });
    return { ...e, dataRaw: compressed, uncompSize: fixedBuf.length, crc: crc32(fixedBuf), method: 8 };
  });

  if (!mudou) return buf;
  try {
    return writeZip(newEntries);
  } catch {
    return buf;
  }
}

export { normalizarXlsxNamespacePrefixado, debugInspecionar };
