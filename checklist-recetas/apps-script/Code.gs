/**
 * Check-list de recetas — puente entre la página web (GitHub Pages) y esta hoja de Google.
 *
 * Pegar este código en: Extensiones > Apps Script (desde la hoja de Google).
 * Luego: Implementar > Nueva implementación > Tipo: Aplicación web
 *        Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario
 * Copiar la URL que termina en /exec y ponerla en config.js del repositorio.
 *
 * Cada persona da su propio visto bueno: una columna «VB Nombre» por persona.
 * Quien entra a la página con un nombre nuevo recibe su columna al marcar su
 * primera receta. También se puede agregar a mano una columna «VB Nombre».
 */

const HOJA = 'Checklist';
const HOJA_HISTORIAL = 'Historial';
const HOJA_RESUMEN = 'Resumen';
const ZONA = 'America/Bogota';
const VB = 'VB ';
// Quienes tienen que dar su visto bueno para que una receta quede completa. Quien se
// agregue después tiene su columna y su conteo, pero no frena el avance.
const REVISORES = ['Johann', 'Andrea', 'Néstor'];
const SECCIONES = ['Acopio', 'Cocina intermedia', 'Restaurantes', 'Preguntas para Andrea'];
const VERSION_HOJA = '2';

// Encabezados que se buscan en la fila 1 (por el inicio del texto).
const CAMPOS = {
  id: 'ID', sec: 'Sección', cod: 'Código', rec: 'Receta', cat: 'Categoría',
  ing: 'Ingredientes', und: 'Unidades', alerta: 'Alerta', preg: 'Pregunta',
  obs: 'Observaciones', upd: 'Actualizado'
};

