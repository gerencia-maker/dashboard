# Check-list de recetas

Página web (GitHub Pages) donde el equipo marca las recetas revisadas, anota quién revisó y deja observaciones.
Todo se guarda en una **hoja de Google** (pestaña `Checklist`), con un registro de cada cambio en la pestaña `Historial`.

```
Página (GitHub Pages)  ──►  Apps Script (aplicación web)  ──►  Hoja de Google
   index.html                 apps-script/Code.gs              Checklist · Historial · Resumen
```

Los datos de las recetas **no** están en este repositorio: la página los lee de la hoja cada vez que se abre.

## Puesta en marcha (una sola vez)

1. **Hoja de Google.** Sube `checklist-recetas-el-rancherito.xlsx` a Google Drive y ábrelo con Hojas de cálculo de Google
   (si se abre como Excel: *Archivo › Guardar como Hojas de cálculo de Google*).
2. **Apps Script.** En la hoja: *Extensiones › Apps Script*. Borra lo que haya, pega el contenido de `apps-script/Code.gs` y guarda.
   - Arriba elige la función `probar` y dale *Ejecutar* → acepta los permisos (es tu propia cuenta).
3. **Publicar el script.** *Implementar › Nueva implementación* → engranaje › *Aplicación web*:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
   - Copia la URL que termina en `/exec`.
4. **Conectar la página.** Edita `config.js` en este repositorio y pega la URL en `SCRIPT_URL`.
5. **Link para compartir** (GitHub Pages del repo `dashboard`):
   `https://gerencia-maker.github.io/dashboard/checklist-recetas/`.

## Uso

- Al entrar, cada persona elige su nombre (queda guardado en su navegador).
- Cada persona da su propio visto bueno: en la hoja hay una columna «VB Nombre» por persona
  (Johann, Andrea, Néstor) y en la página cada quien solo puede marcar la suya.
- Una receta está completa cuando tiene el visto bueno de los tres (`REVISORES` en `Code.gs`).
  Quien entra con otro nombre recibe su propia columna al marcar su primera receta; se ve y se
  cuenta, pero no frena el avance.
- Las observaciones se guardan solas al dejar de escribir.
- La página trae los cambios de los demás cada 45 segundos.
- En la hoja de Google se puede filtrar, exportar o marcar directamente; la página lo refleja.

## Si cambias el script

Después de editar `Code.gs`: *Implementar › Gestionar implementaciones › editar › Versión: nueva*. Así la URL no cambia.

## Seguridad

La URL `/exec` permite leer y editar solo las columnas Revisada, Revisó y Observaciones de la pestaña `Checklist`.
Quien tenga el link de la página puede verla. No compartas el link fuera del equipo.
