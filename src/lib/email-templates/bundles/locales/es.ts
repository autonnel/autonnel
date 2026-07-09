import { EmailTemplateType } from '../../types';
import type { LocaleBundles } from '../_types';

const totalsTable = (
  subtotal: string,
  shipping: string,
  tax: string,
  discount: string,
  total: string,
) => `<table width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;border-collapse:collapse;">
<tr><td>${subtotal}</td><td align="right">{{orderSubtotal}}</td></tr>
<!-- IF_SHIPPING -->
<tr><td>${shipping}</td><td align="right">{{orderShipping}}</td></tr>
<!-- END_SHIPPING -->
<!-- IF_TAX -->
<tr><td>${tax}</td><td align="right">{{orderTax}}</td></tr>
<!-- END_TAX -->
<!-- IF_COUPON -->
<tr><td>${discount} ({{couponCode}})</td><td align="right">-{{couponDiscount}}</td></tr>
<!-- END_COUPON -->
<tr style="border-top:1px solid #d7dde3;font-weight:700;"><td>${total}</td><td align="right">{{orderTotal}}</td></tr>
</table>`;

const addressText = `<div style="font-size:14px;line-height:1.7;">
{{customerFullName}}<br>
{{shippingAddress}}<br>
<!-- IF_ADDRESS2 -->
{{shippingAddress2}}<br>
<!-- END_ADDRESS2 -->
{{shippingCity}}, {{shippingState}} {{shippingPostalCode}}<br>
{{shippingCountry}}
</div>`;

