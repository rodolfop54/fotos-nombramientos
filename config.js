// Configuración de Firebase (Realtime Database).
// Pega aquí el objeto que te da Firebase en:
//   Configuración del proyecto → Tus apps → App web → firebaseConfig
// Estos valores no son secretos: identifican el proyecto. La seguridad
// la ponen las reglas de la base de datos (database.rules.json).
//
// Si lo dejas en null la página funciona en "modo local" (solo este navegador).
export const firebaseConfig = {
  apiKey: "AIzaSyBIXlBcw6p0lC5NTxp3luKpFyr5k8kTq5s",
  authDomain: "fotos-nombramientos.firebaseapp.com",
  databaseURL: "https://fotos-nombramientos-default-rtdb.firebaseio.com",
  projectId: "fotos-nombramientos",
  storageBucket: "fotos-nombramientos.firebasestorage.app",
  messagingSenderId: "148953482924",
  appId: "1:148953482924:web:400b46ea6c7a5b37ad8109",
};

// Al iniciar sesión se escribe solo el usuario (por ejemplo "fotos");
// la página le agrega este dominio para formar el correo que usa Firebase.
export const USER_DOMAIN = "decom.local";
