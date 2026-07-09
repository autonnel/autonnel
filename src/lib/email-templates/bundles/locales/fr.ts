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

export const fr: LocaleBundles = {
  [EmailTemplateType.ORDER_RECEIPT]: {
    name: 'Recu d\'achat',
    subject: 'Votre recu pour la commande {{orderNumber}}',
    texts: {
      'header-title': 'Merci pour votre achat',
      'greeting-text': 'Bonjour {{customerFirstName}}, votre commande est finalisee et vous trouverez ci-dessous le recapitulatif a conserver.',
      'order-info-text': 'La commande {{orderNumber}} a ete passee le {{orderDate}}.',
      'items-heading': 'Votre commande',
      'items-list': '{{orderItemsHtml}}',
      'totals-table': totalsTable('Sous-total articles', 'Livraison', 'Taxe estimee', 'Remise', 'Montant preleve'),
      'address-heading': 'Adresse de livraison',
      'address-text': addressText,
      'closing-text': 'Une question ou une erreur ? Repondez a ce message ou ecrivez-nous a {{storeEmail}}, nous reglons cela.',
      'footer-text': 'Envoye par {{storeName}} - {{storeUrl}}',
    },
  },
  [EmailTemplateType.ORDER_SHIPPED]: {
    name: 'Commande expédiée',
    subject: 'Bonne nouvelle — votre commande {{orderNumber}} est en route',
    texts: {
      'header-title': 'Votre colis vient de partir',
      'greeting-text':
        'Bonjour {{customerFirstName}}, nous avons préparé la commande {{orderNumber}} et l\'avons confiée au transporteur. Elle file maintenant vers chez vous.',
      'tracking-info':
        'Suivez chaque étape grâce à votre numéro de suivi : {{trackingNumber}}.',
      'track-button': 'Suivre mon colis',
      'address-heading': 'Livraison à',
      'address-text':
        '{{customerFullName}}<br>{{shippingAddress}}<br><!-- IF_ADDRESS2 -->{{shippingAddress2}}<br><!-- END_ADDRESS2 -->{{shippingCity}}, {{shippingState}} {{shippingPostalCode}}<br>{{shippingCountry}}',
      'footer-text':
        'Expédié avec soin par {{storeName}}. Retrouvez-nous quand vous voulez sur {{storeUrl}}.',
    },
  },
  [EmailTemplateType.ORDER_DELIVERED]: {
    name: 'Commande livree',
    subject: 'C\'est arrive — la commande #{{orderNumber}} vous attend',
    texts: {
      'header-title': 'Livree — profitez-en pleinement',
      'greeting-text':
        '<p>Bonne nouvelle, {{customerFirstName}}. La commande #{{orderNumber}} est bien arrivee jusqu\'a vous. Nous esperons qu\'elle valait l\'attente.</p>',
      'review-button': 'Donnez votre avis',
      'review-prompt':
        '<p><strong>Deja conquis ?</strong> Quelques mots de votre part aident les autres clients a choisir et nous confirment que tout est parfait.</p>',
      'delivery-info':
        '<p><strong>Depot confirme le {{deliveredDate}}</strong></p><p style="color:#7a6a55">Depose au {{shippingAddress}}<!-- IF_ADDRESS2 -->, {{shippingAddress2}}<!-- END_ADDRESS2 -->, {{shippingCity}}. Un souci ? Repondez simplement a ce message et nous reglerons cela.</p>',
      'footer-text': '{{storeName}} | {{storeUrl}}',
    },
  },
  [EmailTemplateType.ORDER_REFUNDED]: {
    name: 'Commande remboursee',
    subject: 'Remboursement effectue pour la commande #{{orderNumber}}',
    texts: {
      'header-title': 'Remboursement effectue',
      'greeting-text':
        '<p>Bonjour {{customerFirstName}}, nous avons traite un remboursement pour votre commande.</p>',
      'refund-info':
        '<p style="font-size:24px;text-align:center"><strong>Montant rembourse : {{refundAmount}}</strong></p><p style="color:#666;text-align:center">Commande #{{orderNumber}}</p>',
      'details-text':
        '<p><strong>Date de remboursement :</strong> {{refundDate}}</p><p style="color:#666">Veuillez compter 5 a 10 jours ouvrables pour que le remboursement apparaisse sur votre compte.</p>',
      'footer-text': 'Des questions ? Contactez-nous a {{storeEmail}}',
    },
  },
  [EmailTemplateType.RECALL_1]: {
    name: 'Rappel de panier',
    subject: '{{customerFirstName}}, vos articles vous attendent toujours',
    texts: {
      'header-title': 'Vous avez oublié quelques articles',
      'greeting-text':
        'Bonjour {{customerFirstName}}, merci d\'être passé chez {{storeName}}. Nous avons gardé votre panier pour que vous puissiez reprendre là où vous vous étiez arrêté.',
      'items-placeholder': '{{orderItemsHtml}}',
      'trust-box':
        'Paiement sécurisé, retours faciles sous 30 jours et une équipe à votre écoute dès que vous en avez besoin.',
      'coupon-text':
        '<!-- IF_COUPON -->Profitez de {{couponDiscount}} de réduction sur cette commande avec le code {{couponCode}} au paiement.<!-- END_COUPON -->',
      'cta-button-label': 'Revenir à mon panier',
      'closing-text':
        'Les articles partent vite, alors saisissez les vôtres tant qu\'ils sont en stock. À très bientôt !',
      'footer-text':
        'Vous recevez ce message de la part de {{storeName}}. Gérez vos préférences sur {{storeUrl}}.',
    },
  },
  [EmailTemplateType.RECALL_2]: {
    name: 'Email de rappel 2 (Jour 3)',
    subject: 'Ne manquez pas ! Une surprise vous attend, {{customerFirstName}}',
    texts: {
      'header-title': 'Ne manquez pas ! Une surprise vous attend',
      'greeting-text':
        '<p>Bonjour {{customerFirstName}},</p><p>Nous souhaitons vraiment que vous puissiez profiter de vos articles <strong>{{storeName}}</strong> ! Pour vous aider a vous decider, nous avons une offre exclusive :</p>',
      'coupon-box':
        '<!-- IF_COUPON --><p style="font-size:20px; margin-bottom:8px;"><strong>Votre code exclusif</strong></p><p style="font-size:28px; letter-spacing:2px; margin:8px 0;"><strong>{{couponCode}}</strong></p><p style="color:#666; font-size:14px;">Economisez <strong>{{couponDiscount}}</strong> -- valable 48 heures seulement</p><!-- END_COUPON -->',
      'cta-button': 'Acheter maintenant',
      'reviews-box':
        '<p style="font-weight:600; margin-bottom:12px;">Ce que disent nos clients :</p><p style="margin:8px 0; font-style:italic; color:#555;">"C\'est le meilleur achat de l\'annee -- la qualite a depasse mes attentes !" -- Client A</p><p style="margin:8px 0; font-style:italic; color:#555;">"Livraison ultra rapide et emballage soigne." -- Client B</p>',
      'closing-text':
        '<p style="color:#666; font-size:13px;">Ne laissez pas quelqu\'un d\'autre s\'emparer de vos favoris -- commandez maintenant pour une expedition des demain !</p>',
      'footer-text': '{{storeName}} | {{storeUrl}}',
    },
  },
  [EmailTemplateType.RECALL_3]: {
    name: 'Email de rappel 3 (Jour 7)',
    subject: 'Dernier avis : Votre panier va bientot expirer, {{customerFirstName}}',
    texts: {
      'header-title': 'Dernier avis : Votre panier va bientot expirer',
      'greeting-text':
        '<p>Bonjour {{customerFirstName}},</p><p>Ceci est le dernier rappel concernant les articles dans votre panier. En raison d\'un stock limite, si le paiement n\'est pas finalise dans les <strong>24 heures</strong>, nous devrons liberer ces articles pour d\'autres clients en attente.</p>',
      'items-placeholder': '<p>{{orderItemsHtml}}</p>',
      'coupon-box':
        '<!-- IF_COUPON --><p style="font-size:18px; color:#dc2626; margin-bottom:8px;"><strong>Derniere chance</strong></p><p style="font-size:22px; letter-spacing:2px; margin:8px 0;"><strong>{{couponCode}}</strong></p><p>Utilisez ce code pour economiser <strong>{{couponDiscount}}</strong></p><!-- END_COUPON -->',
      'cta-button': 'Derniere chance -- Payer maintenant',
      'feedback-box':
        '<p style="font-weight:600; margin-bottom:8px;">Vous avez change d\'avis ?</p><p style="color:#666; margin:0;">Nous apprecions sincerement votre avis. Si vous avez decide de ne pas acheter, pourriez-vous nous dire pourquoi ? Vos retours nous aident a nous ameliorer.</p>',
      'closing-text':
        '<p style="color:#666; font-size:13px;">Quelle que soit votre decision, merci pour votre interet envers <strong>{{storeName}}</strong>. Nous esperons pouvoir vous servir a l\'avenir.</p>',
      'footer-text': '{{storeName}} | {{storeUrl}}',
    },
  },
};
