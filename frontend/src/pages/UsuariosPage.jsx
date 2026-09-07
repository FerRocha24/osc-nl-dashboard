import Header from "../components/Header";
import AdminUsuarios from "../components/AdminUsuarios";
import { tieneRol } from "../api/auth";
import "./Pages.css";

/**
 * Pantalla de administración de cuentas, fuera de las dos vistas del tablero.
 *
 * El acceso se comprueba también aquí, y no solo escondiendo el enlace del menú:
 * la ruta se puede escribir a mano. El backend igual rechaza a quien no es
 * administrador; esto evita la pantalla rota con un error de permisos.
 */
export default function UsuariosPage() {
  const esAdmin = tieneRol("admin");

  return (
    <div className="page">
      <Header />

      <main className="page__content">
        <section className="page__section-title">
          <h2>Usuarios del tablero</h2>
        </section>

        {esAdmin ? (
          <AdminUsuarios />
        ) : (
          <p className="page__sin-permiso">
            Solo las cuentas de administrador pueden ver y modificar los usuarios
            del tablero.
          </p>
        )}
      </main>
    </div>
  );
}
