'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import {
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Phone,
  CreditCard
} from 'lucide-react';

const API_URL = 'http://localhost:3000';

export default function PaymentsPage() {
  const [pendingCount, setPendingCount] = useState(0);
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch pending count
      const pendingRes = await fetch(`${API_URL}/api/payment/pending`);
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPendingCount(pendingData.total || 0);
      }

      // Fetch payments
      const endpoint = filter === 'pending'
        ? `${API_URL}/api/payment/pending`
        : `${API_URL}/api/payment/all?status=${filter}`;

      const paymentsRes = await fetch(endpoint);
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData.payments);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (paymentId) => {
    setProcessing(paymentId);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/payment/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: paymentId })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: '¡Pago verificado correctamente!' });
        fetchData();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Error al verificar' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (paymentId) => {
    const reason = prompt('Razón del rechazo (opcional):');
    setProcessing(paymentId);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/payment/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: paymentId, reason })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Pago rechazado' });
        fetchData();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Error al rechazar' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('es-CR', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
      verified: 'bg-green-900/50 text-green-400 border-green-700',
      rejected: 'bg-red-900/50 text-red-400 border-red-700'
    };
    const labels = {
      pending: 'Pendiente',
      verified: 'Verificado',
      rejected: 'Rechazado'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getMethodIcon = (method) => {
    return method === 'sinpe'
      ? <Phone size={16} className="text-green-400" />
      : <CreditCard size={16} className="text-blue-400" />;
  };

  return (
    <div className="min-h-screen">
      <Header title="Pagos" />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Pending Count */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-900/50 rounded-lg">
              <Clock className="text-yellow-400" size={20} />
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Pagos Pendientes</p>
              <p className="text-2xl font-bold text-white">{pendingCount}</p>
            </div>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-900/50 border border-green-800 text-green-200'
              : 'bg-red-900/50 border border-red-800 text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'pending', label: 'Pendientes', icon: Clock },
            { key: 'verified', label: 'Verificados', icon: CheckCircle },
            { key: 'rejected', label: 'Rechazados', icon: XCircle },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                filter === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
          <button
            onClick={fetchData}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>

        {/* Payments Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : payments.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
            <p className="text-zinc-400">No hay pagos {filter === 'pending' ? 'pendientes' : filter === 'verified' ? 'verificados' : 'rechazados'}</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="text-left px-4 py-3 text-zinc-400 text-sm">Comprobante</th>
                  <th className="text-left px-4 py-3 text-zinc-400 text-sm">Usuario</th>
                  <th className="text-left px-4 py-3 text-zinc-400 text-sm">Método</th>
                  <th className="text-left px-4 py-3 text-zinc-400 text-sm">Fecha</th>
                  <th className="text-left px-4 py-3 text-zinc-400 text-sm">Estado</th>
                  {filter === 'pending' && (
                    <th className="text-left px-4 py-3 text-zinc-400 text-sm">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                    <td className="px-4 py-3">
                      {payment.proofs && payment.proofs[0] ? (
                        <a
                          href={`http://localhost:3000/api/payment/proof/${payment.proofs[0].file_path.split('/').pop()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          📷 Ver foto
                        </a>
                      ) : (
                        <span className="text-zinc-500">Sin foto</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium">{payment.user?.username || 'Sin nombre'}</p>
                        <p className="text-zinc-500 text-xs">ID: {payment.user_id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getMethodIcon(payment.payment_method)}
                        <span className="text-white capitalize">{payment.payment_method}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{formatDate(payment.created_at)}</td>
                    <td className="px-4 py-3">{getStatusBadge(payment.status)}</td>
                    {filter === 'pending' && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleVerify(payment.id)}
                            disabled={processing === payment.id}
                            className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white text-sm rounded-lg transition-colors"
                          >
                            {processing === payment.id ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle size={14} />
                            )}
                            Verificar
                          </button>
                          <button
                            onClick={() => handleReject(payment.id)}
                            disabled={processing === payment.id}
                            className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white text-sm rounded-lg transition-colors"
                          >
                            <XCircle size={14} />
                            Rechazar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}