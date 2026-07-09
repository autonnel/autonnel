export type SupportedLanguage = 'en' | 'de' | 'fr' | 'es';

const LOCALES: SupportedLanguage[] = ['en', 'de', 'fr', 'es'];

const LOCALE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
};

export const LANGUAGE_OPTIONS = LOCALES.map((value) => ({
  label: LOCALE_LABELS[value],
  value,
})) as ReadonlyArray<{ label: string; value: SupportedLanguage }>;

type LocaleTuple = [en: string, de: string, fr: string, es: string];
type Catalog = Record<string, LocaleTuple>;

const addressLabels: Catalog = {
  'address.emailLabel': ['Email Address *', 'E-Mail-Adresse *', 'Adresse e-mail *', 'Correo electrónico *'],
  'address.firstNameLabel': ['First Name *', 'Vorname *', 'Prénom *', 'Nombre *'],
  'address.lastNameLabel': ['Last Name *', 'Nachname *', 'Nom *', 'Apellido *'],
  'address.phoneLabel': ['Phone Number *', 'Telefonnummer *', 'Numéro de téléphone *', 'Número de teléfono *'],
  'address.addressLabel': ['Address *', 'Adresse *', 'Adresse *', 'Dirección *'],
  'address.streetLabel': ['Street Address', 'Straße', 'Adresse', 'Calle'],
  'address.aptLabel': ['Apt, Suite, etc. (optional)', 'Wohnung, Suite usw. (optional)', 'Appt, bâtiment, etc. (optionnel)', 'Depto, suite, etc. (opcional)'],
  'address.cityLabel': ['City *', 'Stadt *', 'Ville *', 'Ciudad *'],
  'address.stateLabel': ['State *', 'Bundesland *', 'Région *', 'Estado *'],
  'address.selectState': ['Select State', 'Bundesland auswählen', 'Sélectionner la région', 'Seleccionar estado'],
  'address.stateProvince': ['State/Province', 'Bundesland/Provinz', 'Région/Province', 'Estado/Provincia'],
  'address.zipLabel': ['ZIP/Postal Code *', 'Postleitzahl *', 'Code postal *', 'Código postal *'],
  'address.countryLabel': ['Country *', 'Land *', 'Pays *', 'País *'],
  'address.autocompleteHint': ['Start typing to search for your address', 'Beginnen Sie mit der Eingabe, um Ihre Adresse zu suchen', 'Commencez à taper pour rechercher votre adresse', 'Comience a escribir para buscar su dirección'],
  'address.manualEntry': ['Enter address manually →', 'Adresse manuell eingeben →', 'Saisir l\'adresse manuellement →', 'Ingresar dirección manualmente →'],
  'address.billingSameAsShipping': ['Billing address same as shipping', 'Rechnungsadresse entspricht Lieferadresse', 'L\'adresse de facturation est identique à l\'adresse de livraison', 'La dirección de facturación es la misma que la de envío'],
  'address.billingAddress': ['Billing Address', 'Rechnungsadresse', 'Adresse de facturation', 'Dirección de facturación'],
};

const addressPlaceholders: Catalog = {
  'address.emailPlaceholder': ['john.doe@example.com', 'ihre@email.com', 'votre@email.com', 'su@correo.com'],
  'address.firstNamePlaceholder': ['John', 'Max', 'Jean', 'Juan'],
  'address.lastNamePlaceholder': ['Doe', 'Mustermann', 'Dupont', 'García'],
  'address.phonePlaceholder': ['+1 (555) 123-4567', '+49 (030) 123-4567', '+33 1 23 45 67 89', '+34 612 345 678'],
  'address.streetPlaceholder': ['123 Main St', 'Musterstraße 123', '123 Rue Principale', 'Calle Principal 123'],
  'address.aptPlaceholder': ['Apt 4B', 'Whg. 4B', 'Appt 4B', 'Depto 4B'],
  'address.cityPlaceholder': ['New York', 'Berlin', 'Paris', 'Madrid'],
  'address.zipPlaceholder': ['10001', '10115', '75001', '28001'],
};

