'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard, Crown, Check, ExternalLink, Star,
  FileText, Download, Calendar, AlertCircle, Loader2
} from 'lucide-react';

const API_URL = 'http://localhost:3000';

const PLAN_COLORS = {
  free: 'from-zinc-600 to-zinc-700',
  pro: 'from-blue-600 to-blue-700',
  scale: 'from-purple-600 to-purple-700'
};

export default function BillingPanel({ user }) {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState({});
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Loading states
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);

  useEffect(() => {
    // Check for PayPal return from URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const paypalStatus = urlParams.get('paypal');

      if (paypalStatus === 'success') {
        setMessage({ type: 'success', text: '¡Pago exitoso! Tu suscripción está siendo procesada.' });
        // Clean URL
        window.history.replaceState({}, '', '/settings/account?tab=billing');
      } else if (paypalStatus === 'cancelled') {
        setMessage({ type: 'error', text: 'El pago fue cancelado.' });
        window.history.replaceState({}, '', '/settings/account?tab=billing');
      } else if (paypalStatus === 'error') {
        setMessage({ type: 'error', text: 'Hubo un error al procesar el pago.' });
        window.history.replaceState({}, '', '/settings/account?tab=billing');
      }
    }

    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [subRes, invoicesRes] = await Promise.all([
        fetch(`${API_URL}/api/account/subscription`, { headers }),
        fetch(`${API_URL}/api/account/invoices`, { headers })
      ]);

      if (subRes.ok) {
        const data = await subRes.json();
        setSubscription(data.subscription);
        setPlans(data.plans || {});
      }

      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Stripe checkout
  const handleStripeCheckout = async (plan) => {
    if (plan === 'free') return;

    setCheckoutLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/account/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });

      const data = await res.json();

      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al crear sesión de pago' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setCheckoutLoading(false);
    }
  };

  // PayPal checkout
  const handlePayPalCheckout = async (plan) => {
    if (plan === 'free') return;

    setPaypalLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/paypal/create-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });

      const data = await res.json();

      if (res.ok && data.approvalUrl) {
        // Redirect to PayPal approval page
        window.location.href = data.approvalUrl;
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al crear suscripción PayPal' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setPaypalLoading(false);
    }
  };

  const handleUpgrade = async (plan, method = 'stripe') => {
    if (method === 'paypal') {
      await handlePayPalCheckout(plan);
    } else {
      await handleStripeCheckout(plan);
    }
  };

  const handleOpenPortal = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/account/portal`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();

      if (res.ok && data.url) {
        window.open(data.url, '_blank');
      } else {
        setMessage({ type: 'error', text: data.error || 'No hay cuenta de facturación' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' });
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatAmount = (amount, currency = 'usd') => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
      </div>
    );
  }

  const currentPlan = subscription?.plan || 'free';

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-2xl ${
          message.type === 'success'
            ? 'bg-green-600/20 text-green-400 border border-green-600/30'
            : 'bg-red-600/20 text-red-400 border border-red-600/30'
        }`}>
          {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Crown size={18} />
          Plan Actual
        </h2>

        <div className={`p-6 rounded-2xl bg-gradient-to-r ${PLAN_COLORS[currentPlan] || PLAN_COLORS.free}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-bold text-white">
                  {plans[currentPlan]?.nameEs || 'Gratis'}
                </span>
                {currentPlan !== 'free' && (
                  <span className="text-white/80 text-sm">
                    ${plans[currentPlan]?.price}/mes
                  </span>
                )}
              </div>
              <p className="text-white/70 text-sm">
                {currentPlan === 'free'
                  ? 'Funcionalidades básicas'
                  : `Próxima facturación: ${formatDate(subscription?.current_period_end)}`
                }
              </p>
            </div>

            {currentPlan !== 'free' && (
              <button
                onClick={handleOpenPortal}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors"
              >
                <ExternalLink size={16} />
                Gestionar
              </button>
            )}
          </div>

          {/* Plan Features */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {plans[currentPlan]?.features?.slice(0, 4).map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-white/80 text-sm">
                <Check size={14} className="text-white/60" />
                {feature}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Available Plans */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Planes Disponibles</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(plans).map(([key, plan]) => {
            const isActive = currentPlan === key;
            const isUpgrade = key === 'pro' && currentPlan === 'free';
            const isDowngrade = key === 'free' && currentPlan !== 'free';

            return (
              <div
                key={key}
                className={`p-6 rounded-2xl border-2 ${
                  isActive
                    ? 'border-blue-500 bg-blue-600/10'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white">{plan.nameEs}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-white">${plan.price}</span>
                    {plan.price > 0 && <span className="text-zinc-400">/mes</span>}
                  </div>

                  <ul className="mt-4 space-y-2 text-left">
                    {plan.features?.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                        <Check size={14} className="text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isActive ? (
                    <div className="mt-4 px-4 py-2 bg-zinc-700 text-zinc-400 rounded-xl font-medium">
                      Plan Actual
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {/* PayPal Button */}
                      {!isDowngrade && (
                        <button
                          onClick={() => handleUpgrade(key, 'paypal')}
                          disabled={paypalLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0070ba] hover:bg-[#005ea6] text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                          {paypalLoading ? (
                            <Loader2 className="animate-spin h-4 w-4" />
                          ) : (
                            <>
                              <span className="text-lg">🅿️</span>
                              Pagar con PayPal
                            </>
                          )}
                        </button>
                      )}

                      {/* Stripe/Card Button */}
                      <button
                        onClick={() => handleUpgrade(key, 'stripe')}
                        disabled={checkoutLoading || isDowngrade}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
                          isDowngrade
                            ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                            : 'bg-zinc-700 hover:bg-zinc-600 text-white'
                        }`}
                      >
                        {checkoutLoading ? (
                          <Loader2 className="animate-spin h-4 w-4" />
                        ) : isDowngrade ? (
                          'Contactar Soporte'
                        ) : (
                          <>
                            <CreditCard size={18} />
                            Pagar con Tarjeta
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice History */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText size={18} />
          Historial de Facturas
        </h2>

        {invoices.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            <FileText size={48} className="mx-auto mb-3 opacity-50" />
            <p>No hay facturas disponibles</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-zinc-400 text-sm border-b border-zinc-700">
                  <th className="pb-3">Fecha</th>
                  <th className="pb-3">Descripción</th>
                  <th className="pb-3">Monto</th>
                  <th className="pb-3">Estado</th>
                  <th className="pb-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-zinc-800/50">
                    <td className="py-3 text-zinc-300">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-zinc-500" />
                        {formatDate(invoice.created_at)}
                      </div>
                    </td>
                    <td className="py-3 text-zinc-300">
                      {invoice.description || 'Suscripción'}
                    </td>
                    <td className="py-3 text-white font-medium">
                      {formatAmount(invoice.amount, invoice.currency)}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        invoice.status === 'paid'
                          ? 'bg-green-600/20 text-green-400'
                          : invoice.status === 'open'
                            ? 'bg-yellow-600/20 text-yellow-400'
                            : 'bg-zinc-600/20 text-zinc-400'
                      }`}>
                        {invoice.status === 'paid' ? 'Pagada' : invoice.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {invoice.invoice_pdf && (
                        <a
                          href={invoice.invoice_pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Download size={14} />
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {subscription?.stripe_customer_id && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <button
              onClick={handleOpenPortal}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
            >
              <ExternalLink size={14} />
              Gestionar facturación
            </button>
          </div>
        )}
      </div>
    </div>
  );
}