export const es: LocaleBundles = {
  [EmailTemplateType.ORDER_RECEIPT]: {
    name: 'Comprobante de compra',
    subject: 'Tu comprobante del pedido {{orderNumber}}',
    texts: {
      'header-title': 'Gracias por tu compra',
      'greeting-text': 'Hola {{customerFirstName}}, hemos cerrado tu pedido y aqui tienes el resumen para tus registros.',
      'order-info-text': 'El pedido {{orderNumber}} se realizo el {{orderDate}}.',
      'items-heading': 'Lo que pediste',
      'items-list': '{{orderItemsHtml}}',
      'totals-table': totalsTable('Subtotal de articulos', 'Envio', 'Impuesto estimado', 'Descuento', 'Importe cobrado'),
      'address-heading': 'Direccion de envio',
      'address-text': addressText,
      'closing-text': 'Notas algo raro? Responde a este mensaje o escribenos a {{storeEmail}} y lo resolvemos.',
      'footer-text': 'Enviado por {{storeName}} - {{storeUrl}}',
    },
  },
  [EmailTemplateType.ORDER_SHIPPED]: {
    name: 'Pedido enviado',
    subject: 'Buenas noticias: tu pedido {{orderNumber}} ya está en camino',
    texts: {
      'header-title': 'Tu paquete ya salió de nuestro almacén',
      'greeting-text':
        'Hola {{customerFirstName}}, preparamos el pedido {{orderNumber}} y se lo entregamos al transportista. Desde ahora viaja directo hacia ti.',
      'tracking-info':
        'Sigue cada parada del trayecto con tu número de seguimiento: {{trackingNumber}}.',
      'track-button': 'Seguir mi paquete',
      'address-heading': 'Entrega en',
      'address-text':
        '{{customerFullName}}<br>{{shippingAddress}}<br><!-- IF_ADDRESS2 -->{{shippingAddress2}}<br><!-- END_ADDRESS2 -->{{shippingCity}}, {{shippingState}} {{shippingPostalCode}}<br>{{shippingCountry}}',
      'footer-text':
        'Enviado con cariño por {{storeName}}. Visítanos cuando quieras en {{storeUrl}}.',
    },
  },
  [EmailTemplateType.ORDER_DELIVERED]: {
    name: 'Pedido entregado',
    subject: 'Ya llego — el pedido #{{orderNumber}} esta en tu puerta',
    texts: {
      'header-title': 'Entregado — disfrutalo al maximo',
      'greeting-text':
        '<p>Buenas noticias, {{customerFirstName}}. El pedido #{{orderNumber}} llego hasta ti. Esperamos que haya valido la espera.</p>',
      'review-button': 'Cuentanos que opinas',
      'review-prompt':
        '<p><strong>Ya te tiene enganchado?</strong> Unas palabras tuyas ayudan a otros a decidir y nos confirman que acertamos.</p>',
      'delivery-info':
        '<p><strong>Entrega confirmada el {{deliveredDate}}</strong></p><p style="color:#7a6a55">Dejado en {{shippingAddress}}<!-- IF_ADDRESS2 -->, {{shippingAddress2}}<!-- END_ADDRESS2 -->, {{shippingCity}}. Algo no cuadra? Responde a este mensaje y lo solucionamos.</p>',
      'footer-text': '{{storeName}} | {{storeUrl}}',
    },
  },
  [EmailTemplateType.ORDER_REFUNDED]: {
    name: 'Pedido reembolsado',
    subject: 'Reembolso procesado para el pedido #{{orderNumber}}',
    texts: {
      'header-title': 'Reembolso procesado',
      'greeting-text': '<p>Hola {{customerFirstName}}, hemos procesado un reembolso para tu pedido.</p>',
      'refund-info':
        '<p style="font-size:24px;text-align:center"><strong>Monto reembolsado: {{refundAmount}}</strong></p><p style="color:#666;text-align:center">Pedido #{{orderNumber}}</p>',
      'details-text':
        '<p><strong>Fecha de reembolso:</strong> {{refundDate}}</p><p style="color:#666">Por favor espere de 5 a 10 dias habiles para que el reembolso aparezca en su cuenta.</p>',
      'footer-text': 'Preguntas? Contactanos en {{storeEmail}}',
    },
  },
  [EmailTemplateType.RECALL_1]: {
    name: 'Recordatorio de carrito',
    subject: '{{customerFirstName}}, tus artículos siguen esperándote',
    texts: {
      'header-title': 'Dejaste algunas cosas atrás',
      'greeting-text':
        'Hola {{customerFirstName}}, gracias por pasarte por {{storeName}}. Guardamos tu carrito para que continúes justo donde lo dejaste.',
      'items-placeholder': '{{orderItemsHtml}}',
      'trust-box':
        'Pago seguro, devoluciones sencillas dentro de 30 días y un equipo cercano siempre que lo necesites.',
      'coupon-text':
        '<!-- IF_COUPON -->Llévate {{couponDiscount}} de descuento en este pedido con el código {{couponCode}} al pagar.<!-- END_COUPON -->',
      'cta-button-label': 'Volver a mi carrito',
      'closing-text':
        'Los artículos se agotan rápido, así que asegura los tuyos mientras haya existencias. ¡Nos vemos pronto!',
      'footer-text':
        'Recibes este mensaje de {{storeName}}. Gestiona tus preferencias en {{storeUrl}}.',
    },
  },
  [EmailTemplateType.RECALL_2]: {
    name: 'Email de recordatorio 2 (Dia 3)',
    subject: 'No te lo pierdas! Tenemos una sorpresa para ti, {{customerFirstName}}',
    texts: {
      'header-title': 'No te lo pierdas! Tenemos una sorpresa para ti',
      'greeting-text':
        '<p>Hola {{customerFirstName}},</p><p>Realmente queremos que tengas tus articulos de <strong>{{storeName}}</strong>! Para ayudarte a decidir, tenemos una oferta exclusiva para ti:</p>',
      'coupon-box':
        '<!-- IF_COUPON --><p style="font-size:20px; margin-bottom:8px;"><strong>Tu codigo exclusivo</strong></p><p style="font-size:28px; letter-spacing:2px; margin:8px 0;"><strong>{{couponCode}}</strong></p><p style="color:#666; font-size:14px;">Ahorra <strong>{{couponDiscount}}</strong> -- valido solo por 48 horas</p><!-- END_COUPON -->',
      'cta-button': 'Comprar ahora',
      'reviews-box':
        '<p style="font-weight:600; margin-bottom:12px;">Lo que dicen nuestros clientes:</p><p style="margin:8px 0; font-style:italic; color:#555;">"Es la mejor compra del ano -- la calidad supero mis expectativas!" -- Cliente A</p><p style="margin:8px 0; font-style:italic; color:#555;">"Envio super rapido y empaquetado con mucho cuidado." -- Cliente B</p>',
      'closing-text':
        '<p style="color:#666; font-size:13px;">No dejes que alguien mas se lleve tus favoritos -- haz tu pedido ahora y se enviara manana!</p>',
      'footer-text': '{{storeName}} | {{storeUrl}}',
    },
  },
  [EmailTemplateType.RECALL_3]: {
    name: 'Email de recordatorio 3 (Dia 7)',
    subject: 'Aviso final: Tu carrito esta a punto de expirar, {{customerFirstName}}',
    texts: {
      'header-title': 'Aviso final: Tu carrito esta a punto de expirar',
      'greeting-text':
        '<p>Hola {{customerFirstName}},</p><p>Este es el ultimo recordatorio sobre los articulos en tu carrito. Debido al stock limitado, si el pago no se completa en <strong>24 horas</strong>, tendremos que liberar estos articulos para otros clientes en espera.</p>',
      'items-placeholder': '<p>{{orderItemsHtml}}</p>',
      'coupon-box':
        '<!-- IF_COUPON --><p style="font-size:18px; color:#dc2626; margin-bottom:8px;"><strong>Ultima oportunidad</strong></p><p style="font-size:22px; letter-spacing:2px; margin:8px 0;"><strong>{{couponCode}}</strong></p><p>Usa este codigo para ahorrar <strong>{{couponDiscount}}</strong></p><!-- END_COUPON -->',
      'cta-button': 'Ultima oportunidad -- Pagar ahora',
      'feedback-box':
        '<p style="font-weight:600; margin-bottom:8px;">Cambiaste de opinion?</p><p style="color:#666; margin:0;">Valoramos mucho tu opinion. Si decidiste no comprar, podrias decirnos por que? Tus comentarios nos ayudan a mejorar.</p>',
      'closing-text':
        '<p style="color:#666; font-size:13px;">Independientemente de tu decision, gracias por tu interes en <strong>{{storeName}}</strong>. Esperamos poder atenderte en el futuro.</p>',
      'footer-text': '{{storeName}} | {{storeUrl}}',
    },
  },
};
