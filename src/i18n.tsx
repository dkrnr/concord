import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'en' | 'es';
type Values = Record<string, string | number>;

const es: Record<string, string> = {
  'Home': 'Inicio', 'Scenes': 'Escenas', 'Access': 'Acceso', 'Building': 'Edificio',
  'Resident': 'Residente', 'Operator': 'Operador', 'Developer': 'Promotor',
  'Portfolio': 'Portafolio', 'Concord Portfolio': 'Portafolio Concord', 'Developer overview': 'Resumen del promotor', 'Aster portfolio': 'Portafolio Aster',
  'Every residence, one accountable view.': 'Cada residencia, una vista responsable.', 'Building-level adoption, fleet condition and handover readiness. Resident behavior remains private.': 'Adopción, estado de la flota y preparación de entregas a nivel del edificio. El comportamiento de residentes permanece privado.',
  'Live engine aggregate': 'Agregado del motor en vivo', 'Portfolio overview': 'Resumen del portafolio', 'Active units': 'Unidades activas', '{rate}% portfolio adoption': '{rate}% de adopción del portafolio',
  'Fleet health': 'Estado de la flota', 'healthy': 'saludables', 'Maintenance': 'Mantenimiento', 'open items': 'incidencias abiertas', 'high priority': 'prioridad alta',
  'Handover': 'Entrega', 'vacant': 'vacantes', 'Energy overview': 'Resumen energético', 'kWh average per unit': 'kWh de media por unidad',
  'Portfolio units': 'Unidades del portafolio', 'total': 'total', 'Fleet': 'Flota', 'Clear': 'Sin incidencias', 'Recent alerts': 'Alertas recientes',
  'Unit {unit}': 'Unidad {unit}', 'Fleet anomaly requires review.': 'La anomalía de flota requiere revisión.', '{count} maintenance items are open.': 'Hay {count} incidencias de mantenimiento abiertas.', 'Fleet health needs attention.': 'El estado de la flota requiere atención.', 'No building alerts.': 'No hay alertas del edificio.',
  'occupied': 'ocupada', 'pending_handover': 'entrega pendiente', 'medium': 'media', 'high': 'alta', 'low': 'baja', 'open': 'abierto',
  'Needs attention': 'Requiere atención', 'Your call': 'Tú decides', 'Done': 'Listo',
  'Paused until tomorrow': 'Pausado hasta mañana', 'Routine turned off': 'Rutina desactivada', 'Kept as is': 'Se mantiene',
  'Approve': 'Aprobar', 'Dismiss': 'Descartar', 'Keep': 'Mantener', 'Not tonight': 'Esta noche no', 'Never': 'Nunca',
  'Turn off': 'Apagar', 'Turn on': 'Encender', 'Close': 'Cerrar', 'Open': 'Abrir', 'Unlock': 'Desbloquear', 'Lock': 'Bloquear',
  'brightness': 'brillo', 'open': 'abierto', 'on': 'encendido', 'off': 'apagado', 'Locked': 'Bloqueado', 'Unlocked': 'Desbloqueado',
  'Alarm': 'Alarma', 'clear': 'despejado', 'Home occupied': 'Hogar ocupado', 'Away': 'Ausente', 'climate': 'clima', 'light': 'luz', 'curtain': 'cortina', 'lock': 'cerradura',
  'Sensor · read only': 'Sensor · solo lectura', 'Lower bedroom temperature': 'Bajar temperatura del dormitorio', 'Raise bedroom temperature': 'Subir temperatura del dormitorio',
  'Tuesday · Apartment 401': 'Martes · Apartamento 401', 'Good evening, {name}.': 'Buenas tardes, {name}.',
  'Your home has settled in. One choice is waiting for you.': 'Tu hogar está en calma. Hay una decisión esperándote.',
  'New scene': 'Nueva escena', 'Live home': 'Hogar en vivo', '4 rooms · 6 devices': '4 habitaciones · 6 dispositivos',
  'Evening mode': 'Modo nocturno', '3 changes active': '3 cambios activos', 'Choose room': 'Elegir habitación',
  'Whole home': 'Toda la casa', 'living': 'sala', 'bedroom': 'dormitorio', 'kitchen': 'cocina', 'entry': 'entrada',
  'Home state': 'Estado del hogar', 'All devices': 'Todos los dispositivos', 'Why feed': 'Registro de motivos',
  'What home noticed': 'Lo que detectó el hogar', '{count} new': '{count} nuevos',
  'Every action comes with its reason. Correct one and Concord learns the boundary.': 'Cada acción incluye su motivo. Corrígela y Concord aprende el límite.',
  '{count} signals': '{count} señales', 'No extra conditions': 'Sin condiciones adicionales',
  'Concord understood': 'Concord entendió', 'Draft': 'Borrador', 'When': 'Cuándo', 'Trigger time': 'Hora de activación',
  'Unspecified event': 'Evento sin especificar', 'Only if': 'Solo si', 'Then': 'Entonces', 'Resolved target': 'Destino resuelto',
  '{type} action {count}': 'Acción {count} de {type}', 'All {type} devices · room not specified': 'Todos los dispositivos {type} · habitación sin especificar',
  '{id} · unavailable target, choose a real device': '{id} · destino no disponible, elige un dispositivo real',
  'The engine found {count} conflicts. Edit the target or action, then confirm to check again.': 'El motor encontró {count} conflictos. Ajusta el destino o la acción y confirma de nuevo.',
  'On / true': 'Encendido / verdadero', 'Off / false': 'Apagado / falso',
  'This is the engine’s exact resolution. Check the target, room and values before saving.': 'Esta es la resolución exacta del motor. Revisa el destino, la habitación y los valores antes de guardar.',
  'Make it comfortable when I sleep': 'Hazlo cómodo cuando duerma', 'Say how you want home to feel.': 'Describe cómo quieres que se sienta tu hogar.',
  'Describe the outcome in your words. Concord will show the exact rule before anything is saved.': 'Describe el resultado con tus palabras. Concord mostrará la regla exacta antes de guardar.',
  'Describe your scene': 'Describe tu escena', 'Understanding…': 'Interpretando…', 'Make the rule': 'Crear la regla', 'Try': 'Prueba',
  'Lock up when everyone leaves': 'Cierra cuando todos se vayan', 'Cool the bedroom before sleep': 'Enfría el dormitorio antes de dormir',
  'Welcome me home after sunset': 'Dame la bienvenida después del atardecer', 'Discard': 'Descartar', 'Check and save': 'Revisar y guardar',
  'Preview': 'Vista previa', 'Live state': 'Estado actual', 'Show live': 'Ver estado actual', 'Preview rule': 'Previsualizar regla',
  'No proposed changes.': 'No hay cambios propuestos.', 'No preview changes are applied.': 'La vista previa no aplica cambios.', 'Proposed change': 'Cambio propuesto', 'multiple rooms': 'varias habitaciones',
  'Scene creation method': 'Método de creación de escena', 'Describe it': 'Describir', 'Build manually': 'Crear manualmente', 'Structured scene builder': 'Constructor de escenas estructurado',
  'Choose the trigger, optional condition and exact device action. You will review the same rule receipt before saving.': 'Elige el activador, la condición opcional y la acción exacta del dispositivo. Revisarás el mismo recibo de regla antes de guardar.',
  'Manual fallback': 'Alternativa manual', 'Scene name': 'Nombre de la escena', 'Trigger': 'Activador', 'Trigger type': 'Tipo de activador', 'At a time': 'A una hora', 'When occupancy changes': 'Cuando cambia la ocupación',
  'When motion is detected': 'Cuando se detecta movimiento', 'Time': 'Hora', 'Condition': 'Condición', 'Home is away': 'El hogar está vacío', 'Home is occupied': 'El hogar está ocupado', 'Event room is hallway': 'La habitación del evento es el pasillo',
  'Action': 'Acción', 'Device': 'Dispositivo', 'Brightness': 'Brillo', 'Temperature': 'Temperatura', 'Lock state': 'Estado de la cerradura', 'Open percent': 'Porcentaje de apertura',
  'Review manual rule': 'Revisar regla manual', 'No controllable devices are available.': 'No hay dispositivos controlables disponibles.', 'Manual scene': 'Escena manual',
  'A key that knows when to leave.': 'Una llave que sabe cuándo irse.', 'Create a pass for the right door and the right window. It expires without a reminder.': 'Crea un pase para la puerta y el horario correctos. Caduca automáticamente.',
  'Who is it for?': '¿Para quién es?', 'visitor': 'visitante', 'delivery': 'entrega', 'cleaner': 'limpieza',
  'Name or service': 'Nombre o servicio', 'Access window': 'Horario de acceso', 'Next 1 hour': 'Próxima hora', 'Next 2 hours': 'Próximas 2 horas',
  'Next 4 hours': 'Próximas 4 horas', 'Today': 'Hoy', 'Entry only': 'Solo entrada', 'Unlock apartment 401 · no device control': 'Desbloqueo del apartamento 401 · sin control de dispositivos',
  'Creating…': 'Creando…', 'Create pass': 'Crear pase', 'Backup code': 'Código de respaldo', 'Copy backup code': 'Copiar código de respaldo',
  'Copied': 'Copiado', 'Copy': 'Copiar', 'Valid from': 'Válido desde', 'Expired at': 'Caducó a las', 'Valid until': 'Válido hasta',
  'Demo pass · secure redemption pending backend integration': 'Pase de demostración · la validación segura depende del backend',
  'Your pass appears here': 'Tu pase aparecerá aquí', 'The QR, readable backup code and expiry window will be ready to share.': 'El QR, el código de respaldo y el horario estarán listos para compartir.',
  'Access schedule': 'Programa de acceso', 'One-time': 'Una vez', 'Repeats weekly': 'Se repite semanalmente', 'Starts on': 'Comienza el', 'Ends on': 'Termina el',
  'Repeats on': 'Se repite los', 'Window starts': 'Inicio de la franja', 'Window ends': 'Fin de la franja', 'Start time': 'Hora de inicio', 'End time': 'Hora de fin',
  'mon': 'lun', 'tue': 'mar', 'wed': 'mié', 'thu': 'jue', 'fri': 'vie', 'sat': 'sáb', 'sun': 'dom',
  'Choose a valid date range, at least one day, and an end time after the start time.': 'Elige un rango válido, al menos un día y una hora de fin posterior a la de inicio.',
  'View your time-limited Concord visitor pass.': 'Consulta tu pase de visitante de Concord con horario limitado.', 'Share pass': 'Compartir pase', 'Shared': 'Compartido', 'Copy pass link': 'Copiar enlace del pase',
  'The pass link could not be shared. Copy it and try again.': 'No se pudo compartir el enlace. Cópialo e inténtalo de nuevo.',
  'This demo pass is invalid or no longer available.': 'Este pase de demostración no es válido o ya no está disponible.', 'The pass could not be loaded.': 'No se pudo cargar el pase.',
  'Loading visitor pass…': 'Cargando pase de visitante…', 'Pass unavailable': 'Pase no disponible', 'QR code for {name}': 'Código QR para {name}',
  'Destination': 'Destino', 'Aster Tower · Apartment 401': 'Aster Tower · Apartamento 401', 'to': 'hasta', 'Weekly schedule': 'Horario semanal',
  'This QR identifies the demo pass. The building backend validates access; the QR alone does not unlock a door.': 'Este QR identifica el pase de demostración. El backend del edificio valida el acceso; el QR por sí solo no abre ninguna puerta.',
  'pending': 'pendiente', 'active': 'activo', 'expired': 'caducado',
  'Aster Tower · Live overview': 'Aster Tower · Resumen en vivo', 'Good evening, front desk.': 'Buenas tardes, recepción.',
  'Three units need attention. Resident activity stays private.': 'Tres unidades requieren atención. La actividad de residentes permanece privada.',
  'New handover': 'Nueva entrega', 'Device health': 'Estado de dispositivos', 'Need attention': 'Requieren atención', 'Energy today': 'Energía hoy',
  '48 residences': '48 residencias', 'all': 'todos', 'attention': 'atención', 'anomaly': 'anomalía', 'Unit': 'Unidad', 'Healthy': 'Saludable',
  'Energy anomaly': 'Anomalía energética', 'Energy': 'Energía', 'Entry lock offline': 'Cerradura de entrada sin conexión', 'All devices responding': 'Todos los dispositivos responden',
  'Energy anomaly since 14:20': 'Anomalía energética desde las 14:20', 'Smoke sensor battery': 'Batería del sensor de humo',
  'Connecting to Apartment 401…': 'Conectando con el Apartamento 401…', 'Home engine offline': 'Motor del hogar sin conexión', 'Retry connection': 'Reintentar conexión',
  'Home engine live': 'Motor del hogar activo', 'Reconnecting…': 'Reconectando…', 'Data may be stale': 'Los datos pueden estar desactualizados', 'Engine offline': 'Motor sin conexión',
  'The last confirmed home state remains visible.': 'El último estado confirmado del hogar sigue visible.', 'Retry now': 'Reintentar ahora',
  'Emergency': 'Emergencia', 'Get help now': 'Pedir ayuda ahora', 'Demo view': 'Vista de demostración', 'Dark mode': 'Modo oscuro', 'Light mode': 'Modo claro',
  'Use dark mode': 'Usar modo oscuro', 'Use light mode': 'Usar modo claro', 'Open menu': 'Abrir menú', 'Primary navigation': 'Navegación principal', 'Mobile navigation': 'Navegación móvil',
  'Notifications': 'Notificaciones', 'Scene ready': 'Escena lista', 'Engine write failed': 'Error al escribir en el motor', 'Dismiss error': 'Cerrar error',
  'This scene needs another edit': 'Esta escena necesita otro ajuste', 'Conflict found by the engine': 'Conflicto detectado por el motor', 'No scene was saved': 'No se guardó ninguna escena',
  'Your edited scene': 'Tu escena editada', 'conflicts with': 'entra en conflicto con', 'Existing rule': 'Regla existente', 'The engine kept the existing rule unchanged.': 'El motor mantuvo la regla existente sin cambios.', 'Return to edit': 'Volver a editar',
  'Help request sent': 'Solicitud de ayuda enviada', 'Emergency help': 'Ayuda de emergencia', 'Building response has been alerted.': 'Se avisó al equipo del edificio.',
  'Status': 'Estado', 'Active': 'Activo', 'Escalated to': 'Escalado a', 'Operator desk': 'Puesto de operador', 'Sent': 'Enviado',
  'Send an urgent help request?': '¿Enviar una solicitud de ayuda urgente?', 'This demo alerts the simulated building response desk. It does not contact emergency services.': 'Esta demostración avisa al puesto simulado del edificio. No contacta servicios de emergencia.',
  'Sending…': 'Enviando…', 'Send help request now': 'Enviar solicitud de ayuda ahora', 'Cancel': 'Cancelar',
  'Prepare unit handover': 'Preparar entrega de unidad', 'Access begins with the lease and expires automatically at its end.': 'El acceso comienza con el contrato y caduca automáticamente al terminar.',
  'Resident type': 'Tipo de residente', 'Tenant': 'Inquilino', 'Owner': 'Propietario', 'Resident name': 'Nombre del residente', 'Lease begins': 'Inicio del contrato', 'Lease ends': 'Fin del contrato',
  'Resident controls': 'Controles del residente', 'Entry, climate, lights and curtains · no operator scope': 'Entrada, clima, luces y cortinas · sin permisos de operador',
  'Activating…': 'Activando…', 'Activate at lease start': 'Activar al inicio del contrato', 'Language': 'Idioma', 'English': 'Inglés', 'Spanish': 'Español', 'Close dialog': 'Cerrar diálogo',
  'Profile': 'Perfil', 'Open profile': 'Abrir perfil', 'Apartment 401 · Edit profile': 'Apartamento 401 · Editar perfil',
  'Your resident profile': 'Tu perfil de residente', 'Keep the identity shown across your home controls current. Changes stay in this demo session.': 'Mantén actualizada la identidad que aparece en los controles del hogar. Los cambios duran durante esta sesión de demostración.',
  'Profile picture': 'Foto de perfil', 'Replace picture': 'Cambiar foto', 'Choose a picture': 'Elegir una foto', 'JPG, PNG or WebP · up to 3 MB': 'JPG, PNG o WebP · hasta 3 MB',
  'Choose a JPG, PNG or WebP image under 3 MB.': 'Elige una imagen JPG, PNG o WebP de menos de 3 MB.', 'That image could not be read. Choose another file.': 'No se pudo leer la imagen. Elige otro archivo.',
  'Enter the resident name.': 'Escribe el nombre del residente.', 'Remove picture': 'Eliminar foto', 'Profile saved': 'Perfil guardado', 'Save profile': 'Guardar perfil',
  'Alerts, explanations and emergency updates from the live home engine.': 'Alertas, explicaciones y actualizaciones de emergencia del motor del hogar.', '{count} unread': '{count} sin leer',
  'Loading notifications': 'Cargando notificaciones', 'You’re all caught up': 'Estás al día', 'New WhyCards, alerts and SOS updates will appear here.': 'Las nuevas explicaciones, alertas y actualizaciones SOS aparecerán aquí.',
  'Emergency update': 'Actualización de emergencia', 'Home explanation': 'Explicación del hogar', 'Read': 'Leído', 'Mark as read': 'Marcar como leído',
};

type I18nValue = { language: Language; setLanguage: (value: Language) => void; t: (message: string, values?: Values) => string; locale: string };
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => window.localStorage.getItem('concord-language') === 'es' ? 'es' : 'en');
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const value = useMemo<I18nValue>(() => ({
    language,
    locale: language === 'es' ? 'es-ES' : 'en-US',
    setLanguage(next) { setLanguageState(next); window.localStorage.setItem('concord-language', next); document.documentElement.lang = next; },
    t(message, values = {}) {
      const translated = language === 'es' ? es[message] ?? message : message;
      return translated.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
    },
  }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
