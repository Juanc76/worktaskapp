/**
 * Representa todos los campos del formulario de registro.
 * Los campos comunes son requeridos para todos los tipos de usuario.
 * Los campos opcionales aplican según el tipo de usuario seleccionado:
 *   - Nivel Central (1):         equipoTrabajo, grupoTrabajo, cargo
 *   - Gestor Territorial (2):    equipoTrabajo
 *   - Institución Educativa (3): localidad, colegio
 *   - Interventoría (5):         tercero (firma interventora), grupoTrabajo
 *   - Operador Logístico (6):    tercero (operador logístico)
 *   - Proveedor Alimentos (7):   tercero (proveedor de alimentos)
 *   - Proveedor Transporte (8/9/10): tercero (proveedor de transporte)
 */
export interface RegistroFormDTO {
  // ── Bloque 1: Acceso ──────────────────────────────────────
  email: string;
  emailConfirm: string;
  password: string;
  passwordConfirm: string;

  // ── Bloque 2: Información Personal ───────────────────────
  nombres: string;
  apellidos: string;
  tipoIdentificacion: number;
  identificacion: number;
  telefono: number;

  // ── Bloque 3: Caracterización del Usuario ────────────────
  tipoUsuario: number;

  // Nivel Central (tipo 1)
  equipoTrabajo?: number | null;
  grupoTrabajo?: number | null;
  cargo?: number | null;

  // Institución Educativa (tipo 3)
  localidad?: number | null;
  colegio?: number | null;

  // Interventoría (5) / Operador Logístico (6) / Proveedor Alimentos (7) / Proveedor Transporte (8,9,10)
  tercero?: number | null;
}

export interface RegistroResponseDTO {
  status: string;
  message: string;
}

export interface RegistroErrorResponseDTO {
  status: string;
  message: string;
}

export interface TiposDocumento{
  key: number;
  label: string;
}

export interface TiposUsuario{
  key: number;
  label: string;
}

export interface EquiposTrabajo{
  key: number;
  label: string;
}

export interface Localidades{
  key: number;
  label: string;
}

export interface Cargos{
  key: number;
  label: string;
}

export interface Colegios{
  key: number;
  label: string;
  group: string;
}

export interface GruposTrabajo{
  key: number;
  label: string;
  group: string;
}

export interface Terceros{
  key: number;
  label: string;
  group: string;
}