'use client';

import { useState, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';

const iconComponents = {
  email: Mail,
  lock: Lock,
  user: User,
};

const InputField = forwardRef(({
  type = 'text',
  placeholder,
  value,
  onChange,
  icon,
  error,
  autoFocus = false,
  className = '',
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const IconComponent = iconComponents[icon] || null;
  const isPasswordField = type === 'password';
  const inputType = isPasswordField ? (showPassword ? 'text' : 'password') : type;

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <div className={`relative ${className}`}>
      <motion.div
        animate={{
          borderColor: error
            ? 'rgba(239, 68, 68, 0.5)'
            : isFocused
              ? 'rgba(59, 130, 246, 0.5)'
              : 'rgba(255, 255, 255, 0.1)',
          boxShadow: error
            ? '0 0 0 3px rgba(239, 68, 68, 0.1)'
            : isFocused
              ? '0 0 0 3px rgba(59, 130, 246, 0.1)'
              : '0 0 0 0 transparent'
        }}
        className="relative rounded-xl overflow-hidden"
      >
        {/* Icon */}
        {IconComponent && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
            <IconComponent size={18} />
          </div>
        )}

        {/* Input */}
        <input
          ref={ref}
          type={inputType}
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={`
            w-full bg-zinc-800/50 text-white placeholder-zinc-500
            py-3.5 rounded-xl border border-transparent outline-none
            transition-all duration-200
            ${IconComponent ? 'pl-12' : 'pl-4'}
            ${isPasswordField ? 'pr-12' : 'pr-4'}
          `}
        />

        {/* Password toggle */}
        {isPasswordField && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -5, height: 0 }}
            className="text-red-400 text-sm mt-2 pl-1"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
});

InputField.displayName = 'InputField';

export default InputField;