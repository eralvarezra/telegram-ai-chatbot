/**
 * Common payment methods worldwide
 * Based on most popular payment methods 2026
 */

const PAYMENT_METHODS = [
  // Digital/Mobile Wallets
  {
    id: 'paypal',
    name: 'PayPal',
    category: 'digital_wallet',
    icon: '💳',
    placeholder: 'usuario@email.com o link de PayPal',
    description: 'Billetera digital internacional',
    regions: ['global'],
    popular: true
  },
  {
    id: 'zelle',
    name: 'Zelle',
    category: 'digital_wallet',
    icon: '💵',
    placeholder: 'email o número telefónico',
    description: 'Transferencias rápidas USA',
    regions: ['usa'],
    popular: true
  },
  {
    id: 'cashapp',
    name: 'Cash App',
    category: 'digital_wallet',
    icon: '📱',
    placeholder: '$Cashtag o número telefónico',
    description: 'Pagos móviles USA',
    regions: ['usa', 'uk'],
    popular: true
  },
  {
    id: 'venmo',
    name: 'Venmo',
    category: 'digital_wallet',
    icon: '💸',
    placeholder: '@usuario o número telefónico',
    description: 'Pagos sociales USA',
    regions: ['usa'],
    popular: true
  },
  {
    id: 'apple_pay',
    name: 'Apple Pay',
    category: 'digital_wallet',
    icon: '🍎',
    placeholder: 'Número de tarjeta o email',
    description: 'Pagos con Apple',
    regions: ['global'],
    popular: false
  },
  {
    id: 'google_pay',
    name: 'Google Pay',
    category: 'digital_wallet',
    icon: '🔍',
    placeholder: 'Email asociado',
    description: 'Pagos con Google',
    regions: ['global'],
    popular: false
  },

  // Latin America
  {
    id: 'sinpe',
    name: 'SINPE Móvil',
    category: 'mobile_transfer',
    icon: '📱',
    placeholder: 'Número de teléfono',
    description: 'Transferencia móvil Costa Rica',
    regions: ['costa_rica'],
    popular: true
  },
  {
    id: 'pix',
    name: 'PIX',
    category: 'mobile_transfer',
    icon: '🇧🇷',
    placeholder: 'Clave PIX (email, CPF, teléfono o aleatoria)',
    description: 'Transferencias instantáneas Brasil',
    regions: ['brazil'],
    popular: true
  },
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    category: 'digital_wallet',
    icon: '🛒',
    placeholder: 'Email o CVU',
    description: 'Billetera digital Latinoamérica',
    regions: ['latam'],
    popular: true
  },
  {
    id: 'nequi',
    name: 'Nequi',
    category: 'mobile_transfer',
    icon: '💜',
    placeholder: 'Número de teléfono',
    description: 'Billetera móvil Colombia',
    regions: ['colombia'],
    popular: true
  },
  {
    id: 'daviplata',
    name: 'DaviPlata',
    category: 'mobile_transfer',
    icon: '🏦',
    placeholder: 'Número de teléfono',
    description: 'Billetera móvil Colombia',
    regions: ['colombia'],
    popular: false
  },
  {
    id: 'oxxo',
    name: 'OXXO',
    category: 'cash',
    icon: '🏪',
    placeholder: 'Número de referencia',
    description: 'Pago en efectivo México',
    regions: ['mexico'],
    popular: false
  },

  // Mexico
  {
    id: 'spei',
    name: 'SPEI',
    category: 'bank_transfer',
    icon: '🏦',
    placeholder: 'CLABE (18 dígitos)',
    description: 'Transferencia bancaria México',
    regions: ['mexico'],
    popular: true
  },

  // Europe
  {
    id: 'wise',
    name: 'Wise (TransferWise)',
    category: 'international',
    icon: '🌍',
    placeholder: 'Email o número de cuenta',
    description: 'Transferencias internacionales',
    regions: ['global'],
    popular: true
  },
  {
    id: 'revolut',
    name: 'Revolut',
    category: 'digital_wallet',
    icon: '🔴',
    placeholder: '@usuario o número',
    description: 'Billetera digital Europa/Global',
    regions: ['europe', 'global'],
    popular: false
  },
  {
    id: 'sepa',
    name: 'SEPA/IBAN',
    category: 'bank_transfer',
    icon: '🇪🇺',
    placeholder: 'IBAN (código de cuenta europeo)',
    description: 'Transferencia bancaria Europa',
    regions: ['europe'],
    popular: false
  },

  // BNPL (Buy Now Pay Later)
  {
    id: 'klarna',
    name: 'Klarna',
    category: 'bnpl',
    icon: '🛍️',
    placeholder: 'Email registrado',
    description: 'Compra ahora, paga después',
    regions: ['europe', 'usa'],
    popular: false
  },

  // Bank Transfer
  {
    id: 'bank_transfer',
    name: 'Transferencia Bancaria',
    category: 'bank_transfer',
    icon: '🏦',
    placeholder: 'Número de cuenta/CBU/CLABE',
    description: 'Transferencia directa a banco',
    regions: ['global'],
    popular: false
  },

  // Crypto
  {
    id: 'crypto_usdt',
    name: 'USDT (Tether)',
    category: 'crypto',
    icon: '₮',
    placeholder: 'Dirección de wallet USDT',
    description: 'Stablecoin (TRC20/ERC20)',
    regions: ['global'],
    popular: false
  },
  {
    id: 'crypto_btc',
    name: 'Bitcoin',
    category: 'crypto',
    icon: '₿',
    placeholder: 'Dirección de wallet BTC',
    description: 'Bitcoin',
    regions: ['global'],
    popular: false
  },

  // Special Option - Manual consultation
  {
    id: 'consult_user',
    name: 'Consultar con usuario',
    category: 'manual',
    icon: '💬',
    placeholder: 'Indicaciones para el usuario (opcional)',
    description: 'El usuario debe preguntar cómo pagar',
    regions: ['global'],
    popular: false,
    is_manual: true
  }
];

// Group payment methods by category
const PAYMENT_CATEGORIES = {
  digital_wallet: 'Billeteras Digitales',
  mobile_transfer: 'Transferencias Móviles',
  bank_transfer: 'Transferencias Bancarias',
  international: 'Internacionales',
  crypto: 'Criptomonedas',
  cash: 'Pago en Efectivo',
  bnpl: 'Compra Ahora, Paga Después',
  manual: 'Otras Opciones'
};

// Get popular payment methods (for quick select)
const POPULAR_METHODS = PAYMENT_METHODS.filter(m => m.popular).map(m => m.id);

// Get methods by region
const getMethodsByRegion = (region) => {
  return PAYMENT_METHODS.filter(m =>
    m.regions.includes('global') || m.regions.includes(region)
  );
};

// Get method by ID
const getMethodById = (id) => {
  return PAYMENT_METHODS.find(m => m.id === id);
};

module.exports = {
  PAYMENT_METHODS,
  PAYMENT_CATEGORIES,
  POPULAR_METHODS,
  getMethodsByRegion,
  getMethodById
};