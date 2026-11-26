# Fotos · Nombramientos 2027

Progreso en vivo de las fotos de nombramientos de la Iglesia Sabanagrande Central.
Página estática (GitHub Pages) + Firebase (Authentication y Realtime Database).

La lista de nombres **no está en este repositorio**: vive en Firebase y solo se puede
leer después de iniciar sesión.

## Archivos

- `index.html`, `styles.css`, `app.js` — la página.
- `config.js` — configuración pública de Firebase y dominio del usuario.
- `database.rules.json` — reglas de seguridad para pegar en Firebase.

## Configurar Firebase

1. **Authentication → Comenzar → Correo electrónico/contraseña → Habilitar → Guardar.**
2. **Authentication → Usuarios → Agregar usuario**
   - Correo: `fotos@decom.local`
   - Contraseña: la que quieras compartir con el equipo (mínimo 6 caracteres).
3. **Authentication → Configuración → Acciones del usuario**: desmarca *Habilitar creación (registro)*.
4. **Realtime Database → Datos → ⋮ → Importar JSON**: sube `personas.json` (se genera aparte, no se sube al repo).
5. **Realtime Database → Reglas**: pega `database.rules.json` → **Publicar**.

En la página se entra con usuario `decom` y la contraseña del paso 2.

## Reiniciar el conteo

Firebase → Realtime Database → Datos → borra el nodo `fotos` (no borres `personas`).