const checkoutFields: Catalog = {
  'checkout.contactInfo': ['Contact Information', 'Kontaktinformationen', 'Informations de contact', 'Información de contacto'],
  'checkout.shippingAddress': ['Shipping Address', 'Lieferadresse', 'Adresse de livraison', 'Dirección de envío'],
  'checkout.emailLabel': ['Email', 'E-Mail', 'E-mail', 'Correo electrónico'],
  'checkout.firstNameLabel': ['First Name', 'Vorname', 'Prénom', 'Nombre'],
  'checkout.lastNameLabel': ['Last Name', 'Nachname', 'Nom', 'Apellido'],
  'checkout.phoneLabel': ['Phone *', 'Telefon *', 'Téléphone *', 'Teléfono *'],
  'checkout.addressLabel': ['Address', 'Adresse', 'Adresse', 'Dirección'],
  'checkout.aptLabel': ['Apartment, suite, etc. (optional)', 'Wohnung, Suite usw. (optional)', 'Appartement, suite, etc. (optionnel)', 'Apartamento, suite, etc. (opcional)'],
  'checkout.cityLabel': ['City', 'Stadt', 'Ville', 'Ciudad'],
  'checkout.stateLabel': ['State / Province', 'Bundesland / Provinz', 'Région / Province', 'Estado / Provincia'],
  'checkout.postalCodeLabel': ['Postal Code', 'Postleitzahl', 'Code postal', 'Código postal'],
  'checkout.countryLabel': ['Country', 'Land', 'Pays', 'País'],
};

const orderSummary: Catalog = {
  'orderSummary.emptyState': ['Please select a product above', 'Bitte wählen Sie oben ein Produkt aus', 'Veuillez sélectionner un produit ci-dessus', 'Por favor seleccione un producto arriba'],
  'orderSummary.qty': ['Qty:', 'Menge:', 'Qté :', 'Cant:'],
  'orderSummary.subtotal': ['Subtotal', 'Zwischensumme', 'Sous-total', 'Subtotal'],
  'orderSummary.discount': ['Discount', 'Rabatt', 'Réduction', 'Descuento'],
  'orderSummary.shipping': ['Shipping', 'Versand', 'Livraison', 'Envío'],
  'orderSummary.shippingNote': ['Calculated at next step', 'Wird im nächsten Schritt berechnet', 'Calculé à l\'étape suivante', 'Calculado en el siguiente paso'],
  'orderSummary.total': ['Total', 'Gesamt', 'Total', 'Total'],
  'orderSummary.couponPlaceholder': ['Coupon code', 'Gutscheincode', 'Code promo', 'Código de cupón'],
  'orderSummary.apply': ['Apply', 'Einlösen', 'Appliquer', 'Aplicar'],
  'orderSummary.invalidCoupon': ['Invalid coupon code', 'Ungültiger Gutscheincode', 'Code promo invalide', 'Código de cupón inválido'],
  'orderSummary.couponFailed': ['Failed to apply coupon', 'Gutschein konnte nicht eingelöst werden', 'Impossible d\'appliquer le code promo', 'No se pudo aplicar el cupón'],
  'orderSummary.secure': ['Secure', 'Sicher', 'Sécurisé', 'Seguro'],
  'orderSummary.freeShipping': ['Free Shipping', 'Kostenloser Versand', 'Livraison gratuite', 'Envío gratis'],
  'orderSummary.moneyBack': ['Money Back', 'Geld zurück', 'Satisfait ou remboursé', 'Garantía de devolución'],
};

