'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Save, RefreshCw, User, CreditCard, MessageSquare, Settings as SettingsIcon, Sparkles, Bell, Key, Link2, Unlink, AlertTriangle, X, Send, Play, Square, Bot, Plus, Trash2, Check, Package, Eye, EyeOff, Edit2, DollarSign } from 'lucide-react';

export default function SettingsPage() {
  const [config, setConfig] = useState({
    bot_name: 'Shey',
    bot_location: 'Costa Rica',
    bot_age: 25,
    paypal_link: '',
    sinpe_number: '',
    products: 'Sexting personalizado,Videollamadas privadas,Packs de fotos/videos,Videos personalizados',
    personality: 'Caliente, atrevida, sin filtro. Te gusta hablar sucio. Coqueta pero no empalagosa.',
    response_style: 'short',
    typing_delay: true,
    typing_speed_min: 200,
    typing_speed_max: 400,
    media_keyword_trigger: true,
    payment_confirm_message: '',
    user_gender_mode: 'auto'
  });
  const [credentials, setCredentials] = useState({ telegram: null, ai: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // Bot control state
  const [botStatus, setBotStatus] = useState(null);
  const [botLoading, setBotLoading] = useState(false);

  // Telegram verification state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyStep, setVerifyStep] = useState('code'); // 'code' or 'password'
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [authStatus, setAuthStatus] = useState('idle');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Telegram form state
  const [telegramApiId, setTelegramApiId] = useState('');
  const [telegramApiHash, setTelegramApiHash] = useState('');
  const [telegramPhone, setTelegramPhone] = useState('');

  // AI form state
  const [aiApiKey, setAiApiKey] = useState('');

  // Payment methods state
  const [availableMethods, setAvailableMethods] = useState([]);
  const [paymentCategories, setPaymentCategories] = useState({});
  const [configuredMethods, setConfiguredMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [accountIdentifier, setAccountIdentifier] = useState('');
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);

  // Products state
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '' });

  const API_URL = 'http://localhost:3000';

  useEffect(() => {
    fetchConfig();
    fetchCredentials();
    fetchBotStatus();
    fetchPaymentMethods();
    fetchProducts();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config/bot-config`);
      if (res.ok) {
        const data = await res.json();
        // Ensure user_gender_mode has a default value
        setConfig({
          ...data,
          user_gender_mode: data.user_gender_mode || 'auto'
        });
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCredentials = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/credentials/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCredentials(data);
      }
    } catch (err) {
      console.error('Error fetching credentials:', err);
    }
  };

  const fetchBotStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/bot/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setBotStatus(data);
      }
    } catch (err) {
      console.error('Error fetching bot status:', err);
    }
  };

  const handleStartBot = async () => {
    setBotLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/bot/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: '¡Bot iniciado correctamente!' });
        fetchBotStatus();
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al iniciar el bot' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setBotLoading(false);
    }
  };

  const handleStopBot = async () => {
    setBotLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/bot/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Bot detenido correctamente' });
        fetchBotStatus();
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al detener el bot' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setBotLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const [availableRes, configuredRes] = await Promise.all([
        fetch(`${API_URL}/api/payment-methods/available`),
        fetch(`${API_URL}/api/payment-methods/all`)
      ]);

      if (availableRes.ok) {
        const data = await availableRes.json();
        setAvailableMethods(data.methods || []);
        setPaymentCategories(data.categories || {});
      }

      if (configuredRes.ok) {
        const data = await configuredRes.json();
        setConfiguredMethods(data.methods || []);
      }
    } catch (err) {
      console.error('Error fetching payment methods:', err);
    }
  };

  // Products functions
  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setProductsLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!productForm.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre del producto es requerido' });
      return;
    }

    setProductsLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: productForm.name,
          description: productForm.description || null,
          price: productForm.price ? parseFloat(productForm.price) : null
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Producto agregado' });
        setProductForm({ name: '', description: '', price: '' });
        setShowProductModal(false);
        fetchProducts();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Error al agregar producto' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setProductsLoading(false);
    }
  };

  const handleUpdateProduct = async () => {
    if (!productForm.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre del producto es requerido' });
      return;
    }

    setProductsLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: productForm.name,
          description: productForm.description || null,
          price: productForm.price ? parseFloat(productForm.price) : null
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Producto actualizado' });
        setProductForm({ name: '', description: '', price: '' });
        setEditingProduct(null);
        setShowProductModal(false);
        fetchProducts();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Error al actualizar producto' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setProductsLoading(false);
    }
  };

  const handleToggleProduct = async (id) => {
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${API_URL}/api/products/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchProducts();
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al cambiar estado' });
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('¿Eliminar este producto? El media asociado quedará sin producto.')) return;

    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${API_URL}/api/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: 'Producto eliminado' });
      fetchProducts();
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al eliminar producto' });
    }
  };

  const openEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      price: product.price || ''
    });
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setEditingProduct(null);
    setProductForm({ name: '', description: '', price: '' });
  };

  const handleAddPaymentMethod = async () => {
    if (!selectedMethod) {
      setMessage({ type: 'error', text: 'Selecciona un método de pago' });
      return;
    }

    const method = availableMethods.find(m => m.id === selectedMethod);
    if (!method) return;

    // For "consult_user" method, account identifier is optional
    if (!method.is_manual && !accountIdentifier.trim()) {
      setMessage({ type: 'error', text: 'El número de cuenta es requerido' });
      return;
    }

    setPaymentMethodsLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method_type: selectedMethod,
          account_identifier: accountIdentifier.trim() || 'Consultar con usuario',
          display_order: configuredMethods.length
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Método de pago agregado' });
        setSelectedMethod('');
        setAccountIdentifier('');
        fetchPaymentMethods();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Error al agregar método' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setPaymentMethodsLoading(false);
    }
  };

  const handleTogglePaymentMethod = async (id) => {
    try {
      await fetch(`${API_URL}/api/payment-methods/${id}/toggle`, { method: 'POST' });
      fetchPaymentMethods();
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al cambiar estado' });
    }
  };

  const handleDeletePaymentMethod = async (id) => {
    try {
      await fetch(`${API_URL}/api/payment-methods/${id}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'Método eliminado' });
      fetchPaymentMethods();
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al eliminar método' });
    }
  };

  // Get the selected method's info for placeholder
  const getSelectedMethodInfo = () => {
    return availableMethods.find(m => m.id === selectedMethod);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/config/bot-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (res.ok) {
        setMessage({ type: 'success', text: '¡Configuración guardada!' });
      } else {
        throw new Error('Error saving');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleUnlink = async (type) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/credentials/${type}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        setMessage({ type: 'success', text: type === 'telegram' ? 'Telegram desvinculado' : 'API de IA desvinculada' });
        fetchCredentials();
        fetchBotStatus();
      } else {
        throw new Error('Error al desvincular');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al desvincular' });
    } finally {
      setShowUnlinkConfirm(null);
    }
  };

  const handleTelegramConnect = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalMessage('');

    try {
      const token = localStorage.getItem('auth_token');

      // Save credentials first
      const credRes = await fetch(`${API_URL}/api/credentials/telegram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          apiId: telegramApiId,
          apiHash: telegramApiHash,
          phone: telegramPhone
        })
      });

      if (!credRes.ok) {
        const data = await credRes.json();
        setModalMessage(data.error || 'Error al guardar credenciales');
        setModalLoading(false);
        return;
      }

      // Start Telegram connection
      const connectRes = await fetch(`${API_URL}/api/telegram/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const connectData = await connectRes.json();

      if (connectData.status === 'connected') {
        setModalMessage('¡Telegram conectado exitosamente!');
        fetchCredentials();
        setTimeout(() => {
          setShowTelegramModal(false);
          setTelegramApiId('');
          setTelegramApiHash('');
          setTelegramPhone('');
        }, 1500);
      } else if (connectData.status === 'waiting_code') {
        // Need verification code - show verify modal
        setPhoneNumber(connectData.phoneNumber);
        setAuthStatus('waiting_code');
        setShowTelegramModal(false);
        setVerifyStep('code');
        setShowVerifyModal(true);
      } else {
        setModalMessage(connectData.error || 'Error al conectar');
      }
    } catch (err) {
      setModalMessage('Error de conexión');
    } finally {
      setModalLoading(false);
    }
  };

  // Handle verification code submission
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalMessage('');

    const token = localStorage.getItem('auth_token');

    try {
      const res = await fetch(`${API_URL}/api/telegram/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: verificationCode })
      });

      const data = await res.json();

      if (data.status === 'connected') {
        setModalMessage('¡Telegram conectado exitosamente!');
        fetchCredentials();
        fetchBotStatus();
        setTimeout(() => {
          setShowVerifyModal(false);
          setVerificationCode('');
        }, 1500);
      } else if (data.status === 'waiting_password') {
        setVerifyStep('password');
        setModalMessage('');
      } else {
        setModalMessage(data.error || 'Error al verificar código');
      }
    } catch (err) {
      setModalMessage('Error de conexión');
    } finally {
      setModalLoading(false);
    }
  };

  // Handle 2FA password submission
  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalMessage('');

    const token = localStorage.getItem('auth_token');

    try {
      const res = await fetch(`${API_URL}/api/telegram/verify-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: twoFactorPassword })
      });

      const data = await res.json();

      if (data.status === 'connected') {
        setModalMessage('¡Telegram conectado exitosamente!');
        fetchCredentials();
        fetchBotStatus();
        setTimeout(() => {
          setShowVerifyModal(false);
          setTwoFactorPassword('');
        }, 1500);
      } else {
        setModalMessage(data.error || 'Contraseña incorrecta');
      }
    } catch (err) {
      setModalMessage('Error de conexión');
    } finally {
      setModalLoading(false);
    }
  };

  // Check auth status on mount if needs_auth
  useEffect(() => {
    if (credentials.telegram?.configured && !credentials.telegram?.connected) {
      // Check if there's a pending auth
      const checkAuthStatus = async () => {
        const token = localStorage.getItem('auth_token');
        try {
          const res = await fetch(`${API_URL}/api/telegram/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.status === 'waiting_code') {
            setAuthStatus('waiting_code');
            setPhoneNumber(data.phoneNumber);
          } else if (data.status === 'waiting_password') {
            setAuthStatus('waiting_password');
          }
        } catch (err) {
          console.error('Error checking auth status:', err);
        }
      };
      checkAuthStatus();
    }
  }, [credentials]);

  const handleAiConnect = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalMessage('');

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/credentials/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          apiKey: aiApiKey,
          provider: 'groq'
        })
      });

      if (res.ok) {
        setModalMessage('¡API de Groq configurada correctamente!');
        fetchCredentials();
        setTimeout(() => {
          setShowAiModal(false);
          setAiApiKey('');
        }, 1500);
      } else {
        const data = await res.json();
        setModalMessage(data.error || 'Error al guardar');
      }
    } catch (err) {
      setModalMessage('Error de conexión');
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Configuración" />

      <div className="p-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6">Configuración del Bot</h2>

        {/* Personality Settings Link */}
        <div className="mb-6 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="text-purple-400" size={24} />
              <div>
                <h3 className="text-white font-semibold">Advanced Personality Settings</h3>
                <p className="text-zinc-400 text-sm">Customize tone, engagement, sales strategy & more</p>
              </div>
            </div>
            <a
              href="/settings/personality"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Configure →
            </a>
          </div>
        </div>

        {/* API Credentials Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Key className="text-amber-500" size={24} />
            <h3 className="text-lg font-semibold text-white">APIs Vinculadas</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Telegram Status */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Link2 className="text-blue-400" size={18} />
                  <span className="text-white font-medium">Telegram</span>
                </div>
                {credentials.telegram ? (
                  credentials.telegram.connected ? (
                    <span className="px-2 py-1 bg-green-900/50 text-green-400 text-xs rounded-full">Conectado</span>
                  ) : (
                    <span className="px-2 py-1 bg-yellow-900/50 text-yellow-400 text-xs rounded-full">Configurado</span>
                  )
                ) : (
                  <span className="px-2 py-1 bg-red-900/50 text-red-400 text-xs rounded-full">No configurado</span>
                )}
              </div>
              {credentials.telegram && (
                <div className="text-sm text-zinc-400 mb-3">
                  <p>Teléfono: {credentials.telegram.phone}</p>
                  <p className="text-xs text-zinc-500">API ID: {credentials.telegram.apiId}</p>
                  {!credentials.telegram.connected && (
                    <p className="text-xs text-yellow-400 mt-1">⚠️ Verifica tu cuenta para completar la conexión</p>
                  )}
                </div>
              )}
              {credentials.telegram ? (
                credentials.telegram.connected ? (
                  showUnlinkConfirm === 'telegram' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUnlink('telegram')}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setShowUnlinkConfirm(null)}
                        className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowUnlinkConfirm('telegram')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 text-red-400 text-sm rounded-lg transition-colors"
                    >
                      <Unlink size={14} />
                      Desvincular
                    </button>
                  )
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setVerifyStep('code');
                        setShowVerifyModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg transition-colors"
                    >
                      <Key size={14} />
                      Verificar
                    </button>
                    <button
                      onClick={() => setShowTelegramModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                      <Link2 size={14} />
                      Reconfigurar
                    </button>
                    <button
                      onClick={() => setShowUnlinkConfirm('telegram')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 text-red-400 text-sm rounded-lg transition-colors"
                    >
                      <Unlink size={14} />
                    </button>
                  </div>
                )
              ) : (
                <button
                  onClick={() => setShowTelegramModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  <Link2 size={14} />
                  Conectar
                </button>
              )}
            </div>

            {/* Groq/AI Status */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Key className="text-orange-400" size={18} />
                  <span className="text-white font-medium">Groq / IA</span>
                </div>
                {credentials.ai ? (
                  <span className="px-2 py-1 bg-green-900/50 text-green-400 text-xs rounded-full">Conectado</span>
                ) : (
                  <span className="px-2 py-1 bg-red-900/50 text-red-400 text-xs rounded-full">No conectado</span>
                )}
              </div>
              {credentials.ai && (
                <div className="text-sm text-zinc-400 mb-3">
                  <p>Provider: {credentials.ai.provider.toUpperCase()}</p>
                  <p className="text-xs text-zinc-500">Key: {credentials.ai.keyPreview}</p>
                </div>
              )}
              {credentials.ai ? (
                showUnlinkConfirm === 'ai' ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUnlink('ai')}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setShowUnlinkConfirm(null)}
                      className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowUnlinkConfirm('ai')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 text-red-400 text-sm rounded-lg transition-colors"
                  >
                    <Unlink size={14} />
                    Desvincular
                  </button>
                )
              ) : (
                <button
                  onClick={() => setShowAiModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  <Key size={14} />
                  Configurar
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 p-3 bg-amber-900/20 border border-amber-800/50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="text-amber-400 flex-shrink-0" size={18} />
              <p className="text-amber-200 text-sm">
                <strong>Advertencia:</strong> Desvincular una API detendrá el funcionamiento del bot. Los usuarios perderán acceso hasta que vuelvas a conectar.
              </p>
            </div>
          </div>
        </div>

        {/* Bot Control Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Bot className="text-green-500" size={24} />
            <h3 className="text-lg font-semibold text-white">Control del Bot</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Card */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-400">Estado actual:</span>
                {botStatus?.status === 'running' ? (
                  <span className="flex items-center gap-2 px-3 py-1 bg-green-900/50 text-green-400 text-sm rounded-full">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    Activo
                  </span>
                ) : botStatus?.status === 'stopped' ? (
                  <span className="flex items-center gap-2 px-3 py-1 bg-zinc-700 text-zinc-300 text-sm rounded-full">
                    <span className="w-2 h-2 bg-zinc-500 rounded-full"></span>
                    Detenido
                  </span>
                ) : botStatus?.status === 'needs_auth' ? (
                  <span className="flex items-center gap-2 px-3 py-1 bg-yellow-900/50 text-yellow-400 text-sm rounded-full">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                    Requiere Auth
                  </span>
                ) : botStatus?.status === 'not_configured' ? (
                  <span className="flex items-center gap-2 px-3 py-1 bg-red-900/50 text-red-400 text-sm rounded-full">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    No Configurado
                  </span>
                ) : (
                  <span className="flex items-center gap-2 px-3 py-1 bg-zinc-700 text-zinc-400 text-sm rounded-full">
                    --
                  </span>
                )}
              </div>
              {botStatus?.userInfo && (
                <div className="text-sm text-zinc-400">
                  <p>Conectado como: <span className="text-white">@{botStatus.userInfo.username || botStatus.userInfo.firstName}</span></p>
                  {botStatus.startedAt && (
                    <p className="text-xs text-zinc-500 mt-1">
                      Iniciado: {new Date(botStatus.startedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Control Card */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <div className="flex flex-col h-full justify-between">
                <div className="mb-4">
                  <p className="text-zinc-400 text-sm mb-2">
                    {botStatus?.status === 'running'
                      ? 'El bot está escuchando mensajes de Telegram.'
                      : botStatus?.status === 'needs_auth'
                      ? 'Las credenciales están configuradas pero falta completar la autenticación.'
                      : botStatus?.status === 'not_configured'
                      ? 'Configura las credenciales de Telegram primero.'
                      : 'Inicia el bot para comenzar a responder mensajes.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {botStatus?.status === 'running' ? (
                    <button
                      onClick={handleStopBot}
                      disabled={botLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white rounded-lg transition-colors font-medium"
                    >
                      {botLoading ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Deteniendo...
                        </>
                      ) : (
                        <>
                          <Square size={18} />
                          Detener Bot
                        </>
                      )}
                    </button>
                  ) : botStatus?.status === 'needs_auth' ? (
                    <button
                      onClick={() => {
                        setVerifyStep('code');
                        setShowVerifyModal(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors font-medium"
                    >
                      <Key size={18} />
                      Verificar Telegram
                    </button>
                  ) : (
                    <button
                      onClick={handleStartBot}
                      disabled={botLoading || botStatus?.status === 'not_configured'}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                    >
                      {botLoading ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Iniciando...
                        </>
                      ) : (
                        <>
                          <Play size={18} />
                          Iniciar Bot
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={fetchBotStatus}
                    disabled={botLoading}
                    className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-700/50 text-white rounded-lg transition-colors"
                    title="Actualizar estado"
                  >
                    <RefreshCw size={18} className={botLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {botStatus?.status === 'not_configured' && (
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-800/50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-yellow-400 flex-shrink-0" size={18} />
                <p className="text-yellow-200 text-sm">
                  <strong>Sin configurar:</strong> Debes configurar las credenciales de Telegram en la sección de arriba antes de iniciar el bot.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Telegram Modal */}
        {showTelegramModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">Conectar Telegram</h3>
                <button
                  onClick={() => setShowTelegramModal(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <p className="text-zinc-400 text-sm mb-4">
                Obtén tus credenciales en{' '}
                <a href="https://my.telegram.org/apps" target="_blank" className="text-blue-500 hover:underline">
                  my.telegram.org/apps
                </a>
              </p>

              {modalMessage && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${modalMessage.includes('Error') ? 'bg-red-900/50 border border-red-800 text-red-200' : 'bg-green-900/50 border border-green-800 text-green-200'}`}>
                  {modalMessage}
                </div>
              )}

              <form onSubmit={handleTelegramConnect} className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">API ID</label>
                  <input
                    type="text"
                    value={telegramApiId}
                    onChange={(e) => setTelegramApiId(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="12345678"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">API Hash</label>
                  <input
                    type="text"
                    value={telegramApiHash}
                    onChange={(e) => setTelegramApiHash(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="a1b2c3d4e5f6..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Número de teléfono</label>
                  <input
                    type="text"
                    value={telegramPhone}
                    onChange={(e) => setTelegramPhone(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="+50661714036"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTelegramModal(false)}
                    className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {modalLoading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Conectar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* AI Modal */}
        {showAiModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">Configurar Groq / IA</h3>
                <button
                  onClick={() => setShowAiModal(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <p className="text-zinc-400 text-sm mb-4">
                Obtén tu API key en{' '}
                <a href="https://console.groq.com/keys" target="_blank" className="text-blue-500 hover:underline">
                  console.groq.com/keys
                </a>
              </p>

              {modalMessage && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${modalMessage.includes('Error') ? 'bg-red-900/50 border border-red-800 text-red-200' : 'bg-green-900/50 border border-green-800 text-green-200'}`}>
                  {modalMessage}
                </div>
              )}

              <form onSubmit={handleAiConnect} className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">API Key de Groq</label>
                  <input
                    type="text"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="gsk_..."
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAiModal(false)}
                    className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {modalLoading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Key size={16} />
                        Guardar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Verification Modal */}
        {showVerifyModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">
                  {verifyStep === 'code' ? 'Verificar Telegram' : 'Verificación en Dos Pasos'}
                </h3>
                <button
                  onClick={() => {
                    setShowVerifyModal(false);
                    setVerificationCode('');
                    setTwoFactorPassword('');
                    setModalMessage('');
                  }}
                  className="text-zinc-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              {verifyStep === 'code' ? (
                <>
                  <p className="text-zinc-400 text-sm mb-4">
                    Ingresa el código de verificación enviado a tu Telegram
                  </p>
                  {phoneNumber && (
                    <p className="text-zinc-300 text-sm mb-4">
                      📱 Número: <span className="text-white font-medium">{phoneNumber}</span>
                    </p>
                  )}

                  {modalMessage && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${modalMessage.includes('Error') || modalMessage.includes('incorrecto') ? 'bg-red-900/50 border border-red-800 text-red-200' : 'bg-green-900/50 border border-green-800 text-green-200'}`}>
                      {modalMessage}
                    </div>
                  )}

                  <form onSubmit={handleVerifyCode} className="space-y-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Código de verificación</label>
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-blue-500"
                        placeholder="12345"
                        maxLength={6}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowVerifyModal(false);
                          setVerificationCode('');
                          setModalMessage('');
                        }}
                        className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={modalLoading || verificationCode.length < 4}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {modalLoading ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          <>
                            <Send size={16} />
                            Verificar
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <p className="text-zinc-400 text-sm mb-4">
                    Tu cuenta tiene verificación en dos pasos activada. Ingresa tu contraseña.
                  </p>

                  {modalMessage && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${modalMessage.includes('Error') || modalMessage.includes('incorrecta') ? 'bg-red-900/50 border border-red-800 text-red-200' : 'bg-green-900/50 border border-green-800 text-green-200'}`}>
                      {modalMessage}
                    </div>
                  )}

                  <form onSubmit={handleVerifyPassword} className="space-y-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Contraseña de verificación</label>
                      <input
                        type="password"
                        value={twoFactorPassword}
                        onChange={(e) => setTwoFactorPassword(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                        placeholder="••••••••"
                        required
                        autoFocus
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowVerifyModal(false);
                          setTwoFactorPassword('');
                          setModalMessage('');
                        }}
                        className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={modalLoading || !twoFactorPassword}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {modalLoading ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          <>
                            <Key size={16} />
                            Verificar
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-900/50 border border-green-800 text-green-200' : 'bg-red-900/50 border border-red-800 text-red-200'}`}>
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          {/* Identity Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <User className="text-blue-500" size={24} />
              <h3 className="text-lg font-semibold text-white">Identidad</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Nombre del bot</label>
                <input
                  type="text"
                  value={config.bot_name}
                  onChange={(e) => handleChange('bot_name', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Ubicación</label>
                <input
                  type="text"
                  value={config.bot_location}
                  onChange={(e) => handleChange('bot_location', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Edad</label>
                <input
                  type="number"
                  value={config.bot_age}
                  onChange={(e) => handleChange('bot_age', parseInt(e.target.value))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                />
              </div>
            </div>

            {/* Gender Reference Mode */}
            <div className="mt-4">
              <label className="block text-sm text-zinc-400 mb-2">Referencia de género del usuario</label>
              <p className="text-xs text-zinc-500 mb-2">Cómo debe referirse el bot al usuario</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleChange('user_gender_mode', 'female')}
                  className={`p-3 rounded-lg border transition-colors text-left ${
                    config.user_gender_mode === 'female'
                      ? 'bg-pink-900/30 border-pink-600 text-pink-200'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  <div className="font-medium">👩 Siempre mujer</div>
                  <div className="text-xs opacity-75">Tratar a todos como "ella"</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('user_gender_mode', 'male')}
                  className={`p-3 rounded-lg border transition-colors text-left ${
                    config.user_gender_mode === 'male'
                      ? 'bg-blue-900/30 border-blue-600 text-blue-200'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  <div className="font-medium">👨 Siempre hombre</div>
                  <div className="text-xs opacity-75">Tratar a todos como "él"</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('user_gender_mode', 'auto')}
                  className={`p-3 rounded-lg border transition-colors text-left ${
                    config.user_gender_mode === 'auto'
                      ? 'bg-purple-900/30 border-purple-600 text-purple-200'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  <div className="font-medium">🤖 Detectar automáticamente</div>
                  <div className="text-xs opacity-75">La IA infiere el género</div>
                </button>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="text-green-500" size={24} />
              <h3 className="text-lg font-semibold text-white">Métodos de Pago</h3>
            </div>

            {/* Add New Payment Method */}
            <div className="mb-6 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <h4 className="text-sm font-medium text-zinc-300 mb-3">Agregar Método de Pago</h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Dropdown */}
                <div className="md:col-span-1">
                  <label className="block text-xs text-zinc-400 mb-1">Método *</label>
                  <select
                    value={selectedMethod}
                    onChange={(e) => {
                      setSelectedMethod(e.target.value);
                      setAccountIdentifier('');
                    }}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {Object.entries(paymentCategories).map(([categoryKey, categoryName]) => {
                      const methodsInCategory = availableMethods.filter(m => m.category === categoryKey);
                      if (methodsInCategory.length === 0) return null;
                      return (
                        <optgroup key={categoryKey} label={categoryName}>
                          {methodsInCategory.map(method => (
                            <option key={method.id} value={method.id}>
                              {method.icon} {method.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>

                {/* Account Identifier */}
                <div className="md:col-span-1">
                  <label className="block text-xs text-zinc-400 mb-1">
                    {getSelectedMethodInfo()?.is_manual ? 'Indicaciones (opcional)' : 'Número de cuenta / Link *'}
                  </label>
                  <input
                    type="text"
                    value={accountIdentifier}
                    onChange={(e) => setAccountIdentifier(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                    placeholder={getSelectedMethodInfo()?.placeholder || 'Ingresa el dato'}
                    disabled={!selectedMethod}
                  />
                </div>

                {/* Add Button */}
                <div className="md:col-span-1 flex items-end">
                  <button
                    onClick={handleAddPaymentMethod}
                    disabled={!selectedMethod || paymentMethodsLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Plus size={16} />
                    Agregar
                  </button>
                </div>
              </div>

              {selectedMethod && getSelectedMethodInfo() && (
                <p className="text-xs text-zinc-500 mt-2">
                  {getSelectedMethodInfo().description}
                </p>
              )}
            </div>

            {/* Configured Payment Methods List */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-zinc-300 mb-2">Métodos Configurados</h4>

              {configuredMethods.length === 0 ? (
                <p className="text-sm text-zinc-500 italic">
                  No hay métodos de pago configurados. Agrega uno arriba.
                </p>
              ) : (
                <div className="space-y-2">
                  {configuredMethods.map((method) => {
                    const methodInfo = availableMethods.find(m => m.id === method.method_type);
                    return (
                      <div
                        key={method.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          method.is_active
                            ? 'bg-zinc-800 border-zinc-700'
                            : 'bg-zinc-900 border-zinc-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{methodInfo?.icon || '💳'}</span>
                          <div>
                            <p className="text-sm font-medium text-white">{methodInfo?.name || method.method_type}</p>
                            <p className="text-xs text-zinc-400">
                              {method.is_manual
                                ? 'Consultar con usuario'
                                : method.account_identifier}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTogglePaymentMethod(method.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              method.is_active
                                ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                                : 'bg-zinc-700 text-zinc-500 hover:bg-zinc-600'
                            }`}
                            title={method.is_active ? 'Activo - Click para desactivar' : 'Inactivo - Click para activar'}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleDeletePaymentMethod(method.id)}
                            className="p-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="text-xs text-zinc-500 mt-4">
              Los métodos activos se mostrarán a los usuarios cuando pregunten por métodos de pago.
              El método "Consultar con usuario" permite respuestas manuales.
            </p>
          </div>

          {/* Products Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Package className="text-purple-500" size={24} />
                <h3 className="text-lg font-semibold text-white">Productos y Servicios</h3>
              </div>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setProductForm({ name: '', description: '', price: '' });
                  setShowProductModal(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus size={16} />
                Agregar
              </button>
            </div>

            {productsLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-6 text-zinc-500">
                <Package size={32} className="mx-auto mb-2 opacity-50" />
                <p>No hay productos configurados</p>
                <p className="text-sm">Agrega productos para organizar tu contenido</p>
              </div>
            ) : (
              <div className="space-y-2">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${product.is_active ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-800/50 border-zinc-700/50 opacity-60'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-medium truncate">{product.name}</h4>
                        {product.price && (
                          <span className="text-green-400 text-sm">${product.price}</span>
                        )}
                        {!product.is_active && (
                          <span className="px-2 py-0.5 bg-zinc-700 text-zinc-400 text-xs rounded">Inactivo</span>
                        )}
                      </div>
                      {product.description && (
                        <p className="text-zinc-500 text-sm whitespace-pre-line">{product.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleProduct(product.id)}
                        className={`p-1.5 rounded-lg transition-colors ${product.is_active ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'}`}
                        title={product.is_active ? 'Desactivar' : 'Activar'}
                      >
                        {product.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button
                        onClick={() => openEditProduct(product)}
                        className="p-1.5 rounded-lg bg-zinc-700 text-zinc-400 hover:text-blue-400 hover:bg-zinc-600 transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-zinc-500 mt-4">
              Los productos activos se mostrarán en el menú de servicios del bot. Puedes vincular contenido multimedia a cada producto desde la sección Media.
            </p>
          </div>

          {/* Product Modal */}
          {showProductModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                  </h3>
                  <button onClick={closeProductModal} className="text-zinc-400 hover:text-white">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                      placeholder="e.g., Sexting Personalizado"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Descripción</label>
                    <textarea
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      rows={6}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white resize-none"
                      placeholder="Descripción opcional con formato (usa Enter para nuevas líneas)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Precio</label>
                    <div className="relative">
                      <DollarSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="number"
                        step="0.01"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-white"
                        placeholder="9.99"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={closeProductModal}
                    className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={editingProduct ? handleUpdateProduct : handleAddProduct}
                    disabled={productsLoading || !productForm.name.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
                  >
                    {productsLoading ? 'Guardando...' : editingProduct ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Payment Confirmation Message */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="text-yellow-500" size={24} />
              <h3 className="text-lg font-semibold text-white">Mensaje de Confirmación de Pago</h3>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Mensaje cuando recibes un comprobante</label>
              <textarea
                value={config.payment_confirm_message || ''}
                onChange={(e) => handleChange('payment_confirm_message', e.target.value)}
                rows={4}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                placeholder="📸 ¡Recibí tu comprobante!&#10;&#10;✅ Voy a verificarlo, muchas gracias por tu compra! 💕&#10;&#10;Te aviso en cuanto esté listo."
              />
              <p className="text-xs text-zinc-500 mt-2">
                Este mensaje se envía cuando el usuario envía una foto de comprobante de pago. Deja vacío para usar el mensaje por defecto.
              </p>
            </div>
          </div>

          {/* Basic Personality Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <SettingsIcon className="text-yellow-500" size={24} />
              <h3 className="text-lg font-semibold text-white">Personalidad Básica</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Descripción de personalidad</label>
                <textarea
                  value={config.personality}
                  onChange={(e) => handleChange('personality', e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                  placeholder="Caliente, atrevida, sin filtro..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Estilo de respuesta</label>
                  <select
                    value={config.response_style}
                    onChange={(e) => handleChange('response_style', e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="short">Corto (1-2 líneas)</option>
                    <option value="medium">Medio (2-3 líneas)</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="typing_delay"
                    checked={config.typing_delay}
                    onChange={(e) => handleChange('typing_delay', e.target.checked)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700"
                  />
                  <label htmlFor="typing_delay" className="text-zinc-300">Simular delay de escritura</label>
                </div>
              </div>

              {config.typing_delay && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Velocidad mín (ms)</label>
                    <input
                      type="number"
                      value={config.typing_speed_min}
                      onChange={(e) => handleChange('typing_speed_min', parseInt(e.target.value))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Velocidad máx (ms)</label>
                    <input
                      type="number"
                      value={config.typing_speed_max}
                      onChange={(e) => handleChange('typing_speed_max', parseInt(e.target.value))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="media_keyword_trigger"
                  checked={config.media_keyword_trigger}
                  onChange={(e) => handleChange('media_keyword_trigger', e.target.checked)}
                  className="w-4 h-4 rounded bg-zinc-800 border-zinc-700"
                />
                <label htmlFor="media_keyword_trigger" className="text-zinc-300">Enviar imágenes por keywords</label>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={18} />
                Guardar Configuración
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}