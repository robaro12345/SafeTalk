import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Users, BarChart3, TrendingUp, UserCheck, MessageSquare, Lock, Ban, Unlock, Eye, Trash2 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

interface Stats {
  users: {
    total: number;
    active: number;
    new24h: number;
    new7d: number;
    new30d: number;
    locked: number;
    banned: number;
    byTwoFAMethod: {
      email: number;
      totp: number;
    };
  };
  messages: {
    total: number;
    last24h: number;
  };
  topSenders: Array<{
    _id: string;
    username: string;
    messageCount: number;
  }>;
  recentLogins: Array<{
    _id: string;
    username: string;
    role: string;
    lastLogin: string;
  }>;
}

interface User {
  _id: string;
  username: string;
  email: string;
  role: string;
  twoFAMethod: string;
  isActive: boolean;
  isLocked: boolean;
  createdAt: string;
}

interface UserDetail extends User {
  lastLogin?: string;
  messageStats: {
    sent: number;
    received: number;
    total: number;
  };
}

interface Pagination {
  page: number;
  pages: number;
  total: number;
  limit: number;
}

interface Analytics {
  userGrowth: Array<{
    _id: string;
    count: number;
  }>;
  messageActivity: Array<{
    _id: string;
    count: number;
  }>;
}

const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // User management states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  
  // Selected user for actions
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/chat');
    }
  }, [user, navigate]);

  // Fetch dashboard stats
  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchStats();
    }
  }, [activeTab]);

  // Fetch users when filters change
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, currentPage, searchTerm, filterRole, filterActive]);

  // Fetch analytics
  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/admin/stats');
      setStats(response.data.stats);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch statistics');
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(filterRole && { role: filterRole }),
        ...(filterActive !== '' && { isActive: filterActive })
      });
      
      const response = await api.get(`/admin/users?${params}`);
      setUsers(response.data.users);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetail = async (userId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/users/${userId}`);
      setUserDetail(response.data.user);
      setShowUserDetail(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch user details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/admin/analytics?period=30');
      setAnalytics(response.data.analytics);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (userId: string, ban: boolean) => {
    const reason = prompt(ban ? 'Enter ban reason:' : 'Enter unban reason:');
    if (reason === null) return; // User cancelled

    try {
      await api.put(`/admin/users/${userId}/ban`, { ban, reason });
      toast.success(`User ${ban ? 'banned' : 'unbanned'} successfully`);
      fetchUsers();
      if (showUserDetail && userDetail?._id === userId) {
        setShowUserDetail(false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to ${ban ? 'ban' : 'unban'} user`);
    }
  };

  const handleUnlockUser = async (userId: string) => {
    try {
      await api.put(`/admin/users/${userId}/unlock`);
      toast.success('User account unlocked successfully');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to unlock user');
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      return;
    }

    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      toast.success('User role updated successfully');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change user role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('⚠️ WARNING: This will permanently delete the user and all their messages. This action cannot be undone!\n\nType "DELETE" to confirm.')) {
      return;
    }

    const confirmation = prompt('Type "DELETE" to confirm:');
    if (confirmation !== 'DELETE') {
      toast.error('Deletion cancelled');
      return;
    }

    try {
      await api.delete(`/admin/users/${userId}`, { data: { confirm: true } });
      toast.success('User deleted successfully');
      fetchUsers();
      if (showUserDetail && userDetail?._id === userId) {
        setShowUserDetail(false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const formatDate = (date: any) => {
    return new Date(date).toLocaleString();
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard Statistics</h2>
      
      {stats && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.users.total}</h3>
                  <span className="text-xs text-green-600 mt-2 block">Active: {stats.users.active}</span>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Messages</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.messages.total}</h3>
                  <span className="text-xs text-blue-600 mt-2 block">Last 24h: {stats.messages.last24h}</span>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">New Users (24h)</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.users.new24h}</h3>
                  <span className="text-xs text-purple-600 mt-2 block">7d: {stats.users.new7d} | 30d: {stats.users.new30d}</span>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Locked Accounts</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.users.locked}</h3>
                  <span className="text-xs text-red-600 mt-2 block">Banned: {stats.users.banned}</span>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Lock className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-green-600" />
                2FA Methods
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Email OTP</span>
                  <span className="font-semibold text-gray-900">{stats.users.byTwoFAMethod.email}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Authenticator App</span>
                  <span className="font-semibold text-gray-900">{stats.users.byTwoFAMethod.totp}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
                Top Message Senders
              </h3>
              <div className="space-y-2">
                {stats.topSenders.map((sender: any, index: number) => (
                  <div key={sender._id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    <span className="font-bold text-green-600 text-lg w-6">#{index + 1}</span>
                    <span className="flex-1 font-medium text-gray-900">{sender.username}</span>
                    <span className="text-sm text-gray-600">{sender.messageCount}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <UserCheck className="w-5 h-5 mr-2 text-purple-600" />
                Recent Logins
              </h3>
              <div className="space-y-2">
                {stats.recentLogins.map((login: any) => (
                  <div key={login._id} className="py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">{login.username}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        login.role === 'admin' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {login.role}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{formatDate(login.lastLogin)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
      
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          
          <select 
            value={filterRole} 
            onChange={(e) => {
              setFilterRole(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          
          <select 
            value={filterActive} 
            onChange={(e) => {
              setFilterActive(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Banned</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">2FA</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((u: any) => (
                <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{u.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'admin' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {u.twoFAMethod === 'totp' ? '📱 App' : '📧 Email'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {u.isLocked ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        🔒 Locked
                      </span>
                    ) : u.isActive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ✗ Banned
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => fetchUserDetail(u._id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {u.isLocked && (
                        <button 
                          onClick={() => handleUnlockUser(u._id)}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                          title="Unlock Account"
                        >
                          <Unlock className="w-4 h-4" />
                        </button>
                      )}
                      {u.isActive ? (
                        <button 
                          onClick={() => handleBanUser(u._id, true)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Ban User"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleBanUser(u._id, false)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Unban User"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteUser(u._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-center space-x-4">
          <button 
            onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            Previous
          </button>
          <span className="text-gray-700 font-medium">
            Page {currentPage} of {pagination.pages}
          </span>
          <button 
            onClick={() => setCurrentPage((p: number) => Math.min(pagination.pages, p + 1))}
            disabled={currentPage === pagination.pages}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Analytics (Last 30 Days)</h2>
      
      {analytics && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
              User Growth
            </h3>
            {analytics.userGrowth.length > 0 ? (
              <div className="flex items-end justify-between h-64 gap-2 overflow-x-auto">
                {analytics.userGrowth.map((data: any) => (
                  <div key={data._id} className="flex flex-col items-center min-w-[60px]">
                    <div 
                      className="w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg flex items-start justify-center pt-2 transition-all hover:opacity-80" 
                      style={{ height: `${Math.max(data.count * 40, 20)}px` }}
                    >
                      <span className="text-white text-xs font-semibold">{data.count}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-2 transform -rotate-45 origin-top-left whitespace-nowrap">
                      {new Date(data._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No user registration data for this period</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-blue-600" />
              Message Activity
            </h3>
            {analytics.messageActivity.length > 0 ? (
              <div className="flex items-end justify-between h-64 gap-2 overflow-x-auto">
                {analytics.messageActivity.map((data: any) => (
                  <div key={data._id} className="flex flex-col items-center min-w-[60px]">
                    <div 
                      className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg flex items-start justify-center pt-2 transition-all hover:opacity-80" 
                      style={{ height: `${Math.min(data.count / 2, 200)}px`, minHeight: '20px' }}
                    >
                      <span className="text-white text-xs font-semibold">{data.count}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-2 transform -rotate-45 origin-top-left whitespace-nowrap">
                      {new Date(data._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No message data for this period</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/chat')}
            className="flex items-center space-x-2 text-gray-600 hover:text-green-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Chat</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Shield className="w-7 h-7 mr-2 text-green-600" />
            Admin Panel
          </h1>
          <div className="w-28"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex space-x-2 mb-6">
          <button 
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-white text-green-600 shadow-sm border border-gray-200'
                : 'bg-white/50 text-gray-600 hover:bg-white hover:shadow-sm'
            }`}
            onClick={() => setActiveTab('dashboard')}
          >
            <BarChart3 className="w-5 h-5" />
            <span>Dashboard</span>
          </button>
          <button 
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'users'
                ? 'bg-white text-green-600 shadow-sm border border-gray-200'
                : 'bg-white/50 text-gray-600 hover:bg-white hover:shadow-sm'
            }`}
            onClick={() => setActiveTab('users')}
          >
            <Users className="w-5 h-5" />
            <span>Users</span>
          </button>
          <button 
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'analytics'
                ? 'bg-white text-green-600 shadow-sm border border-gray-200'
                : 'bg-white/50 text-gray-600 hover:bg-white hover:shadow-sm'
            }`}
            onClick={() => setActiveTab('analytics')}
          >
            <TrendingUp className="w-5 h-5" />
            <span>Analytics</span>
          </button>
        </div>

        {/* Content */}
        <div>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}
          
          {!loading && !error && (
            <>
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'users' && renderUsers()}
              {activeTab === 'analytics' && renderAnalytics()}
            </>
          )}
        </div>
      </div>

      {/* User Detail Modal */}
      {showUserDetail && userDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowUserDetail(false)}>
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">User Details</h2>
              <button 
                onClick={() => setShowUserDetail(false)} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-700">Username:</span>
                  <span className="text-gray-900">{userDetail.username}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-700">Email:</span>
                  <span className="text-gray-900">{userDetail.email}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-700">Role:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    userDetail.role === 'admin' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                  }`}>{userDetail.role}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-700">2FA Method:</span>
                  <span className="text-gray-900">{userDetail.twoFAMethod === 'totp' ? '📱 Authenticator App' : '📧 Email OTP'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-700">Status:</span>
                  <span className="text-gray-900">{userDetail.isActive ? '✓ Active' : '✗ Banned'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-700">Locked:</span>
                  <span className="text-gray-900">{userDetail.isLocked ? '🔒 Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-700">Joined:</span>
                  <span className="text-gray-900">{formatDate(userDetail.createdAt)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-medium text-gray-700">Last Login:</span>
                  <span className="text-gray-900">{userDetail.lastLogin ? formatDate(userDetail.lastLogin) : 'Never'}</span>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Message Statistics</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{userDetail.messageStats.sent}</p>
                    <p className="text-sm text-gray-600">Sent</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{userDetail.messageStats.received}</p>
                    <p className="text-sm text-gray-600">Received</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600">{userDetail.messageStats.total}</p>
                    <p className="text-sm text-gray-600">Total</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Actions</h3>
                <div className="space-y-2">
                  {userDetail.role === 'user' && (
                    <button 
                      onClick={() => handleChangeRole(userDetail._id, 'admin')} 
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      Promote to Admin
                    </button>
                  )}
                  {userDetail.role === 'admin' && userDetail._id !== user.id && (
                    <button 
                      onClick={() => handleChangeRole(userDetail._id, 'user')} 
                      className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
                    >
                      Demote to User
                    </button>
                  )}
                  {userDetail.isLocked && (
                    <button 
                      onClick={() => handleUnlockUser(userDetail._id)} 
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Unlock Account
                    </button>
                  )}
                  {userDetail.isActive ? (
                    <button 
                      onClick={() => handleBanUser(userDetail._id, true)} 
                      className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      Ban User
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleBanUser(userDetail._id, false)} 
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      Unban User
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeleteUser(userDetail._id)} 
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Delete User
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