const payment: Catalog = {
  'payment.loading': ['Loading payment options...', 'Zahlungsoptionen werden geladen...', 'Chargement des options de paiement...', 'Cargando opciones de pago...'],
  'payment.notConfiguredTitle': ['Payment Not Configured', 'Zahlung nicht konfiguriert', 'Paiement non configuré', 'Pago no configurado'],
  'payment.notConfiguredMessage': ['Payment methods have not been set up for this store. Please contact the store administrator.', 'Für diesen Shop wurden keine Zahlungsmethoden eingerichtet. Bitte kontaktieren Sie den Shop-Administrator.', 'Les méthodes de paiement n\'ont pas été configurées pour cette boutique. Veuillez contacter l\'administrateur.', 'Los métodos de pago no han sido configurados para esta tienda. Por favor contacte al administrador.'],
  'payment.sslBadge': ['256-bit SSL', '256-Bit SSL', 'SSL 256 bits', 'SSL de 256 bits'],
  'payment.pciBadge': ['PCI Compliant', 'PCI-konform', 'Conforme PCI', 'Compatible con PCI'],
  'payment.secureCheckout': ['Secure Checkout', 'Sicherer Checkout', 'Paiement sécurisé', 'Pago seguro'],
  'paymentTabs.card': ['Card', 'Karte', 'Carte', 'Tarjeta'],
};

const paypalCard: Catalog = {
  'paypalCard.cardNumberLabel': ['Card Number *', 'Kartennummer *', 'Numéro de carte *', 'Número de tarjeta *'],
  'paypalCard.expirationLabel': ['Expiration *', 'Ablaufdatum *', 'Expiration *', 'Vencimiento *'],
  'paypalCard.cvvLabel': ['CVV *', 'CVV *', 'CVV *', 'CVV *'],
  'paypalCard.loadingPayment': ['Loading secure payment...', 'Sichere Zahlung wird geladen...', 'Chargement du paiement sécurisé...', 'Cargando pago seguro...'],
  'paypalCard.retrying': ['Retrying payment form...', 'Zahlungsformular wird erneut geladen...', 'Nouvelle tentative de chargement...', 'Reintentando formulario de pago...'],
  'paypalCard.processing': ['Processing...', 'Verarbeitung...', 'Traitement...', 'Procesando...'],
  'paypalCard.notAvailable': ['Card payments not available', 'Kartenzahlung nicht verfügbar', 'Paiement par carte non disponible', 'Pago con tarjeta no disponible'],
  'paypalCard.loadFailed': ['Failed to load payment form', 'Zahlungsformular konnte nicht geladen werden', 'Impossible de charger le formulaire de paiement', 'No se pudo cargar el formulario de pago'],
  'paypalCard.refreshPage': ['Payment form failed to load. Please refresh the page.', 'Zahlungsformular konnte nicht geladen werden. Bitte aktualisieren Sie die Seite.', 'Le formulaire de paiement n\'a pas pu être chargé. Veuillez actualiser la page.', 'El formulario de pago no se pudo cargar. Por favor actualice la página.'],
  'paypalCard.notReady': ['Payment form not ready', 'Zahlungsformular nicht bereit', 'Le formulaire de paiement n\'est pas prêt', 'El formulario de pago no está listo'],
  'paypalCard.poweredBy': ['Powered by', 'Bereitgestellt von', 'Fourni par', 'Desarrollado por'],
  'paypalCard.secureCheckout': ['🔒 Secure checkout', '🔒 Sicherer Checkout', '🔒 Paiement sécurisé', '🔒 Pago seguro'],
};

const productSelector: Catalog = {
  'productSelector.noProducts': ['No products configured', 'Keine Produkte konfiguriert', 'Aucun produit configuré', 'No hay productos configurados'],
  'productSelector.noProductsHint': ['Click "Select Products" in the editor panel to add products', 'Klicken Sie im Editor auf "Produkte auswählen", um Produkte hinzuzufügen', 'Cliquez sur « Sélectionner des produits » dans le panneau de l\'éditeur pour ajouter des produits', 'Haga clic en "Seleccionar productos" en el panel del editor para agregar productos'],
  'productSelector.mostPopular': ['Most Popular', 'Beliebteste', 'Le plus populaire', 'Más popular'],
};

