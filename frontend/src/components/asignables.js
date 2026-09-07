/**
 * Cuentas a las que se puede asignar una organización.
 *
 * Solo quien puede revisar: el rol Consulta es de solo lectura, así que
 * asignarle un expediente le daría trabajo que no puede atender. El backend
 * aplica la misma regla en osc-asignar.php; esta copia solo evita ofrecer en
 * pantalla algo que el servidor va a rechazar.
 */
export function cuentasAsignables(usuarios = []) {
  return usuarios.filter((u) => u.activo && (u.rol === "admin" || u.rol === "revisor"));
}
