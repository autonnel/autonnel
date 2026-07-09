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

export const de: LocaleBundles = {
  [EmailTemplateType.ORDER_RECEIPT]: {
    name: 'Kaufbeleg',
    subject: 'Ihr Beleg fuer Bestellung {{orderNumber}}',
    texts: {
      'header-title': 'Danke fuer Ihren Einkauf',
      'greeting-text': 'Hallo {{customerFirstName}}, Ihre Bestellung ist abgeschlossen. Nachfolgend finden Sie die Zusammenfassung fuer Ihre Unterlagen.',
      'order-info-text': 'Bestellung {{orderNumber}} wurde am {{orderDate}} aufgegeben.',
      'items-heading': 'Ihre Artikel',
      'items-list': '{{orderItemsHtml}}',
      'totals-table': totalsTable('Zwischensumme', 'Versand', 'Geschaetzte Steuer', 'Rabatt', 'Belasteter Betrag'),
      'address-heading': 'Lieferadresse',
      'address-text': addressText,
      'closing-text': 'Stimmt etwas nicht? Antworten Sie auf diese Nachricht oder schreiben Sie an {{storeEmail}}, wir kuemmern uns darum.',
      'footer-text': 'Gesendet von {{storeName}} - {{storeUrl}}',
    },
  },
  [EmailTemplateType.ORDER_SHIPPED]: {
    name: 'Bestellung versandt',
    subject: 'Gute Nachrichten — Ihre Bestellung {{orderNumber}} ist unterwegs',
    texts: {
      'header-title': 'Ihr Paket ist soeben losgeschickt',
      'greeting-text':
        'Hallo {{customerFirstName}}, wir haben die Bestellung {{orderNumber}} verpackt und dem Versanddienst übergeben. Jetzt ist sie direkt zu Ihnen unterwegs.',
      'tracking-info':
        'Verfolgen Sie jede Station mit Ihrer Sendungsnummer: {{trackingNumber}}.',
      'track-button': 'Paket verfolgen',
      'address-heading': 'Lieferung an',
      'address-text':
        '{{customerFullName}}<br>{{shippingAddress}}<br><!-- IF_ADDRESS2 -->{{shippingAddress2}}<br><!-- END_ADDRESS2 -->{{shippingCity}}, {{shippingState}} {{shippingPostalCode}}<br>{{shippingCountry}}',
      'footer-text':
        'Mit Sorgfalt versendet von {{storeName}}. Schauen Sie jederzeit auf {{storeUrl}} vorbei.',
    },
  },
  [EmailTemplateType.ORDER_DELIVERED]: {
    name: 'Bestellung zugestellt',
    subject: 'Da ist es — Bestellung #{{orderNumber}} ist angekommen',
    texts: {
      'header-title': 'Zugestellt — viel Freude damit',
      'greeting-text':
        '<p>Gute Nachrichten, {{customerFirstName}}. Bestellung #{{orderNumber}} hat den Weg zu Ihnen gefunden. Wir hoffen, das Warten hat sich gelohnt.</p>',
      'review-button': 'Erzaehlen Sie es uns',
      'review-prompt':
        '<p><strong>Schon begeistert?</strong> Ein paar Worte von Ihnen helfen anderen bei der Entscheidung und zeigen uns, dass alles gepasst hat.</p>',
      'delivery-info':
        '<p><strong>Zustellung bestaetigt am {{deliveredDate}}</strong></p><p style="color:#7a6a55">Abgelegt bei {{shippingAddress}}<!-- IF_ADDRESS2 -->, {{shippingAddress2}}<!-- END_ADDRESS2 -->, {{shippingCity}}. Stimmt etwas nicht? Antworten Sie einfach, wir kuemmern uns darum.</p>',
      'footer-text': '{{storeName}} | {{storeUrl}}',
    },
  },
  [EmailTemplateType.ORDER_REFUNDED]: {
    name: 'Bestellung erstattet',
    subject: 'Erstattung fuer Bestellung #{{orderNumber}} durchgefuehrt',
    texts: {
      'header-title': 'Erstattung durchgefuehrt',
      'greeting-text':
        '<p>Hallo {{customerFirstName}}, wir haben eine Erstattung fuer Ihre Bestellung bearbeitet.</p>',
      'refund-info':
        '<p style="font-size:24px;text-align:center"><strong>Erstattungsbetrag: {{refundAmount}}</strong></p><p style="color:#666;text-align:center">Bestellung #{{orderNumber}}</p>',
      'details-text':
        '<p><strong>Erstattungsdatum:</strong> {{refundDate}}</p><p style="color:#666">Bitte rechnen Sie mit 5-10 Werktagen, bis die Erstattung auf Ihrem Konto erscheint.</p>',
      'footer-text': 'Fragen? Kontaktieren Sie uns unter {{storeEmail}}',
    },
  },
  [EmailTemplateType.RECALL_1]: {
    name: 'Warenkorb-Erinnerung',
    subject: '{{customerFirstName}}, Ihre Auswahl wartet noch auf Sie',
    texts: {
      'header-title': 'Sie haben ein paar Artikel zurückgelassen',
      'greeting-text':
        'Hallo {{customerFirstName}}, danke für Ihren Besuch bei {{storeName}}. Wir haben Ihren Warenkorb gespeichert, damit Sie genau dort weitermachen können, wo Sie aufgehört haben.',
      'items-placeholder': '{{orderItemsHtml}}',
      'trust-box':
        'Sichere Zahlung, einfache Rückgabe innerhalb von 30 Tagen und ein freundlicher Support, wann immer Sie ihn brauchen.',
      'coupon-text':
        '<!-- IF_COUPON -->Sichern Sie sich {{couponDiscount}} Rabatt auf diese Bestellung mit dem Code {{couponCode}} an der Kasse.<!-- END_COUPON -->',
      'cta-button-label': 'Zurück zu meinem Warenkorb',
      'closing-text':
        'Beliebte Artikel sind schnell vergriffen — greifen Sie zu, solange der Vorrat reicht. Bis bald!',
      'footer-text':
        'Sie erhalten diese Nachricht von {{storeName}}. Verwalten Sie Ihre Einstellungen unter {{storeUrl}}.',
    },
  },
  [EmailTemplateType.RECALL_2]: {
    name: 'Erinnerungs-E-Mail 2 (Tag 3)',
    subject: 'Nicht verpassen! Eine Ueberraschung wartet auf Sie, {{customerFirstName}}',
    texts: {
      'header-title': 'Nicht verpassen! Eine Ueberraschung wartet auf Sie',
      'greeting-text':
        '<p>Hallo {{customerFirstName}},</p><p>Wir moechten wirklich, dass Sie Ihre <strong>{{storeName}}</strong>-Artikel bekommen! Um Ihnen die Entscheidung zu erleichtern, haben wir ein exklusives Angebot fuer Sie:</p>',
      'coupon-box':
        '<!-- IF_COUPON --><p style="font-size:20px; margin-bottom:8px;"><strong>Ihr exklusiver Code</strong></p><p style="font-size:28px; letter-spacing:2px; margin:8px 0;"><strong>{{couponCode}}</strong></p><p style="color:#666; font-size:14px;">Sparen Sie <strong>{{couponDiscount}}</strong> -- nur 48 Stunden gueltig</p><!-- END_COUPON -->',
      'cta-button': 'Jetzt einkaufen',
      'reviews-box':
        '<p style="font-weight:600; margin-bottom:12px;">Was unsere Kunden sagen:</p><p style="margin:8px 0; font-style:italic; color:#555;">"Das ist der beste Kauf des Jahres -- die Qualitaet hat meine Erwartungen uebertroffen!" -- Kunde A</p><p style="margin:8px 0; font-style:italic; color:#555;">"Superschneller Versand und liebevoll verpackt." -- Kunde B</p>',
      'closing-text':
        '<p style="color:#666; font-size:13px;">Lassen Sie sich Ihre Favoriten nicht von jemand anderem wegschnappen -- bestellen Sie jetzt und es wird morgen verschickt!</p>',
      'footer-text': '{{storeName}} | {{storeUrl}}',
    },
  },
  [EmailTemplateType.RECALL_3]: {
    name: 'Erinnerungs-E-Mail 3 (Tag 7)',
    subject: 'Letzte Benachrichtigung: Ihr Warenkorb laeuft bald ab, {{customerFirstName}}',
    texts: {
      'header-title': 'Letzte Benachrichtigung: Ihr Warenkorb laeuft bald ab',
      'greeting-text':
        '<p>Hallo {{customerFirstName}},</p><p>Dies ist die letzte Erinnerung an die Artikel in Ihrem Warenkorb. Aufgrund begrenzter Lagerbestaende muessen wir diese Artikel innerhalb von <strong>24 Stunden</strong> fuer andere wartende Kunden freigeben, wenn die Zahlung nicht abgeschlossen wird.</p>',
      'items-placeholder': '<p>{{orderItemsHtml}}</p>',
      'coupon-box':
        '<!-- IF_COUPON --><p style="font-size:18px; color:#dc2626; margin-bottom:8px;"><strong>Letzte Chance</strong></p><p style="font-size:22px; letter-spacing:2px; margin:8px 0;"><strong>{{couponCode}}</strong></p><p>Verwenden Sie diesen Code und sparen Sie <strong>{{couponDiscount}}</strong></p><!-- END_COUPON -->',
      'cta-button': 'Letzte Chance -- Jetzt bezahlen',
      'feedback-box':
        '<p style="font-weight:600; margin-bottom:8px;">Haben Sie sich umentschieden?</p><p style="color:#666; margin:0;">Wir schaetzen Ihr Feedback sehr. Wenn Sie sich entschieden haben, nicht zu kaufen, koennten Sie uns den Grund mitteilen? Ihre Rueckmeldung hilft uns, uns zu verbessern.</p>',
      'closing-text':
        '<p style="color:#666; font-size:13px;">Unabhaengig von Ihrer Entscheidung, vielen Dank fuer Ihr Interesse an <strong>{{storeName}}</strong>. Wir freuen uns darauf, Sie in Zukunft bedienen zu duerfen.</p>',
      'footer-text': '{{storeName}} | {{storeUrl}}',
    },
  },
};