function doGet() {
  try {
    prepararHoja_(false);
    const sh = hoja_();
    const cols = columnas_(sh);
    return json_({ ok: true, rows: leerTodo_(sh, cols), revisores: nombres_(cols), obligatorios: nombres_(obligatorios_(cols)), serverTime: ahora_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    prepararHoja_(true);
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const id = String(body.id || '').trim();
    const quien = limpiar_(body.who, 40) || 'Sin nombre';
    const cambios = body.fields || {};
    if (!id) return json_({ ok: false, error: 'Falta el ID' });

    const sh = hoja_();
    let cols = columnas_(sh);
    const fila = filaDe_(sh, cols, id);
    if (fila < 0) return json_({ ok: false, error: 'No encontré el ID ' + id });

    const historial = [];
    const marca = ahora_();

    // El visto bueno es siempre el de quien escribe: nadie marca la columna de otro.
    if ('vb' in cambios) {
      const nuevo = cambios.vb === true || cambios.vb === 'true';
      let rev = buscarRevisor_(cols, quien);
      if (!rev && nuevo) {
        agregarRevisor_(sh, cols, quien);
        cols = columnas_(sh);
        rev = buscarRevisor_(cols, quien);
      }
      if (rev) {
        const celda = sh.getRange(fila, rev.col + 1);
        const antes = celda.getValue() === true;
        if (antes !== nuevo) {
          celda.setValue(nuevo);
          historial.push(['Visto bueno ' + rev.nombre, antes ? 'Sí' : 'No', nuevo ? 'Sí' : 'No']);
        }
      }
    }

    if ('obs' in cambios) {
      const celda = sh.getRange(fila, cols.idx.obs + 1);
      const antes = celda.getValue();
      const nuevo = limpiar_(cambios.obs, 3000);
      if (String(antes) !== String(nuevo)) {
        celda.setValue(nuevo);
        historial.push(['Observaciones', antes, nuevo]);
      }
    }

    const valores = sh.getRange(fila, 1, 1, sh.getLastColumn()).getValues()[0];
    if (historial.length) {
      const upd = marca + ' · ' + quien;
      sh.getRange(fila, cols.idx.upd + 1).setValue(upd);
      valores[cols.idx.upd] = upd;
      const cod = String(valores[cols.idx.cod]), rec = String(valores[cols.idx.rec]);
      const h = hojaHistorial_();
      h.getRange(h.getLastRow() + 1, 1, historial.length, 8)
        .setValues(historial.map(x => [marca, id, cod, rec, x[0], x[1], x[2], quien]));
    }
    return json_({ ok: true, row: aObjeto_(valores, cols), revisores: nombres_(cols), obligatorios: nombres_(obligatorios_(cols)), changed: historial.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/* ---------- utilidades ---------- */

function leerTodo_(sh, cols) {
  const datos = sh.getDataRange().getValues().slice(1);
  return datos.filter(r => String(r[cols.idx.id]).trim()).map(r => aObjeto_(r, cols));
}

function aObjeto_(r, cols) {
  const o = {};
  Object.keys(CAMPOS).forEach(k => {
    const v = cols.idx[k] >= 0 ? r[cols.idx[k]] : '';
    o[k] = v instanceof Date ? Utilities.formatDate(v, ZONA, 'yyyy-MM-dd HH:mm') : v;
  });
  o.vb = {};
  cols.vb.forEach(v => { o.vb[v.nombre] = r[v.col] === true; });
  return o;
}

function encabezados_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
}

// Dónde está cada campo, y una entrada por cada columna «VB Nombre».
function columnas_(sh) {
  const enc = encabezados_(sh);
  const idx = {};
  Object.keys(CAMPOS).forEach(k => { idx[k] = enc.findIndex(h => h.indexOf(CAMPOS[k]) === 0); });
  ['id', 'sec', 'obs', 'upd'].forEach(k => {
    if (idx[k] < 0) throw new Error('Falta la columna «' + CAMPOS[k] + '» en la hoja ' + HOJA);
  });
  const vb = [];
  enc.forEach((h, i) => { if (h.indexOf(VB) === 0 && h.length > VB.length) vb.push({ nombre: h.slice(VB.length).trim(), col: i }); });
  return { idx: idx, vb: vb };
}

function nombres_(vbs) { return (vbs.vb || vbs).map(v => v.nombre); }

// Las columnas de las personas de REVISORES: sin todas ellas, la receta no está completa.
function obligatorios_(cols) {
  return cols.vb.filter(v => REVISORES.some(n => clave_(n) === clave_(v.nombre)));
}

// «nestor» y «Néstor» son la misma persona.
function clave_(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function buscarRevisor_(cols, nombre) {
  const k = clave_(nombre);
  return cols.vb.find(v => clave_(v.nombre) === k) || null;
}

// Una columna «VB Nombre» nueva, al lado de las demás y con casillas.
function agregarRevisor_(sh, cols, nombre) {
  let col;
  if (cols.vb.length) {
    const ultima = cols.vb[cols.vb.length - 1].col + 1;
    sh.insertColumnAfter(ultima);
    col = ultima + 1;
  } else {
    col = cols.idx.obs + 1;
    sh.insertColumnBefore(col);
  }
  sh.getRange(1, col).setValue(VB + nombre);
  const n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, col, n, 1).insertCheckboxes();
  sh.setColumnWidth(col, 90);
  armarResumen_();
}

function filaDe_(sh, cols, id) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return -1;
  const ids = sh.getRange(2, cols.idx.id + 1, n, 1).getValues().map(r => String(r[0]));
  const pos = ids.indexOf(id);
  return pos < 0 ? -1 : pos + 2;
}

function hoja_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(HOJA);
  if (!sh) throw new Error('No existe la pestaña ' + HOJA);
  return sh;
}

function hojaHistorial_() {
  const ss = SpreadsheetApp.getActive();
  let h = ss.getSheetByName(HOJA_HISTORIAL);
  if (!h) {
    h = ss.insertSheet(HOJA_HISTORIAL);
    h.appendRow(['Fecha', 'ID', 'Código', 'Receta', 'Campo', 'Antes', 'Después', 'Quién']);
    h.setFrozenRows(1);
  }
  return h;
}

// Pone la hoja al día una sola vez por versión (la 2 trae una columna de visto bueno por persona).
function prepararHoja_(conLock) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('version') === VERSION_HOJA) return;
  const lock = conLock ? null : LockService.getScriptLock();
  if (lock) lock.waitLock(20000);
  try {
    if (props.getProperty('version') === VERSION_HOJA) return;
    pasarAVistosBuenos_(hoja_());
    hojaHistorial_();
    armarResumen_();
    props.setProperty('version', VERSION_HOJA);
  } finally {
    if (lock) lock.releaseLock();
  }
}

// De «Revisada» + «Revisó» (una casilla para todos) a una columna «VB Nombre» por persona.
// Lo que ya estaba marcado queda como visto bueno de quien lo marcó.
function pasarAVistosBuenos_(sh) {
  const n = sh.getLastRow() - 1;
  let enc = encabezados_(sh);
  if (!enc.some(h => h.indexOf(VB) === 0)) {
    const iRev = enc.findIndex(h => h.indexOf('Revisada') === 0);
    const col = (iRev >= 0 ? iRev : columnas_(sh).idx.obs) + 1;
    sh.insertColumnsBefore(col, REVISORES.length);
    sh.getRange(1, col, 1, REVISORES.length).setValues([REVISORES.map(x => VB + x)]);
    enc = encabezados_(sh);
  }
  let cols = columnas_(sh);
  const iRev = enc.findIndex(h => h.indexOf('Revisada') === 0);
  const iQuien = enc.findIndex(h => h.indexOf('Revisó') === 0);
  if (iRev >= 0 && n > 0) {
    const marcas = sh.getRange(2, iRev + 1, n, 1).getValues();
    const quienes = iQuien >= 0 ? sh.getRange(2, iQuien + 1, n, 1).getValues() : marcas.map(() => ['']);
    marcas.forEach((m, i) => {
      if (m[0] !== true) return;
      const nombre = String(quienes[i][0] || '').trim() || 'Sin nombre';
      let rev = buscarRevisor_(cols, nombre);
      if (!rev) {
        agregarRevisor_(sh, cols, nombre);
        cols = columnas_(sh);
        rev = buscarRevisor_(cols, nombre);
      }
      sh.getRange(i + 2, rev.col + 1).setValue(true);
    });
  }
  // Las columnas viejas se quitan: lo que tenían ya quedó en las de cada persona.
  enc = encabezados_(sh);
  [enc.findIndex(h => h.indexOf('Revisó') === 0), enc.findIndex(h => h.indexOf('Revisada') === 0)]
    .filter(i => i >= 0).sort((a, b) => b - a).forEach(i => sh.deleteColumn(i + 1));
  cols = columnas_(sh);
  if (n > 0) cols.vb.forEach(v => sh.getRange(2, v.col + 1, n, 1).insertCheckboxes());
}

// La pestaña Resumen, con una columna por persona. Se rehace cuando entra alguien nuevo.
function armarResumen_() {
  const ss = SpreadsheetApp.getActive();
  const cols = columnas_(hoja_());
  const rs = ss.getSheetByName(HOJA_RESUMEN) || ss.insertSheet(HOJA_RESUMEN);
  rs.clear();
  const rango = i => HOJA + '!' + letra_(i) + ':' + letra_(i);
  const sec = rango(cols.idx.sec);
  const obl = obligatorios_(cols);
  const head = ['Sección', 'Recetas'].concat(cols.vb.map(v => VB + v.nombre), ['Completas (' + nombres_(obl).join(', ') + ')', 'Avance']);
  rs.getRange(1, 1).setValue('Check-list de recetas · El Rancherito').setFontWeight('bold').setFontSize(14);
  rs.getRange(2, 1).setValue('Se llena sola desde la página web. No cambies los encabezados de «Checklist» ni la columna ID.');
  rs.getRange(4, 1, 1, head.length).setValues([head]).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#2B4A3A');
  const filas = SECCIONES.map((s, i) => {
    const r = 5 + i;
    const todos = obl.map(v => ',' + rango(v.col) + ',TRUE').join('');
    return [s, '=COUNTIF(' + sec + ',A' + r + ')']
      .concat(cols.vb.map(v => '=COUNTIFS(' + sec + ',A' + r + ',' + rango(v.col) + ',TRUE)'))
      .concat(['=COUNTIFS(' + sec + ',A' + r + todos + ')', '=IFERROR(' + letra_(head.length - 2) + r + '/B' + r + ',0)']);
  });
  rs.getRange(5, 1, filas.length, head.length).setValues(filas);
  rs.getRange(5, head.length, filas.length, 1).setNumberFormat('0%');
  rs.setColumnWidth(1, 190);
}

function letra_(i) {
  let s = '', n = i + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// Para correr a mano desde el editor (autoriza permisos y pone la hoja al día).
function probar() {
  prepararHoja_(false);
  const sh = hoja_();
  const cols = columnas_(sh);
  Logger.log('Filas leídas: ' + leerTodo_(sh, cols).length + ' · Vistos buenos: ' + nombres_(cols).join(', '));
}

function limpiar_(v, max) {
  let s = String(v == null ? '' : v).slice(0, max).trim();
  if (/^[=+\-@]/.test(s)) s = "'" + s; // evita que un texto se vuelva fórmula
  return s;
}

function ahora_() { return Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm'); }

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