const expressCheckout: Catalog = {
  'expressCheckout.loadingPayPal': ['Loading PayPal...', 'PayPal wird geladen...', 'Chargement de PayPal...', 'Cargando PayPal...'],
  'expressCheckout.retryingPayPal': ['Retrying PayPal...', 'PayPal wird erneut versucht...', 'Nouvelle tentative PayPal...', 'Reintentando PayPal...'],
  'expressCheckout.sdkFailed': ['PayPal SDK failed to load. Please refresh the page.', 'PayPal SDK konnte nicht geladen werden. Bitte aktualisieren Sie die Seite.', 'Le SDK PayPal n\'a pas pu être chargé. Veuillez actualiser la page.', 'El SDK de PayPal no se pudo cargar. Por favor actualice la página.'],
  'expressCheckout.checkoutFailed': ['PayPal checkout failed. Please try again.', 'PayPal-Checkout fehlgeschlagen. Bitte versuchen Sie es erneut.', 'Le paiement PayPal a échoué. Veuillez réessayer.', 'El pago con PayPal falló. Por favor intente nuevamente.'],
  'expressCheckout.orPayWithCreditCard': ['Or Pay With Credit Card', 'Oder mit Kreditkarte bezahlen', 'Ou payer par carte de crédit', 'O pagar con tarjeta de crédito'],
};

const orderTracking: Catalog = {
  'orderTracking.searching': ['Searching...', 'Suche...', 'Recherche...', 'Buscando...'],
  'orderTracking.contactSupport': ['Contact Support', 'Support kontaktieren', 'Contacter le support', 'Contactar soporte'],
  'orderTracking.foundOrders': ['Found {count} order(s)', '{count} Bestellung(en) gefunden', '{count} commande(s) trouvée(s)', '{count} pedido(s) encontrado(s)'],
  'orderTracking.connectionError': ['Unable to connect. Please try again later.', 'Verbindung nicht möglich. Bitte versuchen Sie es später erneut.', 'Connexion impossible. Veuillez réessayer plus tard.', 'No se pudo conectar. Por favor intente más tarde.'],
};

const orderCard: Catalog = {
  'orderCard.paymentPending': ['Payment Pending', 'Zahlung ausstehend', 'Paiement en attente', 'Pago pendiente'],
  'orderCard.orderConfirmed': ['Order Confirmed', 'Bestellung bestätigt', 'Commande confirmée', 'Pedido confirmado'],
  'orderCard.shipped': ['Shipped', 'Versendet', 'Expédiée', 'Enviado'],
  'orderCard.delivered': ['Delivered', 'Zugestellt', 'Livrée', 'Entregado'],
  'orderCard.refunded': ['Refunded', 'Erstattet', 'Remboursée', 'Reembolsado'],
  'orderCard.partiallyRefunded': ['Partially Refunded', 'Teilweise erstattet', 'Partiellement remboursée', 'Parcialmente reembolsado'],
  'orderCard.trackPackage': ['Track Package', 'Paket verfolgen', 'Suivre le colis', 'Rastrear paquete'],
  'orderCard.items': ['Items', 'Artikel', 'Articles', 'Artículos'],
  'orderCard.qty': ['Qty:', 'Menge:', 'Qté :', 'Cant:'],
  'orderCard.shippingAddress': ['Shipping Address', 'Lieferadresse', 'Adresse de livraison', 'Dirección de envío'],
  'orderCard.totalPaid': ['Total Paid', 'Gesamtbetrag', 'Total payé', 'Total pagado'],
};

