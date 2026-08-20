# Control de Asistencia

App de escritorio (Electron + Angular 20 + PrimeNG) para marcar asistencia con foto y horario, con dos roles:

- **Colaborador**: marca ingreso/salida (con foto), ve un contador en vivo de cuánto tiempo lleva trabajando.
- **Auditor**: configura las horas mínimas requeridas por día/semana y ve alertas de los colaboradores que no las cumplen.

Los datos (usuarios, marcas, fotos) se guardan en [Supabase](https://supabase.com) (Postgres + Storage, plan gratuito), así que varias PCs pueden usar la app en paralelo y el auditor ve todo centralizado.

## 1. Crear el proyecto de Supabase

1. Crea una cuenta/proyecto gratis en https://supabase.com.
2. Ve a **SQL Editor** y ejecuta el contenido de [`supabase/schema.sql`](supabase/schema.sql). Esto crea las tablas (`profiles`, `work_hours_config`, `attendance_records`), el bucket de Storage `attendance-photos` y las políticas de RLS.
3. Ve a **Project Settings > API** y copia:
   - `Project URL`
   - `anon public` key

## 2. Configurar la app

Edita `src/environments/environment.ts` (build de producción) y `src/environments/environment.development.ts` (desarrollo) con tus valores:

```ts
export const environment = {
  production: true,
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabaseAnonKey: 'TU-ANON-KEY',
  attendancePhotosBucket: 'attendance-photos'
};
```

> La `anon key` está diseñada para ir embebida en clientes (web/desktop/mobile); la seguridad real la dan las políticas de RLS ya definidas en `schema.sql`, no el secreto de la key.

## 3. Instalar dependencias

```bash
npm install
```

## 4. Ejecutar en desarrollo

```bash
npm run electron:dev
```

Esto levanta `ng serve` y abre la ventana de Electron apuntando a `http://localhost:4200` con recarga en caliente.

## 5. Crear el primer auditor

1. Corre la app y entra a **Registrarse** para crear una cuenta (queda como `colaborador` por defecto).
2. En Supabase, ve a **SQL Editor** y promueve esa cuenta a auditor:

```sql
update public.profiles set role = 'auditor' where email = 'tu-correo@ejemplo.com';
```

3. Cierra sesión y vuelve a entrar en la app: ahora verás el panel de auditor, con un botón extra en la barra superior para "Marcar asistencia" (el auditor también marca su propia entrada/salida).

Las cuentas de colaboradores se crean igual, desde **Registrarse** dentro de la app.

## 6. Compilar el instalador de escritorio

```bash
npm run electron:dist
```

Genera el instalador de Windows (NSIS) en `release/App_Asistencia Setup X.X.X.exe` (o el nombre similar que muestre la consola al terminar).

## 7. Instalar en las computadoras de la empresa

Esta app se distribuye manualmente, no se publica en ningún lado público:

1. En tu máquina de desarrollo, corre `npm run electron:dist` (paso 6). Esto genera un único archivo `.exe` en la carpeta `release/`.
2. Copia ese `.exe` a la laptop del colaborador (USB, carpeta compartida de red, OneDrive, etc.). Debe ser una laptop de la empresa — no importa si el colaborador la usa en remoto, el control de dispositivos (ver nota abajo) es lo que valida esto, no la ubicación.
3. Ejecuta el instalador. **Windows probablemente muestre una advertencia de SmartScreen** ("Windows protegió su PC" / editor desconocido) porque el `.exe` no está firmado digitalmente — es normal, no significa que esté mal. Click en **"Más información"** → **"Ejecutar de todas formas"**.
4. No requiere Node, Angular ni nada adicional — es un instalador autocontenido.
5. Al abrir la app por primera vez, Windows pedirá permiso de **cámara** (y de **ubicación**, ver nota abajo) — hay que aceptarlo.
6. El colaborador usa **Registrarse** para crear su cuenta la primera vez, con su propio correo. No hace falta que tú crees las cuentas manualmente.
7. Ese primer login registra la laptop como "dispositivo pendiente" (ver nota abajo) — entra al panel de auditor y apruébalo desde **"Dispositivos pendientes de aprobación"** (no es obligatorio para que pueda marcar, pero conviene revisarlo).
8. Repite los pasos 2-7 por cada laptop/colaborador.
9. Si sacas una nueva versión más adelante, repites: `npm run electron:dist` → copiar el nuevo `.exe` → instalar encima (el instalador NSIS reemplaza la versión anterior, sin perder datos porque todo vive en Supabase).

No hace falta reconfigurar nada por PC: la URL/clave de Supabase ya queda compilada dentro del `.exe`, así que todas las instalaciones apuntan a la misma base de datos centralizada automáticamente.

## Notas

- La cámara se solicita con `getUserMedia` en el proceso de renderer; Electron pide permiso del sistema operativo la primera vez.
- El contador de horas trabajadas del colaborador se calcula desde la última marca de "ingreso" sin una "salida" posterior.
- Las alertas del auditor comparan las horas trabajadas (calculadas emparejando marcas de ingreso/salida por día) contra la meta configurada en **Configurar horas**. La alerta semanal solo se muestra desde el viernes en adelante, para no marcar en falso una semana que apenas comienza.
- El bucket `attendance-photos` es privado; solo el propio colaborador o un auditor pueden leer una foto (vía RLS), y la app no la muestra en ninguna pantalla — queda solo como respaldo por si hay que validar una marca.
- **Ubicación**: cada marca de ingreso/salida intenta capturar latitud/longitud (`AttendanceRecord.latitude/longitude`), visibles para el auditor como un link "Ver mapa" en el detalle del colaborador. Como la mayoría de laptops no tiene GPS, Windows la calcula por Wi-Fi/IP (Chromium's Network Location Provider) — es aproximada (a veces a nivel de ciudad), requiere internet y que **Configuración > Privacidad > Ubicación** esté activado en Windows. Si el usuario lo deniega o no está disponible, la marca se guarda igual sin ubicación (nunca bloquea el registro de asistencia).
- **Reconocimiento de dispositivos**: la primera vez que la app corre en una laptop, genera un ID aleatorio guardado en `%APPDATA%\<nombre de la app>\device-id.json` — fuera de la carpeta de instalación, así que copiar solo el `.exe` a otra laptop no copia esta identidad. Cada cuenta que marca desde un dispositivo nuevo aparece en el panel de auditor bajo **"Dispositivos pendientes de aprobación"**, con un botón para aprobarlo. Modo actual: **alerta, no bloqueo** — un dispositivo no aprobado igual puede marcar asistencia, solo queda señalado para que el auditor lo revise. No es infalible (nada del lado del cliente lo es), pero sí evita el caso más simple de "copiar el ejecutable a otra PC y ya".
- **Geocerca por ubicación de oficina**: decidido no implementarla — algunos colaboradores trabajan en remoto, así que restringir por radio de oficina generaría falsos positivos. El control de dispositivos es la validación principal de "laptop de la empresa".
- **Cierre automático de salida (6pm)**: si alguien se olvida de marcar salida, un job programado (`pg_cron`, dentro de Supabase Postgres — corre en el servidor, no depende de que la laptop esté prendida) revisa todos los días a las **11:59pm** hora Perú quién quedó con el ingreso abierto, y le inserta una salida automática con hora **18:00** (no la hora real a la que corrió el job), marcada como `auto_closed` (se ve como una etiqueta "Auto 18:00" en el detalle del colaborador). Correr el chequeo a las 11:59pm en vez de a las 6pm evita interrumpir a quien sigue trabajando después de esa hora — nadie tiene que volver a marcar ingreso a mitad de turno. Está en la sección 5 de `schema.sql`; se activa solo (no requiere configuración extra), pero si el proyecto de Supabase es nuevo puede que necesites habilitar la extensión `pg_cron` desde **Database → Extensions** en el dashboard antes de correr el script.
- **Cambiar contraseña**: cualquier usuario (colaborador o auditor) puede cambiar su contraseña desde el ícono de llave 🔑 en la barra superior. Pide la contraseña actual antes de aceptar la nueva (para que no baste con tener la sesión abierta en una laptop desatendida), y exige mínimo 8 caracteres.
