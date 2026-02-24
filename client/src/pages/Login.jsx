import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Mail, Lock, Loader2 } from 'lucide-react';
import api from '../utils/api';
import { useApp } from '../AppContext';
import toast from 'react-hot-toast';

const Login = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useApp();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const endpoint = isLogin ? '/auth/login' : '/auth/register';

        try {
            const { data } = await api.post(endpoint, { email, password });
            if (data.success) {
                if (isLogin) {
                    login(data.user, data.token);
                    toast.success('Successfully logged in!');
                    navigate('/');
                } else {
                    toast.success('Registration successful! Please login.');
                    setIsLogin(true);
                }
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4">
            <div className="max-w-md w-full animate-fade-in">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00a884] rounded-2xl text-white shadow-lg mb-4">
                        <MessageSquare size={32} fill="currentColor" />
                    </div>
                    <h1 className="text-3xl font-bold text-[#111b21]">WhatsApp Platform</h1>
                    <p className="text-[#667781] mt-2">Manage your campaigns and chats efficiently</p>
                </div>

                <div className="card bg-white p-8 shadow-xl">
                    <h2 className="text-2xl font-bold mb-6">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="label">Email Address</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-[#667781]">
                                    <Mail size={18} />
                                </span>
                                <input
                                    type="email"
                                    className="input pl-10"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="label">Password</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-[#667781]">
                                    <Lock size={18} />
                                </span>
                                <input
                                    type="password"
                                    className="input pl-10"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn-primary w-full py-3 text-base justify-center mt-2 group"
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                                    <div className="transform transition-transform group-hover:translate-x-1">→</div>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t text-center">
                        <p className="text-sm text-[#667781]">
                            {isLogin ? "Don't have an account?" : "Already have an account?"}
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="ml-2 font-bold text-[#00a884] hover:underline"
                            >
                                {isLogin ? 'Register Now' : 'Login Back'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