const shipment: Catalog = {
  'shipment.labelPrinted': ['Label Printed', 'Etikett gedruckt', 'Étiquette imprimée', 'Etiqueta impresa'],
  'shipment.labelPurchased': ['Label Purchased', 'Etikett gekauft', 'Étiquette achetée', 'Etiqueta comprada'],
  'shipment.attemptedDelivery': ['Delivery Attempted', 'Zustellung versucht', 'Tentative de livraison', 'Intento de entrega'],
  'shipment.readyForPickup': ['Ready for Pickup', 'Zur Abholung bereit', 'Prêt pour le retrait', 'Listo para recoger'],
  'shipment.confirmed': ['Shipment Confirmed', 'Sendung bestätigt', 'Expédition confirmée', 'Envío confirmado'],
  'shipment.inTransit': ['In Transit', 'Unterwegs', 'En transit', 'En tránsito'],
  'shipment.outForDelivery': ['Out for Delivery', 'In Zustellung', 'En cours de livraison', 'En camino de entrega'],
  'shipment.delivered': ['Delivered', 'Zugestellt', 'Livré', 'Entregado'],
  'shipment.failure': ['Delivery Failed', 'Zustellung fehlgeschlagen', 'Échec de livraison', 'Entrega fallida'],
  'shipment.pending': ['Processing', 'In Bearbeitung', 'En cours de traitement', 'En proceso'],
  'shipment.open': ['Shipped', 'Versendet', 'Expédié', 'Enviado'],
  'shipment.success': ['Delivered', 'Zugestellt', 'Livré', 'Entregado'],
};

const orderDetails: Catalog = {
  'orderDetails.orderReceived': ['Order Received!', 'Bestellung eingegangen!', 'Commande reçue !', '¡Pedido recibido!'],
  'orderDetails.pendingSubtitle': ['Thank you for your purchase. Your order has been received and payment is being processed.', 'Vielen Dank für Ihren Einkauf. Ihre Bestellung ist eingegangen und die Zahlung wird bearbeitet.', 'Merci pour votre achat. Votre commande a été reçue et le paiement est en cours de traitement.', 'Gracias por su compra. Su pedido ha sido recibido y el pago está siendo procesado.'],
  'orderDetails.paymentProcessing': ['Payment Processing', 'Zahlung wird verarbeitet', 'Traitement du paiement', 'Procesando pago'],
  'orderDetails.orderNotFound': ['Order not found', 'Bestellung nicht gefunden', 'Commande introuvable', 'Pedido no encontrado'],
  'orderDetails.orderNumber': ['Order Number:', 'Bestellnummer:', 'Numéro de commande :', 'Número de pedido:'],
  'orderDetails.date': ['Date:', 'Datum:', 'Date :', 'Fecha:'],
  'orderDetails.itemsOrdered': ['Items Ordered', 'Bestellte Artikel', 'Articles commandés', 'Artículos pedidos'],
  'orderDetails.qty': ['Qty:', 'Menge:', 'Qté :', 'Cant:'],
  'orderDetails.subtotal': ['Subtotal', 'Zwischensumme', 'Sous-total', 'Subtotal'],
  'orderDetails.shipping': ['Shipping', 'Versand', 'Livraison', 'Envío'],
  'orderDetails.free': ['FREE', 'KOSTENLOS', 'GRATUIT', 'GRATIS'],
  'orderDetails.discount': ['Discount', 'Rabatt', 'Réduction', 'Descuento'],
  'orderDetails.tax': ['Tax', 'Steuern', 'Taxes', 'Impuestos'],
  'orderDetails.taxIncluded': ['Included', 'Inklusive', 'Incluses', 'Incluidos'],
  'orderDetails.total': ['Total', 'Gesamt', 'Total', 'Total'],
  'orderDetails.totalPaid': ['Total paid', 'Gesamt bezahlt', 'Total payé', 'Total pagado'],
  'orderDetails.order': ['Order', 'Bestellung', 'Commande', 'Pedido'],
  'orderDetails.item': ['item', 'Artikel', 'article', 'artículo'],
  'orderDetails.items': ['items', 'Artikel', 'articles', 'artículos'],
  'orderDetails.shippingTo': ['Shipping to', 'Lieferung an', 'Livraison à', 'Envío a'],
  'orderDetails.paymentDelivery': ['Payment · delivery', 'Zahlung · Lieferung', 'Paiement · livraison', 'Pago · entrega'],
  'orderDetails.shippingAddress': ['Shipping Address', 'Lieferadresse', 'Adresse de livraison', 'Dirección de envío'],
  'orderDetails.billingAddress': ['Billing Address', 'Rechnungsadresse', 'Adresse de facturation', 'Dirección de facturación'],
  'orderDetails.paymentMethod': ['Payment Method', 'Zahlungsmethode', 'Mode de paiement', 'Método de pago'],
  'orderDetails.creditCard': ['Credit Card', 'Kreditkarte', 'Carte de crédit', 'Tarjeta de crédito'],
  'orderDetails.shareOn': ['Share on {platform}', 'Auf {platform} teilen', 'Partager sur {platform}', 'Compartir en {platform}'],
};

