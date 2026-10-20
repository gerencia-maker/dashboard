/**
 * Check-list de recetas — puente entre la página web (GitHub Pages) y esta hoja de Google.
 *
 * Pegar este código en: Extensiones > Apps Script (desde la hoja de Google).
 * Luego: Implementar > Nueva implementación > Tipo: Aplicación web
 *        Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier persona
 * Copiar la URL que termina en /exec y ponerla en config.js del repositorio.
 */

const HOJA = 'Checklist';
const HOJA_HISTORIAL = 'Historial';
const ZONA = 'America/Bogota';

// Encabezados que se buscan en la fila 1 (por el inicio del texto).
const CAMPOS = {
  id: 'ID', sec: 'Sección', cod: 'Código', rec: 'Receta', cat: 'Categoría',
  ing: 'Ingredientes', und: 'Unidades', alerta: 'Alerta', preg: 'Pregunta',
  chk: 'Revisada', rev: 'Revisó', obs: 'Observaciones', upd: 'Actualizado'
};
const EDITABLES = { chk: 'Revisada', rev: 'Revisó', obs: 'Observaciones' };

function doGet() {
  try {
    prepararHoja_();
    return json_({ ok: true, rows: leerTodo_(), serverTime: ahora_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const id = String(body.id || '').trim();
    const quien = limpiar_(body.who, 40) || 'Sin nombre';
    const cambios = body.fields || {};
    if (!id) return json_({ ok: false, error: 'Falta el ID' });

    const sh = hoja_();
    const idx = indices_(sh);
    const ultima = sh.getLastRow();
    const ids = sh.getRange(2, idx.id + 1, ultima - 1, 1).getValues().map(r => String(r[0]));
    const pos = ids.indexOf(id);
    if (pos < 0) return json_({ ok: false, error: 'No encontré el ID ' + id });
    const fila = pos + 2;

    const rango = sh.getRange(fila, 1, 1, sh.getLastColumn());
    const valores = rango.getValues()[0];
    const historial = [];
    const marca = ahora_();

    Object.keys(EDITABLES).forEach(k => {
      if (!(k in cambios)) return;
      let nuevo = cambios[k];
      if (k === 'chk') nuevo = nuevo === true || nuevo === 'true';
      else nuevo = limpiar_(nuevo, k === 'obs' ? 3000 : 40);
      const antes = valores[idx[k]];
      const igual = k === 'chk' ? (antes === true) === nuevo : String(antes) === String(nuevo);
      if (igual) return;
      sh.getRange(fila, idx[k] + 1).setValue(nuevo);
      valores[idx[k]] = nuevo;
      historial.push([marca, id, String(valores[idx.cod]), String(valores[idx.rec]), EDITABLES[k],
        k === 'chk' ? (antes === true ? 'Sí' : 'No') : antes,
        k === 'chk' ? (nuevo ? 'Sí' : 'No') : nuevo, quien]);
    });

    if (historial.length) {
      const upd = marca + ' · ' + quien;
      sh.getRange(fila, idx.upd + 1).setValue(upd);
      valores[idx.upd] = upd;
      const h = hojaHistorial_();
      h.getRange(h.getLastRow() + 1, 1, historial.length, historial[0].length).setValues(historial);
    }
    return json_({ ok: true, row: aObjeto_(valores, idx), changed: historial.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/* ---------- utilidades ---------- */

function leerTodo_() {
  const sh = hoja_();
  const idx = indices_(sh);
  const datos = sh.getDataRange().getValues().slice(1);
  return datos.filter(r => String(r[idx.id]).trim()).map(r => aObjeto_(r, idx));
}

function aObjeto_(r, idx) {
  const o = {};
  Object.keys(CAMPOS).forEach(k => {
    const v = idx[k] >= 0 ? r[idx[k]] : '';
    o[k] = k === 'chk' ? v === true : (v instanceof Date ? Utilities.formatDate(v, ZONA, 'yyyy-MM-dd HH:mm') : v);
  });
  return o;
}

function indices_(sh) {
  const enc = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const idx = {};
  Object.keys(CAMPOS).forEach(k => { idx[k] = enc.findIndex(h => h.indexOf(CAMPOS[k]) === 0); });
  ['id', 'chk', 'rev', 'obs', 'upd'].forEach(k => {
    if (idx[k] < 0) throw new Error('Falta la columna «' + CAMPOS[k] + '» en la hoja ' + HOJA);
  });
  return idx;
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

// Una sola vez: convierte la columna «Revisada» en casillas de verificación.
function prepararHoja_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('preparada') === '1') return;
  const sh = hoja_();
  const idx = indices_(sh);
  const n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, idx.chk + 1, n, 1).insertCheckboxes();
  hojaHistorial_();
  props.setProperty('preparada', '1');
}

// Para correr a mano desde el editor la primera vez (autoriza permisos y prepara la hoja).
function probar() {
  prepararHoja_();
  Logger.log('Filas leídas: ' + leerTodo_().length);
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
