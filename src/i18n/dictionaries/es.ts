// Español (neutro, para Argentina y el resto de Latinoamérica).
import type { Dictionary } from "../types";

export const es: Dictionary = {
  // App
  "app.connectError.title": "No se pudo abrir la aplicación",
  "app.connectError.message": "Abre Atacarejo desde el administrador de Tiendanube, en Mis aplicaciones.",

  // ErrorState
  "errorState.title": "No se pudo cargar la información",
  "errorState.message": "Puede ser una falla momentánea. Vuelve a intentarlo en unos instantes.",
  "errorState.retry": "Reintentar",
  "errorState.support": "Si el problema continúa, escríbenos a:",

  // HomePage
  "home.title": "Definir precios mayoristas",
  "home.subtitle.withMin":
    "El descuento se aplica cuando el carrito tiene {count} o más unidades con precio mayorista.",
  "home.subtitle.noMin": "El descuento se aplica cuando el carrito alcanza la cantidad mínima mayorista.",
  "home.configure": "Configurar",
  "home.save": "Guardar",
  "home.saveCount": "Guardar ({count})",
  "home.search.label": "Buscar productos",
  "home.search.placeholder": "Buscar por nombre o SKU",
  "home.setupPending.title": "Falta completar la configuración",
  "home.setupPending.text":
    "La promoción mayorista todavía no se creó en tu tienda, por eso el descuento no aparece en el carrito.",
  "home.setupPending.action": "Completar configuración",
  "home.onboarding.title": "Empieza definiendo los precios mayoristas",
  "home.onboarding.text":
    "Ingresa el precio mayorista en las variantes que quieres vender al por mayor y haz clic en Guardar. Cuando el carrito tenga {count} o más unidades de esos productos, el descuento se aplica automáticamente, sin cupón.",
  "home.invalidPrice":
    "Usa solo números con hasta 2 decimales, como {example}. Para quitar el precio mayorista, deja el campo vacío.",
  "home.empty.search.title": "No se encontraron productos",
  "home.empty.search.text": "Revisa el término buscado o borra la búsqueda para ver todos los productos.",
  "home.empty.search.action": "Borrar búsqueda",
  "home.empty.store.title": "Tu tienda todavía no tiene productos",
  "home.empty.store.text":
    "Agrega productos en el administrador de Tiendanube y vuelve aquí para definir los precios mayoristas.",
  "home.empty.store.action": "Agregar producto",
  "home.table.product": "Producto",
  "home.table.variant": "Variante",
  "home.table.price": "Precio",
  "home.table.wholesalePrice": "Precio mayorista",
  "home.applyToAll": "Repetir en todas las variantes",
  "home.priceInput.label": "Precio mayorista de {product} {variant}",
  "home.toast.saved": "Precios mayoristas guardados",
  "home.toast.saveError": "No se pudieron guardar los precios",
  "home.toast.setupOk": "Configuración completada",
  "home.toast.setupError": "No se pudo completar la configuración. Vuelve a intentarlo en unos instantes.",
  "home.leave.title": "¿Salir sin guardar?",
  "home.leave.message.one": "Tienes {count} cambio de precio que todavía no se guardó.",
  "home.leave.message.other": "Tienes {count} cambios de precio que todavía no se guardaron.",
  "home.leave.keepEditing": "Seguir editando",
  "home.leave.confirm": "Salir sin guardar",

  // ConfigPage
  "config.backLink": "Precios mayoristas",
  "config.title": "Configurar venta mayorista",
  "config.save": "Guardar",
  "config.minQuantity.title": "Cantidad mínima",
  "config.minQuantity.text":
    "El precio mayorista se aplica cuando el carrito tiene esta cantidad de unidades, sumando solo los productos que tienen precio mayorista. Los productos sin precio mayorista mantienen su precio normal.",
  "config.minQuantity.label": "Unidades en el carrito",
  "config.minQuantity.help": "Ej.: con 3, el descuento se aplica a partir de 3 unidades.",
  "config.minQuantity.invalid": "Usa un número entero de {min} a {max}.",
  "config.design.title": "Modelo de visualización",
  "config.design.text": "Elige cómo se muestra el precio mayorista a los clientes en tu tienda.",
  "config.toast.saved": "Configuración guardada",
  "config.toast.saveError": "No se pudo guardar",

  // Modelos de visualización
  "design.1.title": "Estándar",
  "design.1.description": "Modelo actual de visualización del precio mayorista en la tienda.",

  // Errores de la API
  "apiError.invalidDesignOption": "El modelo de visualización elegido no está disponible.",
  "apiError.invalidMinQuantity": "La cantidad mínima debe ser un número entero de 1 a 999.",
  "apiError.invalidPrice": "Hay un precio inválido. Usa solo números con hasta 2 decimales.",
  "apiError.storeNotInstalled":
    "La aplicación no está instalada en esta tienda. Vuelve a instalar Atacarejo desde el administrador de Tiendanube.",
  "apiError.rateLimited": "Demasiadas solicitudes en poco tiempo. Vuelve a intentarlo en unos instantes.",
  "apiError.nuvemshopUnavailable": "Tiendanube no respondió. Vuelve a intentarlo en unos instantes.",
  "apiError.invalidToken":
    "El acceso a la tienda expiró. Vuelve a instalar la aplicación desde el administrador de Tiendanube.",
  "apiError.badRequest": "Algunos datos no son válidos. Revísalos y vuelve a intentarlo.",
  "apiError.unauthorized":
    "No pudimos validar el acceso. Vuelve a instalar la aplicación desde el administrador de Tiendanube.",
  "apiError.server": "Ocurrió un error en el servidor. Vuelve a intentarlo en unos instantes.",
};