const addToOrder: Catalog = {
  'addToOrder.missingOrderInfo': ['Missing order information', 'Bestellinformationen fehlen', 'Informations de commande manquantes', 'Falta información del pedido'],
  'addToOrder.noProductSelected': ['No product selected', 'Kein Produkt ausgewählt', 'Aucun produit sélectionné', 'Ningún producto seleccionado'],
  'addToOrder.failedToAdd': ['Failed to add to order', 'Hinzufügen zur Bestellung fehlgeschlagen', 'Impossible d\'ajouter à la commande', 'Error al agregar al pedido'],
  'addToOrder.failedToProcess': ['Failed to process upsell', 'Upsell konnte nicht verarbeitet werden', 'Impossible de traiter l\'offre', 'Error al procesar la oferta'],
};

const misc: Catalog = {
  'reviews.starRating': ['{rating} Star Rating', '{rating}-Sterne-Bewertung', 'Note {rating} étoiles', 'Calificación de {rating} estrellas'],
  'reviews.verifiedBuyer': ['Verified Buyer', 'Verifizierter Käufer', 'Acheteur vérifié', 'Comprador verificado'],
  'richText.lastUpdated': ['Last updated:', 'Zuletzt aktualisiert:', 'Dernière mise à jour :', 'Última actualización:'],
};

const CATALOG: Catalog = {
  ...addressLabels,
  ...addressPlaceholders,
  ...checkoutFields,
  ...orderSummary,
  ...payment,
  ...paypalCard,
  ...productSelector,
  ...expressCheckout,
  ...orderTracking,
  ...orderCard,
  ...shipment,
  ...orderDetails,
  ...addToOrder,
  ...misc,
};

export type TranslationKey = keyof typeof CATALOG;
type LocaleMap = Record<TranslationKey, string>;

function projectLocale(index: number): LocaleMap {
  const map = {} as LocaleMap;
  for (const key of Object.keys(CATALOG) as TranslationKey[]) {
    map[key] = CATALOG[key][index];
  }
  return map;
}

const byLocale: Record<SupportedLanguage, LocaleMap> = {
  en: projectLocale(0),
  de: projectLocale(1),
  fr: projectLocale(2),
  es: projectLocale(3),
};

function normalizeLanguage(lang: SupportedLanguage | string): SupportedLanguage {
  return (lang in byLocale ? lang : 'en') as SupportedLanguage;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [name, value]) => acc.replace(`{${name}}`, String(value)),
    template,
  );
}

export function t(
  lang: SupportedLanguage | string,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const locale = normalizeLanguage(lang);
  const resolved = byLocale[locale][key] ?? byLocale.en[key] ?? key;
  return interpolate(resolved, params);
}

export function getTranslations(lang: SupportedLanguage | string): LocaleMap {
  return byLocale[normalizeLanguage(lang)];
}

export default byLocale;
