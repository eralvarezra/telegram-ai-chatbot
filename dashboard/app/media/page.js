'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '@/components/Header';
import { Upload, Trash2, Image, Video, Star, Eye, EyeOff, X, Check, ChevronUp, DollarSign, Tag, FolderUp, Package, Sparkles } from 'lucide-react';

export default function MediaPage() {
  const [media, setMedia] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [stats, setStats] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    keywords: '',
    price: '',
    tags: '',
    priority: '0',
    featured: false,
    productId: ''
  });

  const fileInputRef = useRef(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // Get auth token
  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  useEffect(() => {
    fetchMedia();
    fetchStats();
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/products`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchMedia = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_URL}/api/media`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setMedia(data);
    } catch (err) {
      console.error('Error fetching media:', err);
      setError('Could not connect to backend. Make sure server is running.');
      setMedia([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/media/stats`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (bulkMode) {
      setSelectedFiles(prev => [...prev, ...files]);
    } else {
      setSelectedFiles(files);
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );
    if (bulkMode) {
      setSelectedFiles(prev => [...prev, ...files]);
    } else {
      setSelectedFiles(files);
    }
  }, [bulkMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      if (bulkMode || selectedFiles.length > 1) {
        // Bulk upload
        const data = new FormData();
        selectedFiles.forEach(file => {
          data.append('files', file);
        });
        data.append('keywords', formData.keywords);
        if (formData.tags) data.append('tags', formData.tags);
        if (formData.price) data.append('price', formData.price);
        if (formData.priority) data.append('priority', formData.priority);
        if (formData.featured) data.append('featured', 'true');
        if (formData.productId) data.append('productId', formData.productId);

        const res = await fetch(`${API_URL}/api/media/upload/bulk`, {
          method: 'POST',
          headers: {
            ...(localStorage.getItem('auth_token') ? { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } : {})
          },
          body: data
        });

        if (!res.ok) throw new Error('Upload failed');
        const result = await res.json();
        setSuccess(`Uploaded ${result.uploaded} files successfully${result.failed > 0 ? `, ${result.failed} failed` : ''}`);
      } else {
        // Single upload
        const data = new FormData();
        data.append('file', selectedFiles[0]);
        data.append('title', formData.title || selectedFiles[0].name.split('.')[0]);
        data.append('description', formData.description);
        data.append('keywords', formData.keywords);
        if (formData.tags) data.append('tags', formData.tags);
        if (formData.price) data.append('price', formData.price);
        if (formData.priority) data.append('priority', formData.priority);
        if (formData.featured) data.append('featured', 'true');
        if (formData.productId) data.append('productId', formData.productId);

        const res = await fetch(`${API_URL}/api/media/upload`, {
          method: 'POST',
          headers: {
            ...(localStorage.getItem('auth_token') ? { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } : {})
          },
          body: data
        });

        if (!res.ok) throw new Error('Upload failed');
        setSuccess('Media uploaded successfully');
      }

      // Reset form
      setFormData({
        title: '',
        description: '',
        keywords: '',
        price: '',
        tags: '',
        priority: '0',
        featured: false,
        productId: ''
      });
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchMedia();
      fetchStats();
    } catch (err) {
      console.error('Upload error:', err);
      setError('Upload failed. Check backend connection.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this media?')) return;

    try {
      await fetch(`${API_URL}/api/media/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      fetchMedia();
      fetchStats();
      setSuccess('Media deleted');
    } catch (err) {
      console.error('Delete error:', err);
      setError('Delete failed');
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      await fetch(`${API_URL}/api/media/${id}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      fetchMedia();
      fetchStats();
      setSuccess(`Media ${currentStatus ? 'deactivated' : 'activated'}`);
    } catch (err) {
      console.error('Toggle error:', err);
      setError('Failed to toggle status');
    }
  };

  const handleToggleFeatured = async (id, currentStatus) => {
    try {
      await fetch(`${API_URL}/api/media/${id}/featured`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      fetchMedia();
      setSuccess(currentStatus ? 'Removed from featured' : 'Added to featured');
    } catch (err) {
      console.error('Featured error:', err);
      setError('Failed to update featured status');
    }
  };

  const handleToggleNewRelease = async (id, currentStatus) => {
    try {
      await fetch(`${API_URL}/api/media/${id}/new-release`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      fetchMedia();
      setSuccess(currentStatus ? 'Removed from New Release' : 'Marked as New Release');
    } catch (err) {
      console.error('New release error:', err);
      setError('Failed to update new release status');
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Media" />

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Media Library</h2>

          {/* Stats */}
          {stats && (
            <div className="flex gap-4 text-sm">
              <div className="bg-zinc-900 px-3 py-1 rounded-lg">
                <span className="text-zinc-400">Total:</span>
                <span className="text-white ml-1">{stats.total}</span>
              </div>
              <div className="bg-zinc-900 px-3 py-1 rounded-lg">
                <span className="text-zinc-400">Active:</span>
                <span className="text-green-400 ml-1">{stats.active}</span>
              </div>
              <div className="bg-zinc-900 px-3 py-1 rounded-lg">
                <span className="text-zinc-400">Featured:</span>
                <span className="text-yellow-400 ml-1">{stats.featured}</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-800 rounded-lg text-red-200 flex items-center justify-between">
            {error}
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <X size={18} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-900/50 border border-green-800 rounded-lg text-green-200 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Check size={18} />
              {success}
            </span>
            <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-300">
              <X size={18} />
            </button>
          </div>
        )}

        {/* Upload Mode Toggle */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setBulkMode(false)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${!bulkMode ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
          >
            Single Upload
          </button>
          <button
            onClick={() => setBulkMode(true)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${bulkMode ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
          >
            <FolderUp size={18} />
            Bulk Upload
          </button>
        </div>

        {/* Upload Form */}
        <div
          className={`bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6 ${dragOver ? 'border-blue-500 border-2' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <h3 className="text-lg font-semibold text-white mb-4">
            {bulkMode ? 'Bulk Upload' : 'Upload New Media'}
          </h3>

          {/* Drag & Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center mb-4 transition-colors ${dragOver ? 'border-blue-500 bg-blue-900/20' : 'border-zinc-700 hover:border-zinc-600'}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              multiple={bulkMode}
              className="hidden"
            />
            <Upload size={48} className="mx-auto text-zinc-500 mb-3" />
            <p className="text-zinc-400 mb-1">
              {dragOver ? 'Drop files here' : 'Drag & drop files here or click to select'}
            </p>
            <p className="text-zinc-500 text-sm">
              {bulkMode ? 'Select multiple images or videos' : 'Images and videos supported'}
            </p>
          </div>

          {/* Selected Files Preview */}
          {selectedFiles.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-zinc-400 mb-2">Selected files ({selectedFiles.length})</p>
              <div className="flex flex-wrap gap-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="relative bg-zinc-800 rounded-lg p-2 flex items-center gap-2">
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-zinc-700 rounded flex items-center justify-center">
                        <Video size={20} className="text-zinc-400" />
                      </div>
                    )}
                    <span className="text-zinc-300 text-sm max-w-[100px] truncate">{file.name}</span>
                    <button
                      onClick={() => removeSelectedFile(index)}
                      className="text-zinc-500 hover:text-red-400"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!bulkMode && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                    placeholder="e.g., Special Pack 1"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                    placeholder="Optional description"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Keywords * (comma-separated)</label>
                <input
                  type="text"
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                  placeholder="pack, special, foto"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Product</label>
                <div className="relative">
                  <Package size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <select
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-white appearance-none cursor-pointer"
                  >
                    <option value="">No product</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Price (optional)</label>
                <div className="relative">
                  <DollarSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-white"
                    placeholder="9.99"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Tags (comma-separated)</label>
                <div className="relative">
                  <Tag size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-white"
                    placeholder="premium, new, exclusive"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Priority (higher = shown first)</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                  placeholder="0"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer mt-6">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="w-5 h-5 rounded bg-zinc-800 border-zinc-600 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-zinc-300 flex items-center gap-2">
                    <Star size={18} className="text-yellow-400" />
                    Mark as Featured
                  </span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading || selectedFiles.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  {bulkMode || selectedFiles.length > 1 ? `Upload ${selectedFiles.length} Files` : 'Upload'}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Media Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : media.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <Image size={48} className="mx-auto mb-4 opacity-50" />
            <p>No media uploaded yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {media.map((item) => (
              <div
                key={item.id}
                className={`bg-zinc-900 border rounded-xl overflow-hidden ${item.featured ? 'border-yellow-500/50' : item.is_active ? 'border-zinc-800' : 'border-zinc-700 opacity-60'}`}
              >
                {/* Featured Badge */}
                {item.featured && (
                  <div className="absolute top-2 right-2 z-10">
                    <Star size={20} className="text-yellow-400 fill-yellow-400" />
                  </div>
                )}

                {/* New Release Badge */}
                {item.is_new_release && (
                  <div className="absolute top-2 left-2 z-10">
                    <span className="px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
                      <Sparkles size={12} />
                      NEW
                    </span>
                  </div>
                )}

                {/* Preview */}
                {item.file_type === 'image' ? (
                  <img
                    src={`${API_URL}/uploads/${item.file_path}`}
                    alt={item.title}
                    className="w-full h-48 object-cover relative"
                  />
                ) : (
                  <div className="w-full h-48 bg-zinc-800 flex items-center justify-center">
                    <Video size={48} className="text-zinc-600" />
                  </div>
                )}

                {/* Status Overlay */}
                {!item.is_active && (
                  <div className="absolute inset-0 bg-zinc-900/80 flex items-center justify-center">
                    <span className="text-zinc-400 flex items-center gap-2">
                      <EyeOff size={20} />
                      Inactive
                    </span>
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-medium truncate">{item.title}</h4>
                        {item.featured && (
                          <Star size={14} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                        )}
                      </div>
                      {item.description && (
                        <p className="text-zinc-500 text-sm truncate">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {item.price && (
                          <span className="text-green-400 text-sm">${item.price}</span>
                        )}
                        {item.product && (
                          <span className="flex items-center gap-1 text-purple-400 text-xs">
                            <Package size={12} />
                            {item.product.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {item.tags && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags.split(',').slice(0, 3).map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-900/30 text-blue-300 text-xs rounded">
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Keywords */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.keywords && item.keywords.split(',').map((kw, i) => (
                      <span key={i} className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded">
                        {kw.trim()}
                      </span>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Eye size={12} />
                      {item.view_count || 0} views
                    </span>
                    {item.priority > 0 && (
                      <span className="flex items-center gap-1">
                        <ChevronUp size={12} />
                        Priority: {item.priority}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(item.id, item.is_active)}
                      className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${item.is_active ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                      {item.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                      {item.is_active ? 'Active' : 'Inactive'}
                    </button>

                    <button
                      onClick={() => handleToggleFeatured(item.id, item.featured)}
                      className={`flex items-center justify-center p-2 rounded-lg transition-colors ${item.featured ? 'bg-yellow-900/30 text-yellow-400' : 'bg-zinc-800 text-zinc-400 hover:text-yellow-400'}`}
                      title={item.featured ? 'Remove from featured' : 'Mark as featured'}
                    >
                      <Star size={16} />
                    </button>

                    <button
                      onClick={() => handleToggleNewRelease(item.id, item.is_new_release)}
                      className={`flex items-center justify-center p-2 rounded-lg transition-colors ${item.is_new_release ? 'bg-purple-900/30 text-purple-400' : 'bg-zinc-800 text-zinc-400 hover:text-purple-400'}`}
                      title={item.is_new_release ? 'Remove from New Release' : 'Mark as New Release (shown first)'}
                    >
                      <Sparkles size={16} />
                    </button>

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="flex items-center justify-center p-2 bg-zinc-800 text-red-400 hover:bg-red-900/50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}