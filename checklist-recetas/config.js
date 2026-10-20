// URL de la aplicación web de Apps Script (termina en /exec).
// Se obtiene en la hoja de Google: Extensiones > Apps Script > Implementar > Nueva implementación > Aplicación web.
window.CHECKLIST_CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz_SkxaCSmL_CxXtjShz-rQQsuYeDgIEhZuieDJovYsJagFWdnsIYMloxJg9EwYA-In/exec',
  // Nombres que salen en «¿Quién eres?». Cada uno tiene su columna «VB Nombre» en la hoja.
  REVISORES: ['Johann', 'Andrea', 'Néstor'],
  // Cada cuántos segundos se traen los cambios de los demás
  REFRESCO_SEG: 45
};
