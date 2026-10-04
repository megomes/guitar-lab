/* Celular em pé: o app inteiro gira 90° e se desenha deitado (globals.css), sem
 * depender da rotação automática nem do manifest. A mesma condição do CSS. */
export const ROTATED_QUERY = '(orientation: portrait) and (max-width: 559px)'

export const isRotated = () => typeof matchMedia !== 'undefined' && matchMedia(ROTATED_QUERY).matches
