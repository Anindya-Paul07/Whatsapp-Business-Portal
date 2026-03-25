import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Mail, Lock, Loader2, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden p-6 z-0 animate-fade-in">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-100 rounded-full blur-[120px] -z-10 opacity-60"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px] -z-10 opacity-60"></div>

            <div className="max-w-5xl w-full flex flex-col lg:flex-row bg-white/60 backdrop-blur-3xl rounded-[3rem] shadow-2xl border border-white/50 overflow-hidden relative z-10">

                {/* Visual Side Pane */}
                <div className="hidden lg:flex flex-col w-5/12 bg-gradient-to-br from-emerald-600 to-teal-800 p-12 text-white relative overflow-hidden justify-between">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>

                    <div className="relative z-10 space-y-8 mt-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl shadow-xl border border-white/20 mb-4 transform hover:scale-105 transition-transform">
                            <MessageSquare className="text-white" size={40} fill="currentColor" />
                        </div>
                        <h2 className="text-5xl font-black leading-tight tracking-tight text-white mb-2">
                            WA Auto<br />Marketing <span className="text-emerald-300">Pro</span>
                        </h2>
                        <p className="text-emerald-100/80 font-medium text-lg leading-relaxed max-w-sm">
                            Automate your campaigns, manage customer replies, and scale your business with the ultimate WhatsApp marketing suite.
                        </p>
                    </div>

                    <div className="relative z-10 space-y-6 mb-8">
                        <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/30 flex items-center justify-center text-white shrink-0">
                                <Zap size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-white text-sm uppercase tracking-wider">Lightning Fast</h4>
                                <p className="text-emerald-200/80 text-xs mt-0.5">High throughput message delivery</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/30 flex items-center justify-center text-white shrink-0">
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-white text-sm uppercase tracking-wider">Secure Connection</h4>
                                <p className="text-emerald-200/80 text-xs mt-0.5">End-to-end encrypted instances</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form Side Pane */}
                <div className="w-full lg:w-7/12 p-8 md:p-14 flex items-center bg-white/80">
                    <div className="w-full max-w-md mx-auto relative z-10">

                        <div className="lg:hidden text-center mb-10">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-[1.5rem] text-white shadow-xl mb-6">
                                <MessageSquare size={32} fill="currentColor" />
                            </div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">System Access</h1>
                            <p className="text-gray-500 mt-2 font-medium">Log in to manage your workspace</p>
                        </div>

                        <div className="hidden lg:block mb-10 text-center">
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
                            <p className="text-gray-500 mt-2 font-medium">
                                {isLogin ? 'Enter your credentials to access the platform.' : 'Sign up to get started with WA Auto Pro.'}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2 group">
                                <label className="block text-xs font-black text-gray-700 uppercase tracking-widest pl-1">Email Address</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors">
                                        <Mail size={20} />
                                    </span>
                                    <input
                                        type="email"
                                        className="w-full bg-gray-50/80 border border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 pl-12 pr-4 py-4 rounded-2xl transition-all font-bold placeholder-gray-400/80"
                                        placeholder="name@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 group">
                                <label className="block text-xs font-black text-gray-700 uppercase tracking-widest pl-1 flex justify-between">
                                    <span>Password</span>
                                    {isLogin && <a href="#" className="text-emerald-600 hover:text-emerald-700 font-bold normal-case tracking-normal">Forgot?</a>}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors">
                                        <Lock size={20} />
                                    </span>
                                    <input
                                        type="password"
                                        className="w-full bg-gray-50/80 border border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 pl-12 pr-4 py-4 rounded-2xl transition-all font-bold placeholder-gray-400/80"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-lg font-black rounded-2xl flex items-center justify-center gap-3 transition-all shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5)] hover:shadow-[0_15px_25px_-10px_rgba(16,185,129,0.7)] transform hover:-translate-y-1 mt-4 disabled:opacity-70 disabled:cursor-not-allowed group"
                                disabled={loading}
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" size={24} />
                                ) : (
                                    <>
                                        <span>{isLogin ? 'Sign In to Workspace' : 'Create New Account'}</span>
                                        <ArrowRight size={20} className="transform transition-transform group-hover:translate-x-1" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-10 pt-8 border-t border-gray-100 text-center">
                            <p className="text-sm font-medium text-gray-500">
                                {isLogin ? "Don't have an account yet?" : "Already have an account?"}
                                <button
                                    onClick={() => setIsLogin(!isLogin)}
                                    className="ml-2 font-black text-emerald-600 hover:text-emerald-700 transition-colors"
                                >
                                    {isLogin ? 'Create one now' : 'Sign in instead'}
                                </button>
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
